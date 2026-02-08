//! Facility Sentinel - Cleanroom & Infrastructure Agent
//!
//! Monitors FFU (Fan Filter Units), HVAC, and Chemical Delivery.
//! Physics: Bernoulli's principle for flow, ISO 14644 for particles.
//! Protocol: Modbus/BACnet (Building Automation)

use async_trait::async_trait;
use std::collections::VecDeque;
use tracing::info;

use crate::types::*;
use super::SentinelAgent;

/// Facility Sentinel configuration
#[derive(Debug, Clone, Deserialize)]
pub struct FacilityConfig {
    pub iso_class: u8,                  // e.g., Class 5 (ISO 14644-1)
    pub min_airflow_velocity: f64,      // m/s (typically 0.45)
    pub max_filter_pressure_drop: f64,  // Pascals (Pa)
    pub chemical_leak_threshold: f64,   // ppm
    pub material_cte: f64,              // Coefficient of Thermal Expansion
    pub spindle_length_mm: f64,         // Distance from bearing to tool tip
}

impl Default for FacilityConfig {
    fn default() -> Self {
        Self {
            iso_class: 5,
            min_airflow_velocity: 0.45,
            max_filter_pressure_drop: 250.0,
            chemical_leak_threshold: 10.0,
            material_cte: 11.7e-6,      // Steel default
            spindle_length_mm: 500.0,
        }
    }
}

/// Cleanroom & Infrastructure Agent
pub struct FacilitySentinel {
    agent_id: String,
    config: FacilityConfig,
    pressure_history: VecDeque<f64>,
    particle_history: VecDeque<f64>,
    airflow_history: VecDeque<f64>,
}

impl FacilitySentinel {
    pub fn new(agent_id: String, config: FacilityConfig) -> Self {
        Self {
            agent_id,
            config,
            pressure_history: VecDeque::with_capacity(100),
            particle_history: VecDeque::with_capacity(100),
            airflow_history: VecDeque::with_capacity(100),
        }
    }
    
    pub fn from_config(yaml: serde_yaml::Value) -> Result<Self, AgentError> {
        let config: FacilityConfig = serde_yaml::from_value(yaml.clone())
            .map_err(|e| AgentError::ConfigError(e.to_string()))?;
        let agent_id = yaml.get("machine_id")
            .and_then(|v| v.as_str())
            .unwrap_or("FAC-001")
            .to_string();
        Ok(Self::new(agent_id, config))
    }
    
    /// Detect HEPA Filter Clogging (Fluid Dynamics)
    /// Physics: Darcy-Weisbach equation variant.
    /// As filter loads, dP increases for same Flow (Q).
    fn detect_filter_clog(&self, pressure_drop_pa: f64, airflow_mps: f64) -> Option<Threat> {
        // Normalizing pressure drop against airflow (P/Q)
        let impedance = if airflow_mps > 0.0 {
            pressure_drop_pa / airflow_mps
        } else {
            0.0
        };
        
        // Track historical impedance for trend analysis
        let baseline_impedance = if !self.pressure_history.is_empty() {
            self.pressure_history.iter().sum::<f64>() / self.pressure_history.len() as f64
        } else {
            100.0 // Default baseline
        };
        
        // Alert if pressure exceeds threshold or impedance increases significantly
        if pressure_drop_pa > self.config.max_filter_pressure_drop {
            Some(Threat::FacilityIntegrity {
                unit_id: self.agent_id.clone(),
                issue: "HEPA Filter End-of-Life".to_string(),
                severity: Severity::High,
                metric: pressure_drop_pa,
            })
        } else if impedance > baseline_impedance * 1.5 {
            Some(Threat::FacilityIntegrity {
                unit_id: self.agent_id.clone(),
                issue: "Filter Loading Detected".to_string(),
                severity: Severity::Medium,
                metric: impedance,
            })
        } else {
            None
        }
    }
    
    /// Detect ISO Class Violation (Particle Physics)
    /// ISO 14644-1 Formula: Cn = 10^N * (0.1/D)^2.08
    fn detect_contamination(&self, particle_count_0_5um: f64) -> Option<Threat> {
        // Limit for ISO Class 5 at 0.5µm is ~3,520 particles/m^3
        let iso_multiplier = match self.config.iso_class {
            1 => 10.0_f64,
            2 => 100.0,
            3 => 1_000.0,
            4 => 10_000.0,
            5 => 100_000.0,
            6 => 1_000_000.0,
            7 => 10_000_000.0,
            8 => 100_000_000.0,
            9 => 1_000_000_000.0,
            _ => 100_000.0, // Default to Class 5
        };
        
        let limit = iso_multiplier * (0.1_f64 / 0.5_f64).powf(2.08);
        
        if particle_count_0_5um > limit {
            Some(Threat::Contamination {
                zone_id: self.agent_id.clone(),
                particle_count: particle_count_0_5um,
                limit,
                severity: Severity::Critical, // Yield killer!
            })
        } else if particle_count_0_5um > limit * 0.8 {
            // Warning at 80% of limit
            Some(Threat::Contamination {
                zone_id: self.agent_id.clone(),
                particle_count: particle_count_0_5um,
                limit,
                severity: Severity::High,
            })
        } else {
            None
        }
    }
    
    /// Detect airflow velocity drop (FFU failure)
    fn detect_airflow_failure(&self, airflow_mps: f64) -> Option<Threat> {
        if airflow_mps < self.config.min_airflow_velocity * 0.8 {
            Some(Threat::FacilityIntegrity {
                unit_id: self.agent_id.clone(),
                issue: "FFU Airflow Failure".to_string(),
                severity: Severity::Critical,
                metric: airflow_mps,
            })
        } else {
            None
        }
    }
    
    /// Detect chemical leak
    fn detect_chemical_leak(&self, ppm: f64) -> Option<Threat> {
        if ppm > self.config.chemical_leak_threshold {
            Some(Threat::ChemicalLeak {
                zone_id: self.agent_id.clone(),
                concentration_ppm: ppm,
                severity: if ppm > self.config.chemical_leak_threshold * 2.0 {
                    Severity::Critical
                } else {
                    Severity::High
                },
            })
        } else {
            None
        }
    }
}

#[async_trait]
impl SentinelAgent for FacilitySentinel {
    fn analyze(&mut self, telemetry: &Telemetry) -> Vec<Threat> {
        let mut threats = Vec::new();
        
        let pressure = telemetry.metrics.get("pressure_diff_pa").copied().unwrap_or(0.0);
        let airflow = telemetry.metrics.get("airflow_mps").copied().unwrap_or(0.45);
        let particles = telemetry.metrics.get("particles_0_5um").copied().unwrap_or(0.0);
        let chemical_ppm = telemetry.metrics.get("chemical_ppm").copied().unwrap_or(0.0);
        
        // Update history
        self.pressure_history.push_back(pressure);
        if self.pressure_history.len() > 100 {
            self.pressure_history.pop_front();
        }
        
        self.airflow_history.push_back(airflow);
        if self.airflow_history.len() > 100 {
            self.airflow_history.pop_front();
        }
        
        self.particle_history.push_back(particles);
        if self.particle_history.len() > 100 {
            self.particle_history.pop_front();
        }
        
        // Run detectors
        if let Some(t) = self.detect_filter_clog(pressure, airflow) {
            threats.push(t);
        }
        
        if let Some(t) = self.detect_contamination(particles) {
            threats.push(t);
        }
        
        if let Some(t) = self.detect_airflow_failure(airflow) {
            threats.push(t);
        }
        
        if let Some(t) = self.detect_chemical_leak(chemical_ppm) {
            threats.push(t);
        }
        
        threats
    }
    
    fn safety_circuit(&self, threat: &Threat) -> (ResponseTier, Action) {
        match threat {
            // Contamination is Critical -> RED ZONE
            Threat::Contamination { severity: Severity::Critical, .. } => (
                ResponseTier::Red,
                Action::SendAlert {
                    severity: Severity::Critical,
                    message: "ISO CLASS VIOLATION - STOP WAFER LOADING".to_string(),
                    escalate_to: Some("Process_Engineering".to_string()),
                }
            ),
            // High contamination -> YELLOW ZONE
            Threat::Contamination { .. } => (
                ResponseTier::Yellow,
                Action::CreateWorkOrder {
                    priority: "high".to_string(),
                    description: "Particle count elevated - investigate source".to_string(),
                    component: "FFU_System".to_string(),
                }
            ),
            // Chemical leak -> RED ZONE (safety)
            Threat::ChemicalLeak { severity: Severity::Critical, .. } => (
                ResponseTier::Red,
                Action::EmergencyStop
            ),
            // Filter Clog is Maintenance -> YELLOW ZONE
            Threat::FacilityIntegrity { issue, .. } if issue.contains("End-of-Life") => (
                ResponseTier::Yellow,
                Action::CreateWorkOrder {
                    priority: "medium".to_string(),
                    description: "HEPA Filter dP High - Schedule Replacement".to_string(),
                    component: "FFU_Filter".to_string(),
                }
            ),
            // Airflow failure -> RED ZONE
            Threat::FacilityIntegrity { issue, .. } if issue.contains("Airflow Failure") => (
                ResponseTier::Red,
                Action::SendAlert {
                    severity: Severity::Critical,
                    message: "CRITICAL: FFU Airflow Failure - Stop Production".to_string(),
                    escalate_to: Some("Facilities_Manager".to_string()),
                }
            ),
            _ => (ResponseTier::Green, Action::LogOnly),
        }
    }
    
    async fn execute(&self, action: &Action) -> Result<(), AgentError> {
        match action {
            Action::AdjustParameter { parameter_name, new_value, .. } => {
                // FACILITY uses MODBUS, not SECS/GEM
                info!(
                    "[MODBUS BRIDGE] Writing Register 4001 ({}): {}",
                    parameter_name, new_value
                );
                Ok(())
            }
            Action::CreateWorkOrder { description, component, .. } => {
                info!(
                    "[FACILITY CMMS] Creating work order for {}: {}",
                    component, description
                );
                Ok(())
            }
            Action::SendAlert { message, escalate_to, .. } => {
                info!(
                    "[FACILITY ALERT] {} - Escalate to: {:?}",
                    message, escalate_to
                );
                Ok(())
            }
            _ => Ok(()),
        }
    }
    
    fn metadata(&self) -> AgentMetadata {
        AgentMetadata {
            name: "Facility Sentinel".to_string(),
            version: "1.2.0".to_string(),
            target_equipment: vec![
                "FFU".to_string(),
                "HVAC".to_string(),
                "Scrubber".to_string(),
                "Chemical Delivery".to_string(),
            ],
            capabilities: vec![
                "ISO 14644 Compliance".to_string(),
                "Filter Life Prediction".to_string(),
                "Particle Monitoring".to_string(),
                "Chemical Leak Detection".to_string(),
            ],
        }
    }
    
    fn can_handle(&self, machine_id: &str) -> bool {
        self.agent_id == machine_id || machine_id.starts_with("FAC-")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_contamination_detection() {
        let mut agent = FacilitySentinel::new(
            "FAC-001".to_string(),
            FacilityConfig::default(),
        );
        
        // Simulate normal operation
        let mut telemetry = Telemetry {
            timestamp: "2026-02-07T00:00:00Z".to_string(),
            machine_id: "FAC-001".to_string(),
            metrics: HashMap::new(),
            states: HashMap::new(),
        };
        
        // Normal particle count for ISO 5
        telemetry.metrics.insert("particles_0_5um".to_string(), 1000.0);
        let threats = agent.analyze(&telemetry);
        assert!(threats.is_empty(), "Should not detect contamination at normal levels");
        
        // Violation level
        telemetry.metrics.insert("particles_0_5um".to_string(), 5000.0);
        let threats = agent.analyze(&telemetry);
        assert!(!threats.is_empty(), "Should detect contamination violation");
        assert!(matches!(threats[0], Threat::Contamination { .. }));
    }
    
    #[test]
    fn test_filter_clog_detection() {
        let mut agent = FacilitySentinel::new(
            "FAC-001".to_string(),
            FacilityConfig::default(),
        );
        
        // Build baseline history
        for _ in 0..50 {
            let mut telemetry = Telemetry {
                timestamp: "2026-02-07T00:00:00Z".to_string(),
                machine_id: "FAC-001".to_string(),
                metrics: HashMap::new(),
                states: HashMap::new(),
            };
            telemetry.metrics.insert("pressure_diff_pa".to_string(), 150.0);
            telemetry.metrics.insert("airflow_mps".to_string(), 0.45);
            agent.analyze(&telemetry);
        }
        
        // High pressure drop
        let mut telemetry = Telemetry {
            timestamp: "2026-02-07T00:01:00Z".to_string(),
            machine_id: "FAC-001".to_string(),
            metrics: HashMap::new(),
            states: HashMap::new(),
        };
        telemetry.metrics.insert("pressure_diff_pa".to_string(), 300.0);
        telemetry.metrics.insert("airflow_mps".to_string(), 0.45);
        
        let threats = agent.analyze(&telemetry);
        assert!(!threats.is_empty(), "Should detect filter clog");
    }
}
