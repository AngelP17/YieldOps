//! Assembly Sentinel - Packaging & Wire Bonding Agent
//!
//! Monitors Wire Bonders (K&S, ASM) and Die Attach.
//! Physics: Ultrasonic impedance, Capillary thermal expansion.
//! Protocol: SECS/GEM (Host Command Send S2F41)

use async_trait::async_trait;
use std::collections::VecDeque;
use tracing::info;

use crate::types::*;
use super::SentinelAgent;

/// Assembly Sentinel configuration
#[derive(Debug, Clone, Deserialize)]
pub struct AssemblyConfig {
    pub max_bond_time_ms: f64,
    pub min_shear_strength_g: f64,
    pub ultrasonic_impedance_limit: f64, // Ohms
    pub nsop_threshold: f64,             // Consecutive NSOP before feed hold
    pub target_oee: f64,                 // Overall Equipment Effectiveness target
    pub material_cte: f64,               // Capillary CTE (tungsten carbide ~5.5e-6)
    pub capillary_length_mm: f64,        // Capillary length for thermal expansion calc
}

impl Default for AssemblyConfig {
    fn default() -> Self {
        Self {
            max_bond_time_ms: 20.0,
            min_shear_strength_g: 8.0,
            ultrasonic_impedance_limit: 30.0,
            nsop_threshold: 3.0,
            target_oee: 0.85,
            material_cte: 5.5e-6,      // Tungsten carbide
            capillary_length_mm: 10.0,
        }
    }
}

/// Wire Bonding & Packaging Agent
pub struct AssemblySentinel {
    machine_id: String,
    config: AssemblyConfig,
    nsop_count: u32,                     // Consecutive NSOP counter
    bond_time_history: VecDeque<f64>,
    impedance_history: VecDeque<f64>,
    shear_strength_history: VecDeque<f64>,
}

impl AssemblySentinel {
    pub fn new(machine_id: String, config: AssemblyConfig) -> Self {
        Self {
            machine_id,
            config,
            nsop_count: 0,
            bond_time_history: VecDeque::with_capacity(100),
            impedance_history: VecDeque::with_capacity(100),
            shear_strength_history: VecDeque::with_capacity(100),
        }
    }
    
    pub fn from_config(yaml: serde_yaml::Value) -> Result<Self, AgentError> {
        let config: AssemblyConfig = serde_yaml::from_value(yaml.clone())
            .map_err(|e| AgentError::ConfigError(e.to_string()))?;
        let machine_id = yaml.get("machine_id")
            .and_then(|v| v.as_str())
            .unwrap_or("BOND-01")
            .to_string();
        Ok(Self::new(machine_id, config))
    }
    
    /// Detect "Non-Stick on Pad" (NSOP) via Impedance
    /// Physics: As the wire bonds to the pad, the mechanical impedance
    /// of the ultrasonic transducer changes. If it stays low, no bond formed.
    fn detect_bond_failure(&mut self, impedance: f64, bond_time: f64) -> Option<Threat> {
        // NSOP Detection: Low impedance indicates no bond formation
        if impedance < self.config.ultrasonic_impedance_limit {
            self.nsop_count += 1;
            
            if self.nsop_count >= self.config.nsop_threshold as u32 {
                // Reset counter after detection
                self.nsop_count = 0;
                Some(Threat::QualityDefect {
                    machine_id: self.machine_id.clone(),
                    defect_type: "NSOP (Non-Stick on Pad)".to_string(),
                    confidence: 0.98,
                    severity: Severity::Critical,
                })
            } else {
                // Still counting consecutive NSOPs
                None
            }
        } else {
            // Good bond - reset NSOP counter
            self.nsop_count = 0;
            
            // Check for slow cycle time (OEE impact)
            if bond_time > self.config.max_bond_time_ms {
                Some(Threat::ThroughputDegradation {
                    machine_id: self.machine_id.clone(),
                    issue: "Bond Cycle Time Drift".to_string(),
                    impact_oee: true,
                    severity: Severity::Medium,
                })
            } else {
                None
            }
        }
    }
    
    /// Detect weak bonds via shear strength
    fn detect_weak_bond(&self, shear_strength: f64) -> Option<Threat> {
        if shear_strength < self.config.min_shear_strength_g {
            Some(Threat::QualityDefect {
                machine_id: self.machine_id.clone(),
                defect_type: "Weak Bond (Low Shear)".to_string(),
                confidence: 0.95,
                severity: Severity::High,
            })
        } else {
            None
        }
    }
    
    /// Detect capillary thermal drift
    /// Physics: Capillary expands with temperature, changing bond placement
    fn detect_capillary_drift(&self, temp: f64, baseline_temp: f64) -> Option<Threat> {
        let temp_rise = temp - baseline_temp;
        let expansion_mm = self.config.material_cte * self.config.capillary_length_mm * temp_rise;
        
        // Alert if expansion exceeds 1µm (typical tolerance)
        if expansion_mm > 0.001 {
            Some(Threat::ThermalDrift {
                machine_id: self.machine_id.clone(),
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
    
    /// Detect ultrasonic generator degradation
    fn detect_usg_degradation(&self, impedance: f64) -> Option<Threat> {
        if self.impedance_history.len() < 20 {
            return None;
        }
        
        let baseline = self.impedance_history.iter()
            .take(20)
            .sum::<f64>() / 20.0;
        
        // If impedance drops significantly, USG may be failing
        if impedance < baseline * 0.7 {
            Some(Threat::EquipmentDegradation {
                machine_id: self.machine_id.clone(),
                component: "Ultrasonic_Generator".to_string(),
                metric: impedance,
                severity: Severity::High,
            })
        } else {
            None
        }
    }
    
    /// Calculate OEE (Overall Equipment Effectiveness)
    fn calculate_oee(&self) -> f64 {
        if self.bond_time_history.is_empty() {
            return 1.0;
        }
        
        let avg_cycle_time = self.bond_time_history.iter()
            .sum::<f64>() / self.bond_time_history.len() as f64;
        
        let theoretical_cycle_time = 15.0; // ms
        let performance = theoretical_cycle_time / avg_cycle_time;
        
        // Simplified OEE calculation
        performance.min(1.0)
    }
}

#[async_trait]
impl SentinelAgent for AssemblySentinel {
    fn analyze(&mut self, telemetry: &Telemetry) -> Vec<Threat> {
        let mut threats = Vec::new();
        
        let usg_imp = telemetry.metrics.get("usg_impedance").copied().unwrap_or(50.0);
        let bond_time = telemetry.metrics.get("bond_time_ms").copied().unwrap_or(15.0);
        let shear_strength = telemetry.metrics.get("shear_strength_g").copied().unwrap_or(10.0);
        let temp = telemetry.metrics.get("capillary_temp").copied().unwrap_or(25.0);
        
        // Update history
        self.bond_time_history.push_back(bond_time);
        if self.bond_time_history.len() > 100 {
            self.bond_time_history.pop_front();
        }
        
        self.impedance_history.push_back(usg_imp);
        if self.impedance_history.len() > 100 {
            self.impedance_history.pop_front();
        }
        
        self.shear_strength_history.push_back(shear_strength);
        if self.shear_strength_history.len() > 100 {
            self.shear_strength_history.pop_front();
        }
        
        // Run detectors
        if let Some(t) = self.detect_bond_failure(usg_imp, bond_time) {
            threats.push(t);
        }
        
        if let Some(t) = self.detect_weak_bond(shear_strength) {
            threats.push(t);
        }
        
        if let Some(t) = self.detect_capillary_drift(temp, 25.0) {
            threats.push(t);
        }
        
        if let Some(t) = self.detect_usg_degradation(usg_imp) {
            threats.push(t);
        }
        
        // Check OEE
        let oee = self.calculate_oee();
        if oee < self.config.target_oee {
            threats.push(Threat::ThroughputDegradation {
                machine_id: self.machine_id.clone(),
                issue: format!("OEE Below Target: {:.1}%", oee * 100.0),
                impact_oee: true,
                severity: Severity::Medium,
            });
        }
        
        threats
    }
    
    fn safety_circuit(&self, threat: &Threat) -> (ResponseTier, Action) {
        match threat {
            // NSOP is a Yield Hit -> FEED HOLD (stop wire feeding)
            Threat::QualityDefect { defect_type, .. } 
                if defect_type.contains("NSOP") => (
                ResponseTier::Red,
                Action::FeedHold {
                    reason: "Consecutive NSOP Defects Detected".to_string(),
                }
            ),
            // Weak bond -> Alert for inspection
            Threat::QualityDefect { .. } => (
                ResponseTier::Yellow,
                Action::CreateWorkOrder {
                    priority: "high".to_string(),
                    description: "Weak bond detected - inspect capillary".to_string(),
                    component: "Bonding_Capillary".to_string(),
                }
            ),
            // Slow cycle time -> AUTO-OPTIMIZE (GREEN ZONE)
            Threat::ThroughputDegradation { issue, .. } 
                if issue.contains("Cycle Time") => (
                ResponseTier::Green,
                Action::AdjustParameter {
                    parameter_name: "bond_force".to_string(),
                    new_value: 1.05, // Increase force slightly to aid bonding
                    unit: "percent".to_string(),
                }
            ),
            // USG degradation -> Schedule maintenance
            Threat::EquipmentDegradation { component, .. } 
                if component.contains("Ultrasonic") => (
                ResponseTier::Yellow,
                Action::ScheduleMaintenance {
                    component: "Ultrasonic_Generator".to_string(),
                    urgency: "next_shift".to_string(),
                    estimated_hours: 1.0,
                }
            ),
            // Thermal drift -> Compensate
            Threat::ThermalDrift { drift_mm, .. } if *drift_mm < 0.002 => (
                ResponseTier::Green,
                Action::AdjustParameter {
                    parameter_name: "z_offset".to_string(),
                    new_value: -*drift_mm * 1000.0, // Convert to µm
                    unit: "micrometers".to_string(),
                }
            ),
            // Significant thermal drift -> Alert
            Threat::ThermalDrift { .. } => (
                ResponseTier::Yellow,
                Action::SendAlert {
                    severity: Severity::Medium,
                    message: "Capillary thermal drift - check cooling".to_string(),
                    escalate_to: Some("Process_Engineer".to_string()),
                }
            ),
            _ => (ResponseTier::Green, Action::LogOnly),
        }
    }
    
    async fn execute(&self, action: &Action) -> Result<(), AgentError> {
        match action {
            Action::FeedHold { reason } => {
                // ASSEMBLY uses SECS/GEM (S2F41 - Host Command Send)
                info!(
                    "[SECS/GEM BRIDGE] Sending S2F41 STOP to {}: {}",
                    self.machine_id, reason
                );
                Ok(())
            }
            Action::AdjustParameter { parameter_name, new_value, unit } => {
                // SECS/GEM Remote Command
                info!(
                    "[SECS/GEM BRIDGE] S2F41 Remote Command to {}: {} = {} {}",
                    self.machine_id, parameter_name, new_value, unit
                );
                Ok(())
            }
            Action::CreateWorkOrder { description, component, .. } => {
                info!(
                    "[ASSEMBLY CMMS] Work order for {}: {}",
                    component, description
                );
                Ok(())
            }
            _ => Ok(()),
        }
    }
    
    fn metadata(&self) -> AgentMetadata {
        AgentMetadata {
            name: "Assembly Sentinel".to_string(),
            version: "2.1.0".to_string(),
            target_equipment: vec![
                "Wire Bonder".to_string(),
                "Die Attach".to_string(),
                "Flip Chip".to_string(),
            ],
            capabilities: vec![
                "NSOP Detection".to_string(),
                "USG Monitoring".to_string(),
                "Shear Strength Tracking".to_string(),
                "OEE Calculation".to_string(),
                "Capillary Thermal Compensation".to_string(),
            ],
        }
    }
    
    fn can_handle(&self, machine_id: &str) -> bool {
        self.machine_id == machine_id || 
        machine_id.starts_with("BOND-") ||
        machine_id.starts_with("ASM-")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_nsop_detection() {
        let mut agent = AssemblySentinel::new(
            "BOND-01".to_string(),
            AssemblyConfig::default(),
        );
        
        // Normal bonds
        for _ in 0..5 {
            let mut telemetry = Telemetry {
                timestamp: "2026-02-07T00:00:00Z".to_string(),
                machine_id: "BOND-01".to_string(),
                metrics: HashMap::new(),
                states: HashMap::new(),
            };
            telemetry.metrics.insert("usg_impedance".to_string(), 50.0);
            telemetry.metrics.insert("bond_time_ms".to_string(), 15.0);
            let threats = agent.analyze(&telemetry);
            assert!(threats.is_empty(), "Normal bonds should not trigger alerts");
        }
        
        // Consecutive NSOPs
        for _ in 0..3 {
            let mut telemetry = Telemetry {
                timestamp: "2026-02-07T00:01:00Z".to_string(),
                machine_id: "BOND-01".to_string(),
                metrics: HashMap::new(),
                states: HashMap::new(),
            };
            telemetry.metrics.insert("usg_impedance".to_string(), 20.0); // Below threshold
            telemetry.metrics.insert("bond_time_ms".to_string(), 15.0);
            let _ = agent.analyze(&telemetry);
        }
        
        // Third NSOP should trigger
        let mut telemetry = Telemetry {
            timestamp: "2026-02-07T00:02:00Z".to_string(),
            machine_id: "BOND-01".to_string(),
            metrics: HashMap::new(),
            states: HashMap::new(),
        };
        telemetry.metrics.insert("usg_impedance".to_string(), 20.0);
        telemetry.metrics.insert("bond_time_ms".to_string(), 15.0);
        let threats = agent.analyze(&telemetry);
        
        assert!(!threats.is_empty(), "Should detect NSOP after threshold");
        assert!(matches!(threats[0], Threat::QualityDefect { .. }));
    }
    
    #[test]
    fn test_weak_bond_detection() {
        let mut agent = AssemblySentinel::new(
            "BOND-01".to_string(),
            AssemblyConfig::default(),
        );
        
        let mut telemetry = Telemetry {
            timestamp: "2026-02-07T00:00:00Z".to_string(),
            machine_id: "BOND-01".to_string(),
            metrics: HashMap::new(),
            states: HashMap::new(),
        };
        
        // Weak shear strength
        telemetry.metrics.insert("shear_strength_g".to_string(), 5.0);
        telemetry.metrics.insert("usg_impedance".to_string(), 50.0);
        
        let threats = agent.analyze(&telemetry);
        assert!(!threats.is_empty(), "Should detect weak bond");
    }
}
