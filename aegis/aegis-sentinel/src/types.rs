//! Core types for Aegis Sentinel

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Machine telemetry data point
#[derive(Debug, Clone, Deserialize)]
pub struct Telemetry {
    pub timestamp: String,
    pub machine_id: String,
    pub metrics: HashMap<String, f64>,
    pub states: HashMap<String, String>,
}

/// Threat types detected by agents
#[derive(Debug, Clone)]
pub enum Threat {
    /// Chatter vibration in machining
    Chatter {
        machine_id: String,
        frequency_hz: f64,
        amplitude_mm_s: f64,
        severity: Severity,
    },
    /// Thermal drift affecting precision
    ThermalDrift {
        machine_id: String,
        drift_mm: f64,
        axis: String,
        severity: Severity,
    },
    /// Tool wear detected
    ToolWear {
        machine_id: String,
        wear_percent: f64,
        remaining_life_minutes: Option<f64>,
        severity: Severity,
    },
    /// Thermal runaway condition
    ThermalRunaway {
        machine_id: String,
        temperature: f64,
        rate_of_change: f64,
        severity: Severity,
    },
    /// Bearing failure signature
    BearingFailure {
        machine_id: String,
        vibration_mm_s: f64,
        frequency_hz: f64,
        severity: Severity,
    },
    /// Coolant system failure
    CoolantFailure {
        machine_id: String,
        flow_rate: f64,
        temperature: f64,
        severity: Severity,
    },
    /// Facility integrity issue (FFU, HVAC, etc.)
    FacilityIntegrity {
        unit_id: String,
        issue: String,
        severity: Severity,
        metric: f64,
    },
    /// Cleanroom contamination (ISO 14644)
    Contamination {
        zone_id: String,
        particle_count: f64,
        limit: f64,
        severity: Severity,
    },
    /// Chemical leak detection
    ChemicalLeak {
        zone_id: String,
        concentration_ppm: f64,
        severity: Severity,
    },
    /// Quality defect (NSOP, weak bonds, etc.)
    QualityDefect {
        machine_id: String,
        defect_type: String,
        confidence: f64,
        severity: Severity,
    },
    /// Throughput degradation / OEE impact
    ThroughputDegradation {
        machine_id: String,
        issue: String,
        impact_oee: bool,
        severity: Severity,
    },
    /// Equipment degradation (USG, etc.)
    EquipmentDegradation {
        machine_id: String,
        component: String,
        metric: f64,
        severity: Severity,
    },
    /// Generic anomaly
    Anomaly {
        machine_id: String,
        description: String,
        severity: Severity,
    },
}

impl Threat {
    pub fn machine_id(&self) -> &str {
        match self {
            Threat::Chatter { machine_id, .. } => machine_id,
            Threat::ThermalDrift { machine_id, .. } => machine_id,
            Threat::ToolWear { machine_id, .. } => machine_id,
            Threat::ThermalRunaway { machine_id, .. } => machine_id,
            Threat::BearingFailure { machine_id, .. } => machine_id,
            Threat::CoolantFailure { machine_id, .. } => machine_id,
            Threat::FacilityIntegrity { unit_id, .. } => unit_id,
            Threat::Contamination { zone_id, .. } => zone_id,
            Threat::ChemicalLeak { zone_id, .. } => zone_id,
            Threat::QualityDefect { machine_id, .. } => machine_id,
            Threat::ThroughputDegradation { machine_id, .. } => machine_id,
            Threat::EquipmentDegradation { machine_id, .. } => machine_id,
            Threat::Anomaly { machine_id, .. } => machine_id,
        }
    }

    pub fn severity(&self) -> Severity {
        match self {
            Threat::Chatter { severity, .. } => *severity,
            Threat::ThermalDrift { severity, .. } => *severity,
            Threat::ToolWear { severity, .. } => *severity,
            Threat::ThermalRunaway { severity, .. } => *severity,
            Threat::BearingFailure { severity, .. } => *severity,
            Threat::CoolantFailure { severity, .. } => *severity,
            Threat::FacilityIntegrity { severity, .. } => *severity,
            Threat::Contamination { severity, .. } => *severity,
            Threat::ChemicalLeak { severity, .. } => *severity,
            Threat::QualityDefect { severity, .. } => *severity,
            Threat::ThroughputDegradation { severity, .. } => *severity,
            Threat::EquipmentDegradation { severity, .. } => *severity,
            Threat::Anomaly { severity, .. } => *severity,
        }
    }

    pub fn threat_type(&self) -> &'static str {
        match self {
            Threat::Chatter { .. } => "Chatter",
            Threat::ThermalDrift { .. } => "ThermalDrift",
            Threat::ToolWear { .. } => "ToolWear",
            Threat::ThermalRunaway { .. } => "ThermalRunaway",
            Threat::BearingFailure { .. } => "BearingFailure",
            Threat::CoolantFailure { .. } => "CoolantFailure",
            Threat::FacilityIntegrity { .. } => "FacilityIntegrity",
            Threat::Contamination { .. } => "Contamination",
            Threat::ChemicalLeak { .. } => "ChemicalLeak",
            Threat::QualityDefect { .. } => "QualityDefect",
            Threat::ThroughputDegradation { .. } => "ThroughputDegradation",
            Threat::EquipmentDegradation { .. } => "EquipmentDegradation",
            Threat::Anomaly { .. } => "Anomaly",
        }
    }
}

/// Threat severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

/// Safety Circuit response tiers
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResponseTier {
    /// Auto-execute (low risk)
    Green,
    /// Approval required (medium risk)
    Yellow,
    /// Alert only (high risk)
    Red,
}

/// Actions that can be taken by agents
#[derive(Debug, Clone)]
pub enum Action {
    /// Adjust a machine parameter
    AdjustParameter {
        parameter_name: String,
        new_value: f64,
        unit: String,
    },
    /// Reduce spindle speed
    ReduceSpeed {
        percent_reduction: u8,
    },
    /// Emergency stop
    EmergencyStop,
    /// Feed hold (pause wire feeding, etc.)
    FeedHold {
        reason: String,
    },
    /// Create maintenance work order
    CreateWorkOrder {
        priority: String,
        description: String,
        component: String,
    },
    /// Schedule maintenance
    ScheduleMaintenance {
        component: String,
        urgency: String,
        estimated_hours: f64,
    },
    /// Send alert notification
    SendAlert {
        severity: Severity,
        message: String,
        escalate_to: Option<String>,
    },
    /// Log only (no action)
    LogOnly,
}

impl Action {
    pub fn name(&self) -> &'static str {
        match self {
            Action::AdjustParameter { .. } => "AdjustParameter",
            Action::ReduceSpeed { .. } => "ReduceSpeed",
            Action::EmergencyStop => "EmergencyStop",
            Action::FeedHold { .. } => "FeedHold",
            Action::CreateWorkOrder { .. } => "CreateWorkOrder",
            Action::ScheduleMaintenance { .. } => "ScheduleMaintenance",
            Action::SendAlert { .. } => "SendAlert",
            Action::LogOnly => "LogOnly",
        }
    }
}

/// Command sent to machines
#[derive(Debug, Clone, Serialize)]
pub struct Command {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
}

/// Incident record for dashboard
#[derive(Debug, Clone, Serialize)]
pub struct Incident {
    pub incident_id: String,
    pub timestamp: DateTime<Utc>,
    pub machine_id: String,
    pub severity: String,
    pub incident_type: String,
    pub message: String,
    pub value: f64,
    pub threshold: f64,
    pub action: String,
    pub action_status: String,
    pub zone: String,
}

impl Incident {
    pub fn from_threat(threat: &Threat, action: &Action, status: &str) -> Self {
        let (value, threshold) = match threat {
            Threat::Chatter { amplitude_mm_s, .. } => (*amplitude_mm_s, 0.01),
            Threat::ThermalDrift { drift_mm, .. } => (*drift_mm, 0.05),
            Threat::ToolWear { wear_percent, .. } => (*wear_percent, 15.0),
            Threat::ThermalRunaway { temperature, .. } => (*temperature, 80.0),
            Threat::BearingFailure { vibration_mm_s, .. } => (*vibration_mm_s, 0.02),
            Threat::CoolantFailure { flow_rate, .. } => (*flow_rate, 0.8),
            Threat::FacilityIntegrity { metric, .. } => (*metric, 250.0),
            Threat::Contamination { particle_count, limit, .. } => (*particle_count, *limit),
            Threat::ChemicalLeak { concentration_ppm, .. } => (*concentration_ppm, 10.0),
            Threat::QualityDefect { confidence, .. } => (*confidence, 0.95),
            Threat::ThroughputDegradation { .. } => (0.0, 0.0),
            Threat::EquipmentDegradation { metric, .. } => (*metric, 0.0),
            Threat::Anomaly { .. } => (0.0, 0.0),
        };

        Self {
            incident_id: format!("INC-{}", uuid::Uuid::new_v4().to_string()[..8].to_uppercase()),
            timestamp: Utc::now(),
            machine_id: threat.machine_id().to_string(),
            severity: format!("{:?}", threat.severity()).to_lowercase(),
            incident_type: threat.threat_type().to_string(),
            message: format!("{:?} detected on {}", threat.threat_type(), threat.machine_id()),
            value,
            threshold,
            action: action.name().to_string(),
            action_status: status.to_string(),
            zone: match threat.severity() {
                Severity::Low | Severity::Medium => "green",
                Severity::High => "yellow",
                Severity::Critical => "red",
            }.to_string(),
        }
    }
}

/// Agent metadata
#[derive(Debug, Clone)]
pub struct AgentMetadata {
    pub name: String,
    pub version: String,
    pub target_equipment: Vec<String>,
    pub capabilities: Vec<String>,
}

/// Aegis configuration
#[derive(Debug, Clone, Deserialize)]
pub struct AegisConfig {
    pub agents: Vec<AgentConfig>,
}

/// Individual agent configuration
#[derive(Debug, Clone, Deserialize)]
pub struct AgentConfig {
    pub machine_id: String,
    pub agent_type: String,
    pub config: serde_yaml::Value,
}

/// Agent errors
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Configuration error: {0}")]
    ConfigError(String),
    #[error("Execution error: {0}")]
    ExecutionError(String),
    #[error("MQTT error: {0}")]
    MqttError(String),
}
