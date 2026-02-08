//! Precision Sentinel - CNC Machining Agent
//!
//! Detects and prevents failures in CNC machines, mills, and lathes.
//! Focuses on tool breakage prevention, thermal drift compensation,
//! and surface finish optimization.

use super::*;
use std::collections::VecDeque;

/// Precision Sentinel configuration
#[derive(Debug, Clone, Deserialize)]
pub struct PrecisionConfig {
    pub vibration_critical: f64,        // mm/s - ISO 10816 Category D threshold
    pub thermal_drift_max: f64,         // mm - Maximum allowable drift
    pub tool_wear_threshold: f64,       // % load increase indicating wear
    pub chatter_detection_enabled: bool,
    pub thermal_comp_enabled: bool,
    pub tool_wear_tracking_enabled: bool,
}

impl Default for PrecisionConfig {
    fn default() -> Self {
        Self {
            vibration_critical: 10.0,
            thermal_drift_max: 0.05,
            tool_wear_threshold: 0.15,
            chatter_detection_enabled: true,
            thermal_comp_enabled: true,
            tool_wear_tracking_enabled: true,
        }
    }
}

/// CNC Machining Agent
pub struct PrecisionSentinel {
    machine_id: String,
    config: PrecisionConfig,
    
    // Detection state
    vibration_history: VecDeque<f64>,
    temp_history: VecDeque<f64>,
    load_history: VecDeque<f64>,
    
    // Baselines
    baseline_load: Option<f64>,
    baseline_temp: f64,
}

impl PrecisionSentinel {
    pub fn new(machine_id: String, config: PrecisionConfig) -> Self {
        Self {
            machine_id,
            config,
            vibration_history: VecDeque::with_capacity(100),
            temp_history: VecDeque::with_capacity(100),
            load_history: VecDeque::with_capacity(100),
            baseline_load: None,
            baseline_temp: 20.0,
        }
    }
    
    pub fn from_config(yaml: serde_yaml::Value) -> Result<Self, AgentError> {
        let config: PrecisionConfig = serde_yaml::from_value(yaml.clone())
            .map_err(|e| AgentError::ConfigError(e.to_string()))?;
        
        let machine_id = yaml.get("machine_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::ConfigError("Missing machine_id".to_string()))?
            .to_string();
        
        Ok(Self::new(machine_id, config))
    }
    
    /// Detect chatter (regenerative vibration)
    fn detect_chatter(&self, vibration: f64) -> Option<Threat> {
        if !self.config.chatter_detection_enabled {
            return None;
        }
        
        if self.vibration_history.is_empty() {
            return None;
        }
        
        // Simplified chatter detection (production would use FFT)
        let baseline = self.vibration_history.iter()
            .copied()
            .sum::<f64>() / self.vibration_history.len() as f64;
        
        if vibration > baseline * 3.0 {
            Some(Threat::Chatter {
                machine_id: self.machine_id.clone(),
                frequency_hz: 0.0,  // TODO: FFT analysis
                amplitude_mm_s: vibration,
                severity: if vibration > self.config.vibration_critical {
                    Severity::Critical
                } else {
                    Severity::High
                },
            })
        } else {
            None
        }
    }
    
    /// Detect thermal drift
    fn detect_thermal_drift(&self, temp: f64) -> Option<Threat> {
        if !self.config.thermal_comp_enabled {
            return None;
        }
        
        // Thermal expansion: ΔL = α * L * ΔT
        let cte_steel = 11.7e-6;  // Coefficient of thermal expansion
        let spindle_distance = 500.0;  // mm from spindle to part
        
        let temp_rise = temp - self.baseline_temp;
        let drift_mm = cte_steel * spindle_distance * temp_rise;
        
        if drift_mm.abs() > self.config.thermal_drift_max {
            Some(Threat::ThermalDrift {
                machine_id: self.machine_id.clone(),
                drift_mm,
                axis: "Z".to_string(),
                severity: if drift_mm.abs() > 0.1 {
                    Severity::Critical
                } else {
                    Severity::High
                },
            })
        } else {
            None
        }
    }
    
    /// Detect tool wear
    fn detect_tool_wear(&self, load_percent: f64) -> Option<Threat> {
        if !self.config.tool_wear_tracking_enabled {
            return None;
        }
        
        let baseline = self.baseline_load?;
        let wear = (load_percent - baseline) / baseline;
        
        if wear > self.config.tool_wear_threshold {
            Some(Threat::ToolWear {
                machine_id: self.machine_id.clone(),
                wear_percent: wear * 100.0,
                remaining_life_minutes: Some(60.0 * (0.25 - wear) / 0.01),  // Rough estimate
                severity: if wear > 0.25 {
                    Severity::Critical
                } else {
                    Severity::High
                },
            })
        } else {
            None
        }
    }
    
    /// Detect thermal runaway
    fn detect_thermal_runaway(&self, temp: f64) -> Option<Threat> {
        if self.temp_history.len() < 10 {
            return None;
        }
        
        // Calculate rate of change (per minute)
        let recent_temps: Vec<f64> = self.temp_history.iter().rev().take(10).copied().collect();
        let roc = (recent_temps[0] - recent_temps[recent_temps.len() - 1]) * 6.0; // per minute
        
        if temp > 95.0 || (temp > 80.0 && roc > 5.0) {
            Some(Threat::ThermalRunaway {
                machine_id: self.machine_id.clone(),
                temperature: temp,
                rate_of_change: roc,
                severity: if temp > 100.0 { Severity::Critical } else { Severity::High },
            })
        } else {
            None
        }
    }
    
    /// Detect bearing failure signature
    fn detect_bearing_failure(&self, vibration: f64) -> Option<Threat> {
        // ISO 10816 thresholds
        let warning_threshold = 0.02;  // mm/s RMS
        let critical_threshold = 0.05; // mm/s RMS
        
        if vibration > critical_threshold {
            Some(Threat::BearingFailure {
                machine_id: self.machine_id.clone(),
                vibration_mm_s: vibration,
                frequency_hz: 0.0,  // TODO: FFT for bearing frequencies
                severity: Severity::Critical,
            })
        } else if vibration > warning_threshold {
            Some(Threat::BearingFailure {
                machine_id: self.machine_id.clone(),
                vibration_mm_s: vibration,
                frequency_hz: 0.0,
                severity: Severity::High,
            })
        } else {
            None
        }
    }
}

#[async_trait]
impl SentinelAgent for PrecisionSentinel {
    fn analyze(&mut self, telemetry: &Telemetry) -> Vec<Threat> {
        let mut threats = Vec::new();
        
        // Extract metrics
        let vibration = telemetry.metrics.get("vibration").copied().unwrap_or(0.0);
        let temp = telemetry.metrics.get("temperature").copied().unwrap_or(20.0);
        let load = telemetry.metrics.get("load_percent").copied().unwrap_or(0.0);
        
        // Update history
        self.vibration_history.push_back(vibration);
        if self.vibration_history.len() > 100 {
            self.vibration_history.pop_front();
        }
        
        self.temp_history.push_back(temp);
        if self.temp_history.len() > 100 {
            self.temp_history.pop_front();
        }
        
        self.load_history.push_back(load);
        if self.load_history.len() > 100 {
            self.load_history.pop_front();
        }
        
        // Set baseline on first stable data
        if self.baseline_load.is_none() && self.load_history.len() > 50 {
            self.baseline_load = Some(
                self.load_history.iter().sum::<f64>() / self.load_history.len() as f64
            );
        }
        
        // Run detectors
        if let Some(threat) = self.detect_chatter(vibration) {
            threats.push(threat);
        }
        
        if let Some(threat) = self.detect_thermal_drift(temp) {
            threats.push(threat);
        }
        
        if let Some(threat) = self.detect_tool_wear(load) {
            threats.push(threat);
        }
        
        if let Some(threat) = self.detect_thermal_runaway(temp) {
            threats.push(threat);
        }
        
        if let Some(threat) = self.detect_bearing_failure(vibration) {
            threats.push(threat);
        }
        
        threats
    }
    
    fn safety_circuit(&self, threat: &Threat) -> (ResponseTier, Action) {
        match threat {
            Threat::Chatter { amplitude_mm_s, severity, .. } => {
                if *amplitude_mm_s < 5.0 {
                    // GREEN: Small vibration, safe to adjust RPM
                    (ResponseTier::Green, Action::AdjustParameter {
                        parameter_name: "spindle_rpm".to_string(),
                        new_value: 0.95,  // -5% to break resonance
                        unit: "percent".to_string(),
                    })
                } else if *severity == Severity::Critical {
                    // RED: Critical vibration, crash imminent
                    (ResponseTier::Red, Action::SendAlert {
                        severity: Severity::Critical,
                        message: "CRASH SIGNATURE DETECTED - MANUAL STOP REQUIRED".to_string(),
                        escalate_to: Some("production_manager".to_string()),
                    })
                } else {
                    // YELLOW: Significant vibration, propose feed reduction
                    (ResponseTier::Yellow, Action::ReduceSpeed {
                        percent_reduction: 20,
                    })
                }
            },
            
            Threat::ThermalDrift { drift_mm, severity, .. } => {
                if drift_mm.abs() < 0.02 {
                    // GREEN: Small drift, apply compensation
                    (ResponseTier::Green, Action::AdjustParameter {
                        parameter_name: "z_axis_offset".to_string(),
                        new_value: -*drift_mm,
                        unit: "mm".to_string(),
                    })
                } else {
                    // YELLOW: Significant drift, propose thermal stabilization
                    (ResponseTier::Yellow, Action::CreateWorkOrder {
                        priority: "high".to_string(),
                        description: format!("Thermal drift: {:.3}mm - Run stabilization cycle", drift_mm),
                        component: "spindle".to_string(),
                    })
                }
            },
            
            Threat::ToolWear { wear_percent, severity, .. } => {
                if *wear_percent < 20.0 {
                    // GREEN: Log tool life
                    (ResponseTier::Green, Action::CreateWorkOrder {
                        priority: "low".to_string(),
                        description: format!("Tool wear at {:.1}% - plan replacement", wear_percent),
                        component: "cutting_tool".to_string(),
                    })
                } else {
                    // YELLOW: High wear, propose tool change
                    (ResponseTier::Yellow, Action::ScheduleMaintenance {
                        component: "cutting_tool".to_string(),
                        urgency: "next_safe_stop".to_string(),
                        estimated_hours: 0.25,
                    })
                }
            },
            
            Threat::ThermalRunaway { temperature, .. } => {
                if *temperature > 100.0 {
                    // RED: Emergency stop required
                    (ResponseTier::Red, Action::EmergencyStop)
                } else {
                    // YELLOW: Reduce thermal load
                    (ResponseTier::Yellow, Action::ReduceSpeed {
                        percent_reduction: 50,
                    })
                }
            },
            
            Threat::BearingFailure { severity, .. } => {
                if *severity == Severity::Critical {
                    // RED: Bearing failure imminent
                    (ResponseTier::Red, Action::SendAlert {
                        severity: Severity::Critical,
                        message: "CRITICAL BEARING FAILURE - STOP MACHINE IMMEDIATELY".to_string(),
                        escalate_to: Some("maintenance_supervisor".to_string()),
                    })
                } else {
                    // YELLOW: Schedule inspection
                    (ResponseTier::Yellow, Action::ScheduleMaintenance {
                        component: "spindle_bearing".to_string(),
                        urgency: "within_24h".to_string(),
                        estimated_hours: 2.0,
                    })
                }
            },
            
            _ => (ResponseTier::Red, Action::SendAlert {
                severity: Severity::Medium,
                message: "Unknown threat type".to_string(),
                escalate_to: None,
            }),
        }
    }
    
    async fn execute(&self, action: &Action) -> Result<(), AgentError> {
        match action {
            Action::AdjustParameter { parameter_name, new_value, .. } => {
                tracing::info!("Executing: Adjust {} to {}", parameter_name, new_value);
                Ok(())
            }
            Action::CreateWorkOrder { description, .. } => {
                tracing::info!("Creating work order: {}", description);
                Ok(())
            }
            Action::ReduceSpeed { percent_reduction } => {
                tracing::info!("Reducing speed by {}%", percent_reduction);
                Ok(())
            }
            Action::EmergencyStop => {
                tracing::warn!("EMERGENCY STOP EXECUTED");
                Ok(())
            }
            Action::SendAlert { message, .. } => {
                tracing::warn!("ALERT: {}", message);
                Ok(())
            }
            Action::ScheduleMaintenance { component, .. } => {
                tracing::info!("Scheduling maintenance for {}", component);
                Ok(())
            }
            Action::LogOnly => {
                tracing::info!("[PRECISION] Logging event only");
                Ok(())
            }
            Action::FeedHold { reason } => {
                tracing::info!("[PRECISION] Feed hold: {}", reason);
                Ok(())
            }
        }
    }
    
    fn metadata(&self) -> AgentMetadata {
        AgentMetadata {
            name: "Precision Sentinel".to_string(),
            version: "1.0.0".to_string(),
            target_equipment: vec![
                "CNC Mill".to_string(),
                "CNC Lathe".to_string(),
                "Machining Center".to_string(),
            ],
            capabilities: vec![
                "Chatter Detection".to_string(),
                "Thermal Drift Compensation".to_string(),
                "Tool Wear Tracking".to_string(),
                "Bearing Failure Detection".to_string(),
                "Thermal Runaway Protection".to_string(),
            ],
        }
    }
    
    fn can_handle(&self, machine_id: &str) -> bool {
        self.machine_id == machine_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_chatter_detection() {
        let mut agent = PrecisionSentinel::new(
            "TEST-001".to_string(),
            PrecisionConfig::default(),
        );
        
        // Simulate normal operation
        for _ in 0..50 {
            let mut telemetry = Telemetry {
                timestamp: "2026-02-07T00:00:00Z".to_string(),
                machine_id: "TEST-001".to_string(),
                metrics: HashMap::new(),
                states: HashMap::new(),
            };
            telemetry.metrics.insert("vibration".to_string(), 0.001);
            telemetry.metrics.insert("temperature".to_string(), 65.0);
            telemetry.metrics.insert("load_percent".to_string(), 60.0);
            
            agent.analyze(&telemetry);
        }
        
        // Inject chatter
        let mut telemetry = Telemetry {
            timestamp: "2026-02-07T00:01:00Z".to_string(),
            machine_id: "TEST-001".to_string(),
            metrics: HashMap::new(),
            states: HashMap::new(),
        };
        telemetry.metrics.insert("vibration".to_string(), 0.015);  // 15x baseline
        telemetry.metrics.insert("temperature".to_string(), 65.0);
        telemetry.metrics.insert("load_percent".to_string(), 60.0);
        
        let threats = agent.analyze(&telemetry);
        
        assert!(!threats.is_empty(), "Should detect chatter");
        assert!(matches!(threats[0], Threat::Chatter { .. }));
    }
}
