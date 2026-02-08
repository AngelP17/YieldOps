//! Assembly Sentinel - Packaging & Wire Bonding Agent
//!
//! Monitors Wire Bonders (K&S, ASM) and Die Attach equipment.
//! 
//! # The Physics of Wire Bonding (The "Killer" Physics)
//! 
//! Wire bonding is where 80% of packaging defects occur. The critical physics:
//! 
//! ## Ultrasonic Impedance Monitoring
//! When the capillary touches the bond pad and ultrasonic energy is applied,
//! the mechanical impedance of the transducer changes. This is the primary
//! detection mechanism for "Non-Stick on Pad" (NSOP).
//! 
//! Physics equation:
//! ```text
//! Z_mechanical = F / v
//! where F = ultrasonic force, v = vibration velocity
//! ```
//! 
//! If impedance stays low (< 30Ω typical), the wire didn't stick to the pad.
//! 
//! ## Capillary Thermal Expansion
//! Tungsten carbide capillary CTE: ~5.5 × 10⁻⁶ /°C
//! For a 10mm capillary, ΔT = 50°C → expansion = 2.75µm
//! 
//! This affects bond placement accuracy and loop height.
//!
//! ## OEE (Overall Equipment Effectiveness)
//! Packaging is all about speed (Units Per Hour - UPH).
//! 
//! OEE = Availability × Performance × Quality
//! 
//! Target cycle time: ~15ms per wire bond
//! Performance loss detected when cycle time drifts above threshold.
//!
//! # SECS/GEM Protocol Integration
//! 
//! This agent uses the "Sidecar Pattern" for SECS/GEM communication:
//! 
//! ```text
//! [Rust Agent] <--(MQTT)--> [Python Bridge] <--(SECS/GEM)--> [Wire Bonder]
//! ```
//! 
//! The Rust agent sends high-level commands (STOP, ADJUST) via MQTT.
//! The Python bridge (`gem_adapter.py`) translates to SECS-II messages:
//! - S2F41: Host Command Send (Remote commands)
//! - S2F42: Host Command Acknowledge
//! - S6F11: Event Report Send (Equipment events)
//!
//! This avoids writing a full SECS/GEM stack in Rust (6+ month effort).

use async_trait::async_trait;
use serde::Deserialize;
use serde_json::json;
use std::collections::VecDeque;
use tracing::{info, warn};

use crate::types::*;
use super::SentinelAgent;

/// Assembly Sentinel configuration
/// 
/// These parameters tune the physics-based detection algorithms.
#[derive(Debug, Clone, Deserialize)]
pub struct AssemblyConfig {
    /// Maximum bond time in milliseconds (Performance check for OEE)
    /// Typical wire bond: 10-20ms. Above this = throughput degradation.
    pub max_bond_time_ms: f64,
    
    /// Minimum ultrasonic impedance in Ohms (Physics check for NSOP)
    /// Below this threshold indicates non-stick condition.
    pub min_ultrasonic_impedance: f64,
    
    /// Target OEE (Overall Equipment Effectiveness)
    /// Industry standard: 85%. World-class: 90%+
    pub target_oee: f64,
    
    /// Machine identifier for SECS/GEM communication
    pub machine_id: String,
    
    /// Capillary material CTE (Coefficient of Thermal Expansion)
    /// Tungsten carbide: 5.5e-6 /°C, Ceramic: ~3.0e-6 /°C
    pub material_cte: f64,
    
    /// Capillary length in mm (for thermal expansion calculation)
    pub capillary_length_mm: f64,
}

impl Default for AssemblyConfig {
    fn default() -> Self {
        Self {
            max_bond_time_ms: 20.0,           // 20ms max cycle time
            min_ultrasonic_impedance: 30.0,   // 30Ω minimum impedance
            target_oee: 0.85,                 // 85% OEE target
            machine_id: "BOND-01".to_string(),
            material_cte: 5.5e-6,             // Tungsten carbide
            capillary_length_mm: 10.0,        // 10mm standard
        }
    }
}

/// Wire Bonding & Packaging Sentinel Agent
/// 
/// Implements detection for:
/// - NSOP (Non-Stick on Pad) via ultrasonic impedance
/// - Throughput degradation (OEE impact)
/// - Capillary thermal drift
/// - Equipment degradation (USG, etc.)
pub struct AssemblySentinel {
    config: AssemblyConfig,
    bond_time_history: VecDeque<f64>,
    impedance_history: VecDeque<f64>,
    nsop_count: u32,  // Consecutive NSOP counter
}

impl AssemblySentinel {
    /// Create a new Assembly Sentinel
    pub fn new(config: AssemblyConfig) -> Self {
        Self {
            config,
            bond_time_history: VecDeque::with_capacity(100),
            impedance_history: VecDeque::with_capacity(100),
            nsop_count: 0,
        }
    }

    /// Create from YAML configuration
    pub fn from_config(yaml: serde_yaml::Value) -> Result<Self, AgentError> {
        let config: AssemblyConfig = serde_yaml::from_value(yaml)
            .map_err(|e| AgentError::ConfigError(format!("Assembly config: {}", e)))?;
        Ok(Self::new(config))
    }

    /// Detect "Non-Stick on Pad" (NSOP)
    /// 
    /// # Physics Explanation
    /// When the wire bonder's capillary touches the bond pad and ultrasonic
    /// energy is applied, the mechanical impedance of the transducer should
    /// rise as the wire bonds to the pad. 
    /// 
    /// If impedance stays low, the wire didn't stick (NSOP).
    /// 
    /// # Parameters
    /// - `impedance_ohms`: Current ultrasonic transducer impedance
    /// 
    /// # Returns
    /// - `Some(Threat)` if NSOP detected (Critical severity)
    /// - `None` if bond is good
    fn detect_bond_defect(&mut self, impedance_ohms: f64) -> Option<Threat> {
        if impedance_ohms < self.config.min_ultrasonic_impedance {
            self.nsop_count += 1;
            
            // Trigger after 3 consecutive NSOPs to avoid false positives
            if self.nsop_count >= 3 {
                self.nsop_count = 0;  // Reset after detection
                Some(Threat::QualityDefect {
                    machine_id: self.config.machine_id.clone(),
                    defect_type: "NSOP (Non-Stick on Pad)".to_string(),
                    confidence: 0.99,
                    severity: Severity::Critical,  // STOP IMMEDIATELY
                })
            } else {
                None  // Still counting
            }
        } else {
            // Good bond - reset counter
            self.nsop_count = 0;
            None
        }
    }

    /// Detect Throughput Degradation (OEE Killer)
    /// 
    /// Micro-stoppages and cycle time drift are the silent killers of OEE.
    /// This detector monitors bond time and alerts when it exceeds target.
    /// 
    /// # OEE Impact
    /// A 10% cycle time increase → ~8% OEE loss (depending on availability)
    /// 
    /// # Parameters
    /// - `cycle_time_ms`: Current bond cycle time in milliseconds
    /// 
    /// # Returns
    /// - `Some(Threat)` if cycle time exceeds threshold
    /// - `None` if performance is nominal
    fn detect_throughput_drift(&self, cycle_time_ms: f64) -> Option<Threat> {
        if cycle_time_ms > self.config.max_bond_time_ms {
            Some(Threat::ThroughputDegradation {
                machine_id: self.config.machine_id.clone(),
                issue: "Cycle Time Drift".to_string(),
                impact_oee: true,
                severity: Severity::Medium,
            })
        } else {
            None
        }
    }

    /// Detect Capillary Thermal Drift
    /// 
    /// # Physics: Thermal Expansion
    /// As the capillary heats up during bonding, it expands according to:
    /// ```
    /// ΔL = L₀ × α × ΔT
    /// ```
    /// Where:
    /// - L₀ = original length
    /// - α = coefficient of thermal expansion (CTE)
    /// - ΔT = temperature change
    /// 
    /// This affects Z-height and bond placement accuracy.
    fn detect_capillary_drift(&self, temp: f64, baseline_temp: f64) -> Option<Threat> {
        let temp_rise = temp - baseline_temp;
        let expansion_mm = self.config.material_cte * self.config.capillary_length_mm * temp_rise;
        
        // Alert if expansion exceeds 1µm (typical placement tolerance)
        if expansion_mm > 0.001 {
            Some(Threat::ThermalDrift {
                machine_id: self.config.machine_id.clone(),
                drift_mm: expansion_mm,
                axis: "Z".to_string(),
                severity: if expansion_mm > 0.002 {
                    Severity::High
                } else {
                    Severity::Medium
                },
            })
        } else {
            None
        }
    }

    /// Calculate OEE (Overall Equipment Effectiveness)
    /// 
    /// Simplified calculation based on performance component:
    /// Performance = Theoretical Cycle Time / Actual Cycle Time
    /// 
    /// In real implementation, this would also consider:
    /// - Availability: (Run Time / Planned Production Time)
    /// - Quality: (Good Units / Total Units)
    fn calculate_oee(&self) -> f64 {
        if self.bond_time_history.is_empty() {
            return 1.0;
        }
        
        let avg_cycle_time = self.bond_time_history.iter()
            .sum::<f64>() / self.bond_time_history.len() as f64;
        
        let theoretical_cycle_time = 15.0; // ms - typical for gold wire bonding
        let performance = theoretical_cycle_time / avg_cycle_time;
        
        performance.min(1.0)
    }

    /// Get machine ID
    pub fn machine_id(&self) -> &str {
        &self.config.machine_id
    }
}

#[async_trait]
impl SentinelAgent for AssemblySentinel {
    fn analyze(&mut self, telemetry: &Telemetry) -> Vec<Threat> {
        let mut threats = Vec::new();
        
        // Extract physics data from telemetry
        let impedance = telemetry.metrics.get("usg_impedance").copied().unwrap_or(100.0);
        let bond_time = telemetry.metrics.get("bond_time_ms").copied().unwrap_or(15.0);
        let capillary_temp = telemetry.metrics.get("capillary_temp").copied().unwrap_or(25.0);
        
        // Update rolling history for OEE calculation
        self.bond_time_history.push_back(bond_time);
        if self.bond_time_history.len() > 100 {
            self.bond_time_history.pop_front();
        }
        
        self.impedance_history.push_back(impedance);
        if self.impedance_history.len() > 100 {
            self.impedance_history.pop_front();
        }
        
        // Run physics-based detection algorithms
        
        // 1. NSOP Detection (Critical - immediate stop)
        if let Some(t) = self.detect_bond_defect(impedance) {
            threats.push(t);
        }
        
        // 2. Throughput/OEE Check
        if let Some(t) = self.detect_throughput_drift(bond_time) {
            threats.push(t);
        }
        
        // 3. Thermal Drift Detection
        if let Some(t) = self.detect_capillary_drift(capillary_temp, 25.0) {
            threats.push(t);
        }
        
        // 4. OEE Target Check
        let oee = self.calculate_oee();
        if oee < self.config.target_oee {
            threats.push(Threat::ThroughputDegradation {
                machine_id: self.config.machine_id.clone(),
                issue: format!("OEE Below Target: {:.1}%", oee * 100.0),
                impact_oee: true,
                severity: Severity::Medium,
            });
        }
        
        threats
    }

    fn safety_circuit(&self, threat: &Threat) -> (ResponseTier, Action) {
        match threat {
            // NSOP = Immediate Stop (Waste Prevention)
            // This is a yield-critical defect - stop before more bad units are produced
            Threat::QualityDefect { defect_type, .. } 
                if defect_type.contains("NSOP") => (
                ResponseTier::Red,
                Action::FeedHold {
                    reason: "CRITICAL: Non-Stick on Pad Detected".to_string(),
                }
            ),
            
            // Other quality defects = Work order for inspection
            Threat::QualityDefect { defect_type, .. } => (
                ResponseTier::Yellow,
                Action::CreateWorkOrder {
                    priority: "high".to_string(),
                    description: format!("Quality defect: {}", defect_type),
                    component: "Bonding_Capillary".to_string(),
                }
            ),
            
            // Slow Cycle Time = Auto-Optimize (Green Zone)
            // Increase bond force slightly to improve bonding speed
            Threat::ThroughputDegradation { issue, .. } 
                if issue.contains("Cycle Time") => (
                ResponseTier::Green,
                Action::AdjustParameter {
                    parameter_name: "bond_force".to_string(),
                    new_value: 1.05,  // Increase force 5%
                    unit: "percent".to_string(),
                }
            ),
            
            // OEE degradation = Alert operations
            Threat::ThroughputDegradation { .. } => (
                ResponseTier::Yellow,
                Action::SendAlert {
                    severity: Severity::Medium,
                    message: "OEE below target - review process parameters".to_string(),
                    escalate_to: Some("Process_Engineer".to_string()),
                }
            ),
            
            // Thermal drift = Auto-compensate (small) or alert (large)
            Threat::ThermalDrift { drift_mm, .. } if *drift_mm < 0.002 => (
                ResponseTier::Green,
                Action::AdjustParameter {
                    parameter_name: "z_offset".to_string(),
                    new_value: -*drift_mm * 1000.0,  // Convert to µm
                    unit: "micrometers".to_string(),
                }
            ),
            
            Threat::ThermalDrift { .. } => (
                ResponseTier::Yellow,
                Action::SendAlert {
                    severity: Severity::High,
                    message: "Significant capillary thermal drift".to_string(),
                    escalate_to: Some("Maintenance".to_string()),
                }
            ),
            
            _ => (ResponseTier::Green, Action::LogOnly),
        }
    }

    async fn execute(&self, action: &Action) -> Result<(), AgentError> {
        match action {
            Action::FeedHold { reason } => {
                // SECS/GEM Integration via Sidecar Pattern
                // We don't speak SECS directly. We tell the Python Bridge to do it.
                // 
                // The bridge translates our high-level "STOP" command to SECS-II S2F41.
                // 
                // SECS Message Structure:
                // S2F41 W
                //   <L[2]
                //     <A "STOP">     // RCMD (Remote Command)
                //     <L[0]>          // No parameters for simple stop
                //   >
                
                let topic = "sentinel/bridge/command";
                let payload = json!({
                    "action": "STOP",
                    "machine_id": self.config.machine_id,
                    "reason": reason,
                    "protocol": "SECS-II",
                    "stream": 2,
                    "function": 41
                });
                
                info!(
                    "[SECS-BRIDGE] Sending S2F41 RCMD=STOP to {}: {}",
                    self.config.machine_id, reason
                );
                
                // In actual implementation, this would publish to MQTT
                // mqtt_client.publish(topic, payload).await?;
                
                // For now, we log the action (simulation mode)
                info!("[MQTT] Would publish to {}: {}", topic, payload);
                
                Ok(())
            }
            
            Action::AdjustParameter { parameter_name, new_value, unit } => {
                // SECS/GEM Remote Command with Parameters (S2F41)
                // 
                // SECS Message Structure:
                // S2F41 W
                //   <L[2]
                //     <A "BOND_FORCE_ADJ">  // RCMD
                //     <L[1]                  // CPNAME/CPVAL list
                //       <L[2]
                //         <A "FORCE_PCT">
                //         <F4 105.0>
                //       >
                //     >
                //   >
                
                let topic = "sentinel/bridge/command";
                let payload = json!({
                    "action": "ADJUST_PARAMETER",
                    "machine_id": self.config.machine_id,
                    "parameter_name": parameter_name,
                    "new_value": new_value,
                    "unit": unit,
                    "protocol": "SECS-II",
                    "stream": 2,
                    "function": 41
                });
                
                info!(
                    "[SECS-BRIDGE] S2F41 Remote Command to {}: {} = {} {}",
                    self.config.machine_id, parameter_name, new_value, unit
                );
                
                info!("[MQTT] Would publish to {}: {}", topic, payload);
                
                Ok(())
            }
            
            Action::CreateWorkOrder { priority, description, component } => {
                // Send to CMMS (Computerized Maintenance Management System)
                info!(
                    "[ASSEMBLY CMMS] Work order created: {} for {} (priority: {})",
                    description, component, priority
                );
                Ok(())
            }
            
            Action::SendAlert { severity, message, escalate_to } => {
                let escalation = escalate_to.as_ref()
                    .map(|e| format!(" -> {}", e))
                    .unwrap_or_default();
                
                warn!(
                    "[ASSEMBLY ALERT][{:?}] {}{}",
                    severity, message, escalation
                );
                Ok(())
            }
            
            _ => {
                info!("[ASSEMBLY] Action executed: {:?}", action);
                Ok(())
            }
        }
    }

    fn metadata(&self) -> AgentMetadata {
        AgentMetadata {
            name: "Assembly Sentinel".to_string(),
            version: "2.1.0".to_string(),
            target_equipment: vec![
                "Wire Bonder".to_string(),
                "Die Attach".to_string(),
                "Flip Chip Bonder".to_string(),
                "Wedge Bonder".to_string(),
            ],
            capabilities: vec![
                "NSOP Detection (Ultrasonic Impedance)".to_string(),
                "OEE Monitoring".to_string(),
                "Capillary Thermal Compensation".to_string(),
                "SECS/GEM Integration (via Sidecar)".to_string(),
                "Throughput Optimization".to_string(),
            ],
        }
    }

    fn can_handle(&self, machine_id: &str) -> bool {
        self.config.machine_id == machine_id || 
        machine_id.starts_with("BOND-") ||
        machine_id.starts_with("ASM-") ||
        machine_id.starts_with("WB-")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_telemetry(impedance: f64, bond_time: f64) -> Telemetry {
        let mut metrics = HashMap::new();
        metrics.insert("usg_impedance".to_string(), impedance);
        metrics.insert("bond_time_ms".to_string(), bond_time);
        metrics.insert("capillary_temp".to_string(), 25.0);
        
        Telemetry {
            timestamp: "2026-02-08T10:00:00Z".to_string(),
            machine_id: "BOND-01".to_string(),
            metrics,
            states: HashMap::new(),
        }
    }

    #[test]
    fn test_nsop_detection() {
        let config = AssemblyConfig {
            min_ultrasonic_impedance: 30.0,
            ..Default::default()
        };
        let mut agent = AssemblySentinel::new(config);

        // Normal bonds (impedance > threshold)
        for _ in 0..5 {
            let telemetry = create_test_telemetry(50.0, 15.0);
            let threats = agent.analyze(&telemetry);
            assert!(threats.is_empty(), "Normal bonds should not trigger NSOP");
        }

        // Consecutive NSOPs (impedance < threshold)
        let mut threats_found = 0;
        for i in 0..5 {
            let telemetry = create_test_telemetry(20.0, 15.0);  // Below 30Ω
            let threats = agent.analyze(&telemetry);
            threats_found += threats.len();
            
            // NSOP should trigger after 3 consecutive failures
            if i >= 2 {
                assert!(!threats.is_empty(), "Should detect NSOP after 3 consecutive");
                assert!(matches!(threats[0], Threat::QualityDefect { .. }));
            }
        }
        
        assert!(threats_found > 0, "Should have detected at least one NSOP");
    }

    #[test]
    fn test_throughput_drift() {
        let config = AssemblyConfig {
            max_bond_time_ms: 20.0,
            ..Default::default()
        };
        let mut agent = AssemblySentinel::new(config);

        // Normal cycle time
        let telemetry = create_test_telemetry(50.0, 15.0);
        let threats = agent.analyze(&telemetry);
        let throughput_threats: Vec<_> = threats.iter()
            .filter(|t| matches!(t, Threat::ThroughputDegradation { issue, .. } if issue.contains("Cycle Time")))
            .collect();
        assert!(throughput_threats.is_empty(), "Normal cycle time should not trigger");

        // Slow cycle time
        let telemetry = create_test_telemetry(50.0, 25.0);  // Above 20ms
        let threats = agent.analyze(&telemetry);
        let throughput_threats: Vec<_> = threats.iter()
            .filter(|t| matches!(t, Threat::ThroughputDegradation { issue, .. } if issue.contains("Cycle Time")))
            .collect();
        assert!(!throughput_threats.is_empty(), "Slow cycle time should trigger alert");
    }

    #[test]
    fn test_oee_calculation() {
        let config = AssemblyConfig::default();
        let mut agent = AssemblySentinel::new(config);

        // Add some bond times
        for _ in 0..10 {
            let telemetry = create_test_telemetry(50.0, 15.0);  // 15ms = 100% performance
            agent.analyze(&telemetry);
        }

        let oee = agent.calculate_oee();
        assert!((oee - 1.0).abs() < 0.01, "OEE should be ~100% with 15ms cycle time");

        // Now add slower bonds
        let mut agent2 = AssemblySentinel::new(config);
        for _ in 0..10 {
            let telemetry = create_test_telemetry(50.0, 20.0);  // 20ms = 75% performance
            agent2.analyze(&telemetry);
        }

        let oee2 = agent2.calculate_oee();
        assert!(oee2 < 0.8, "OEE should be below 80% with 20ms cycle time");
    }

    #[test]
    fn test_safety_circuit_nsop() {
        let config = AssemblyConfig::default();
        let agent = AssemblySentinel::new(config);

        let nsop_threat = Threat::QualityDefect {
            machine_id: "BOND-01".to_string(),
            defect_type: "NSOP (Non-Stick on Pad)".to_string(),
            confidence: 0.99,
            severity: Severity::Critical,
        };

        let (tier, action) = agent.safety_circuit(&nsop_threat);
        
        assert_eq!(tier, ResponseTier::Red, "NSOP should trigger Red tier");
        assert!(matches!(action, Action::FeedHold { .. }), "NSOP should trigger FeedHold");
    }

    #[test]
    fn test_safety_circuit_throughput() {
        let config = AssemblyConfig::default();
        let agent = AssemblySentinel::new(config);

        let throughput_threat = Threat::ThroughputDegradation {
            machine_id: "BOND-01".to_string(),
            issue: "Cycle Time Drift".to_string(),
            impact_oee: true,
            severity: Severity::Medium,
        };

        let (tier, action) = agent.safety_circuit(&throughput_threat);
        
        assert_eq!(tier, ResponseTier::Green, "Throughput issue should trigger Green tier");
        assert!(matches!(action, Action::AdjustParameter { .. }), "Should auto-adjust parameters");
    }
}
