//! Supabase client for the Aegis Bridge
//!
//! Handles all interactions with Supabase REST API

use reqwest::{Client, header};
use serde_json::json;
use tracing::{debug, error, info};

use crate::types::*;

pub struct SupabaseClient {
    client: Client,
    url: String,
    api_key: String,
}

impl SupabaseClient {
    pub async fn new(url: &str, api_key: &str) -> anyhow::Result<Self> {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            "apikey",
            header::HeaderValue::from_str(api_key)?,
        );
        headers.insert(
            "Authorization",
            header::HeaderValue::from_str(&format!("Bearer {}", api_key))?,
        );
        headers.insert(
            "Content-Type",
            header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            "Prefer",
            header::HeaderValue::from_static("return=minimal"),
        );

        let client = Client::builder()
            .default_headers(headers)
            .build()?;

        info!("Supabase client initialized");
        Ok(Self {
            client,
            url: url.to_string(),
            api_key: api_key.to_string(),
        })
    }

    /// Insert a sensor reading into the database
    pub async fn insert_sensor_reading(&self, reading: SensorReading) -> anyhow::Result<()> {
        let url = format!("{}/rest/v1/sensor_readings", self.url);
        
        let response = self.client
            .post(&url)
            .json(&reading)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Failed to insert sensor reading: {}", error_text);
            return Err(anyhow::anyhow!("Supabase insert failed: {}", error_text));
        }

        debug!(
            "Inserted sensor reading for {} ({})",
            reading.machine_id,
            reading.agent_type
        );
        Ok(())
    }

    /// Insert an Aegis incident into the database
    pub async fn insert_incident(&self, incident: AegisIncident) -> anyhow::Result<()> {
        let url = format!("{}/rest/v1/aegis_incidents", self.url);
        
        let response = self.client
            .post(&url)
            .json(&incident)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Failed to insert incident: {}", error_text);
            return Err(anyhow::anyhow!("Supabase insert failed: {}", error_text));
        }

        info!(
            "Inserted incident {} for {} ({} severity)",
            incident.incident_id,
            incident.machine_id,
            incident.severity
        );
        Ok(())
    }

    /// Update machine status in the database
    pub async fn update_machine_status(
        &self,
        machine_id: &str,
        status: &MachineStatusUpdate,
    ) -> anyhow::Result<()> {
        let url = format!("{}/rest/v1/machines?machine_id=eq.{}", self.url, machine_id);
        
        let update_data = json!({
            "status": status.status,
            "updated_at": chrono::Utc::now().to_rfc3339(),
        });
        
        let response = self.client
            .patch(&url)
            .json(&update_data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Failed to update machine status: {}", error_text);
            return Err(anyhow::anyhow!("Supabase update failed: {}", error_text));
        }

        debug!("Updated machine {} status to {}", machine_id, status.status);
        Ok(())
    }

    /// Get machine by ID
    pub async fn get_machine(&self, machine_id: &str) -> anyhow::Result<Option<serde_json::Value>> {
        let url = format!(
            "{}/rest/v1/machines?machine_id=eq.{}&select=*",
            self.url, machine_id
        );
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Failed to get machine: {}", error_text);
            return Err(anyhow::anyhow!("Supabase query failed: {}", error_text));
        }

        let machines: Vec<serde_json::Value> = response.json().await?;
        Ok(machines.into_iter().next())
    }

    /// List all machines
    pub async fn list_machines(&self) -> anyhow::Result<Vec<serde_json::Value>> {
        let url = format!("{}/rest/v1/machines?select=*", self.url);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Failed to list machines: {}", error_text);
            return Err(anyhow::anyhow!("Supabase query failed: {}", error_text));
        }

        let machines: Vec<serde_json::Value> = response.json().await?;
        Ok(machines)
    }

    /// Check database health
    pub async fn health_check(&self) -> anyhow::Result<bool> {
        let url = format!("{}/rest/v1/machines?select=count&limit=1", self.url);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

        Ok(response.status().is_success())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require a running Supabase instance
    // Run with: cargo test -- --ignored
    
    #[tokio::test]
    #[ignore]
    async fn test_health_check() {
        let client = SupabaseClient::new(
            "http://localhost:54321",
            "test_key",
        ).await.unwrap();
        
        let healthy = client.health_check().await.unwrap();
        assert!(healthy);
    }
}
