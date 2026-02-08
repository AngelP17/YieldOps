//! Type definitions for the Supabase Bridge

use serde::{Deserialize, Serialize};

/// MQTT message structure
#[derive(Debug, Clone)]
pub struct MqttMessage {
    pub topic: String,
    pub payload: String,
}

/// Telemetry payload from Sentinel agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryPayload {
    pub timestamp: String,
    pub machine_id: String,
    pub metrics: std::collections::HashMap<String, f64>,
    pub states: Option<std::collections::HashMap<String, String>>,
    pub status: Option<MachineStatusUpdate>,
    pub anomaly_detected: Option<bool>,
    pub anomaly_score: Option<f64>,
}

/// Incident payload from Sentinel agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentPayload {
    #[serde(default)]
    pub incident_id: Option<String>,
    pub timestamp: Option<String>,
    pub machine_id: String,
    pub severity: String,
    pub threat_type: String,
    pub message: String,
    pub detected_value: f64,
    pub threshold_value: f64,
    pub action_taken: String,
    pub action_status: String,
    pub response_tier: String,
    pub z_score: Option<f64>,
    pub rate_of_change: Option<f64>,
}

/// Machine status update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineStatusUpdate {
    pub status: String,
    pub efficiency_rating: Option<f64>,
    pub alert_message: Option<String>,
}

/// Sensor reading for Supabase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub reading_id: String,
    pub machine_id: String,
    pub temperature: Option<f64>,
    pub vibration: Option<f64>,
    pub pressure: Option<f64>,
    pub airflow: Option<f64>,
    pub particles_0_5um: Option<f64>,
    pub usg_impedance: Option<f64>,
    pub bond_time_ms: Option<f64>,
    pub shear_strength: Option<f64>,
    pub pressure_diff_pa: Option<f64>,
    pub is_anomaly: bool,
    pub anomaly_score: Option<f64>,
    pub agent_type: String,
    pub recorded_at: String,
}

/// Aegis incident for Supabase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AegisIncident {
    pub incident_id: String,
    pub timestamp: String,
    pub machine_id: String,
    pub severity: String,
    pub incident_type: String,
    pub message: String,
    pub detected_value: f64,
    pub threshold_value: f64,
    pub action_taken: String,
    pub action_status: String,
    pub action_zone: String,
    pub agent_type: String,
    pub z_score: Option<f64>,
    pub rate_of_change: Option<f64>,
    pub resolved: bool,
    pub resolved_at: Option<String>,
    pub operator_notes: Option<String>,
}

/// Agent types for the Sand-to-Package platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentType {
    /// Front-End Fab: FFU, HVAC, Chemical Delivery
    Facility,
    /// Back-End Packaging: Wire Bonders, Die Attach
    Assembly,
    /// Precision machining: CNC mills, lathes
    Precision,
    /// Fab equipment: Lithography, Etching, Deposition
    FabEquipment,
    /// Unknown agent type
    Unknown,
}

impl std::fmt::Display for AgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentType::Facility => write!(f, "facility"),
            AgentType::Assembly => write!(f, "assembly"),
            AgentType::Precision => write!(f, "precision"),
            AgentType::FabEquipment => write!(f, "fab_equipment"),
            AgentType::Unknown => write!(f, "unknown"),
        }
    }
}
