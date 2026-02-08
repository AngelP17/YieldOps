//! API Bridge - Connects Aegis Sentinel to YieldOps Dashboard
//!
//! This module provides HTTP client functionality to push incidents,
//! agent heartbeats, and telemetry directly to the YieldOps API.
//! This ensures real-time data sharing with the Supabase backend.

use reqwest::Client;
use serde_json::json;
use tracing::{debug, error, info, warn};

use crate::types::{Action, Incident, ResponseTier, Severity, Threat};

/// YieldOps API Client
pub struct YieldOpsClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
}

impl YieldOpsClient {
    /// Create a new YieldOps API client
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url,
            api_key,
        }
    }

    /// Create from environment variables
    pub fn from_env() -> Option<Self> {
        let base_url = std::env::var("YIELDOPS_API_URL").ok()?;
        let api_key = std::env::var("YIELDOPS_API_KEY").ok();

        info!("YieldOps API configured: {}", base_url);
        Some(Self::new(base_url, api_key))
    }

    /// Report an incident to the YieldOps API
    pub async fn report_incident(&self, incident: &Incident) -> Result<(), ApiError> {
        let url = format!("{}/api/v1/aegis/incidents", self.base_url);

        let payload = json!({
            "machine_id": incident.machine_id,
            "severity": incident.severity,
            "incident_type": incident.incident_type,
            "message": incident.message,
            "detected_value": incident.value,
            "threshold_value": incident.threshold,
            "recommended_action": incident.action,
            "action_zone": incident.zone,
        });

        debug!("Reporting incident to YieldOps: {}", payload);

        let mut request = self.client.post(&url).json(&payload);

        if let Some(key) = &self.api_key {
            request = request.header("Authorization", format!("Bearer {}", key));
        }

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    info!("Incident reported successfully: {}", incident.incident_id);
                    Ok(())
                } else {
                    let status = response.status();
                    let text = response.text().await.unwrap_or_default();
                    warn!("Failed to report incident: {} - {}", status, text);
                    Err(ApiError::HttpError(format!("{}: {}", status, text)))
                }
            }
            Err(e) => {
                error!("HTTP error reporting incident: {}", e);
                Err(ApiError::HttpError(e.to_string()))
            }
        }
    }

    /// Register an agent with YieldOps
    pub async fn register_agent(
        &self,
        agent_id: &str,
        agent_type: &str,
        machine_id: &str,
        capabilities: &[String],
    ) -> Result<(), ApiError> {
        let url = format!("{}/api/v1/aegis/agents/register", self.base_url);

        let payload = json!({
            "agent_id": agent_id,
            "agent_type": agent_type,
            "machine_id": machine_id,
            "capabilities": capabilities,
            "protocol": "mqtt",
        });

        let mut request = self.client.post(&url).json(&payload);

        if let Some(key) = &self.api_key {
            request = request.header("Authorization", format!("Bearer {}", key));
        }

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    info!("Agent registered: {}", agent_id);
                    Ok(())
                } else {
                    warn!("Failed to register agent: {}", response.status());
                    Err(ApiError::HttpError(response.status().to_string()))
                }
            }
            Err(e) => Err(ApiError::HttpError(e.to_string())),
        }
    }

    /// Send agent heartbeat
    pub async fn heartbeat(&self, agent_id: &str) -> Result<(), ApiError> {
        let url = format!("{}/api/v1/aegis/agents/{}/heartbeat", self.base_url, agent_id);

        let mut request = self.client.post(&url);

        if let Some(key) = &self.api_key {
            request = request.header("Authorization", format!("Bearer {}", key));
        }

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    debug!("Heartbeat sent: {}", agent_id);
                    Ok(())
                } else {
                    Err(ApiError::HttpError(response.status().to_string()))
                }
            }
            Err(e) => Err(ApiError::HttpError(e.to_string())),
        }
    }

    /// Analyze telemetry via YieldOps API (optional ML enhancement)
    pub async fn analyze_telemetry(
        &self,
        machine_id: &str,
        temperature: f64,
        vibration: f64,
    ) -> Result<serde_json::Value, ApiError> {
        let url = format!("{}/api/v1/aegis/telemetry/analyze", self.base_url);

        let payload = json!({
            "machine_id": machine_id,
            "temperature": temperature,
            "vibration": vibration,
        });

        let mut request = self.client.post(&url).json(&payload);

        if let Some(key) = &self.api_key {
            request = request.header("Authorization", format!("Bearer {}", key));
        }

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    response.json().await.map_err(|e| ApiError::HttpError(e.to_string()))
                } else {
                    Err(ApiError::HttpError(response.status().to_string()))
                }
            }
            Err(e) => Err(ApiError::HttpError(e.to_string())),
        }
    }
}

/// API errors
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("HTTP error: {0}")]
    HttpError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// Convert a Threat to an Incident and report to YieldOps
pub async fn report_threat(
    client: &Option<YieldOpsClient>,
    threat: &Threat,
    action: &Action,
    tier: &ResponseTier,
) {
    let status = match tier {
        ResponseTier::Green => "auto_executed",
        ResponseTier::Yellow => "pending_approval",
        ResponseTier::Red => "alert_only",
    };

    let incident = Incident::from_threat(threat, action, status);

    if let Some(api) = client {
        if let Err(e) = api.report_incident(&incident).await {
            warn!("Failed to report to YieldOps API: {}", e);
        }
    }

    // Also log locally
    info!(
        "[INCIDENT] {} | {} | {} | Zone: {:?}",
        incident.incident_id,
        incident.machine_id,
        incident.message,
        tier
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = YieldOpsClient::new(
            "http://localhost:8000".to_string(),
            Some("test-key".to_string()),
        );
        assert_eq!(client.base_url, "http://localhost:8000");
    }
}
