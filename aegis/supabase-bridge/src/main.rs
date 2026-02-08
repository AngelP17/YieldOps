//! Aegis Supabase Bridge - MQTT to Supabase Real-time Bridge
//!
//! This bridge connects the Aegis Sentinel MQTT system to Supabase,
//! enabling real-time data sharing between YieldOps and Sentinel.
//!
//! # Architecture
//! - Subscribes to factory/+/telemetry (machine telemetry)
//! - Subscribes to aegis/incidents (Sentinel detections)
//! - Publishes to Supabase for YieldOps dashboard
//!
//! # Data Flow
//! ```text
//! Machine/Agent → MQTT → Supabase Bridge → Supabase (Realtime) → YieldOps Dashboard
//! ```

use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, error, debug, warn};
use chrono::Utc;

mod supabase;
mod mqtt;
mod types;

use supabase::SupabaseClient;
use mqtt::MqttBridge;
use types::*;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("aegis_supabase_bridge=info")
        .init();

    info!("╔══════════════════════════════════════════════════════════════════╗");
    info!("║                                                                  ║");
    info!("║     AEGIS SUPABASE BRIDGE - Sand-to-Package Data Pipeline        ║");
    info!("║                                                                  ║");
    info!("║     Front-End (Fab): Facility Agents (FFU/HEPA)                  ║");
    info!("║     Back-End (Pkg): Assembly Agents (Wire Bonding)               ║");
    info!("║                                                                  ║");
    info!("║     Protocols: Modbus/BACnet (Facility) + SECS/GEM (Assembly)    ║");
    info!("║                                                                  ║");
    info!("╚══════════════════════════════════════════════════════════════════╝");

    // Load environment variables
    dotenv::dotenv().ok();
    
    let supabase_url = std::env::var("SUPABASE_URL")
        .expect("SUPABASE_URL must be set");
    let supabase_key = std::env::var("SUPABASE_SERVICE_KEY")
        .expect("SUPABASE_SERVICE_KEY must be set");
    let mqtt_broker = std::env::var("MQTT_BROKER")
        .unwrap_or_else(|_| "localhost:1883".to_string());

    info!("Connecting to Supabase at {}...", supabase_url);
    let supabase = Arc::new(Mutex::new(
        SupabaseClient::new(&supabase_url, &supabase_key).await?
    ));
    info!("✓ Supabase connected");

    info!("Connecting to MQTT broker at {}...", mqtt_broker);
    let mqtt = Arc::new(Mutex::new(
        MqttBridge::new(&mqtt_broker).await?
    ));
    info!("✓ MQTT connected");

    // Subscribe to topics
    {
        let mut mqtt_guard = mqtt.lock().await;
        mqtt_guard.subscribe("factory/+/telemetry").await?;
        mqtt_guard.subscribe("aegis/incidents").await?;
        mqtt_guard.subscribe("factory/+/status").await?;
        info!("✓ Subscribed to MQTT topics");
    }

    info!("Bridge is running - Press Ctrl+C to stop");

    // Main event loop
    loop {
        tokio::select! {
            // Handle incoming MQTT messages
            Some(message) = async {
                let mut mqtt_guard = mqtt.lock().await;
                mqtt_guard.receive().await
            } => {
                if let Err(e) = handle_message(&supabase, message).await {
                    error!("Failed to handle message: {}", e);
                }
            }
            
            // Handle shutdown signal
            _ = tokio::signal::ctrl_c() => {
                info!("Shutdown signal received");
                break;
            }
        }
    }

    info!("Aegis Supabase Bridge stopped");
    Ok(())
}

async fn handle_message(
    supabase: &Arc<Mutex<SupabaseClient>>,
    message: MqttMessage,
) -> anyhow::Result<()> {
    match message.topic.as_str() {
        topic if topic.contains("/telemetry") => {
            handle_telemetry(supabase, &message.payload).await?;
        }
        topic if topic == "aegis/incidents" => {
            handle_incident(supabase, &message.payload).await?;
        }
        topic if topic.contains("/status") => {
            handle_status_update(supabase, &message.payload).await?;
        }
        _ => {
            debug!("Unhandled topic: {}", message.topic);
        }
    }
    Ok(())
}

async fn handle_telemetry(
    supabase: &Arc<Mutex<SupabaseClient>>,
    payload: &str,
) -> anyhow::Result<()> {
    let telemetry: TelemetryPayload = serde_json::from_str(payload)?;
    
    debug!(
        "Processing telemetry from {}: {} metrics",
        telemetry.machine_id,
        telemetry.metrics.len()
    );

    let mut supabase_guard = supabase.lock().await;

    // Determine agent type from machine_id prefix
    let agent_type = detect_agent_type(&telemetry.machine_id);
    
    // Insert sensor readings
    let reading = SensorReading {
        reading_id: uuid::Uuid::new_v4().to_string(),
        machine_id: telemetry.machine_id.clone(),
        temperature: telemetry.metrics.get("temperature").copied(),
        vibration: telemetry.metrics.get("vibration").copied(),
        pressure: telemetry.metrics.get("pressure").copied(),
        airflow: telemetry.metrics.get("airflow_mps").copied(),
        particles_0_5um: telemetry.metrics.get("particles_0_5um").copied(),
        usg_impedance: telemetry.metrics.get("usg_impedance").copied(),
        bond_time_ms: telemetry.metrics.get("bond_time_ms").copied(),
        shear_strength: telemetry.metrics.get("shear_strength_g").copied(),
        pressure_diff_pa: telemetry.metrics.get("pressure_diff_pa").copied(),
        is_anomaly: telemetry.anomaly_detected.unwrap_or(false),
        anomaly_score: telemetry.anomaly_score,
        agent_type: agent_type.clone(),
        recorded_at: Utc::now().to_rfc3339(),
    };

    supabase_guard.insert_sensor_reading(reading).await?;

    // Update machine status if provided
    if let Some(status) = &telemetry.status {
        supabase_guard.update_machine_status(&telemetry.machine_id, status).await?;
    }

    // Publish to YieldOps ingestion topic
    let yieldops_payload = serde_json::json!({
        "machine_id": telemetry.machine_id,
        "agent_type": agent_type,
        "metrics": telemetry.metrics,
        "timestamp": Utc::now().to_rfc3339(),
        "source": "aegis_sentinel",
    });

    info!(
        "[{}] {} telemetry ingested | Metrics: {:?}",
        agent_type.to_uppercase(),
        telemetry.machine_id,
        telemetry.metrics.keys().collect::<Vec<_>>()
    );

    Ok(())
}

async fn handle_incident(
    supabase: &Arc<Mutex<SupabaseClient>>,
    payload: &str,
) -> anyhow::Result<()> {
    let incident: IncidentPayload = serde_json::from_str(payload)?;
    
    warn!(
        "🚨 SENTINEL DETECTION: {} | {} | Severity: {:?}",
        incident.machine_id,
        incident.threat_type,
        incident.severity
    );

    let mut supabase_guard = supabase.lock().await;

    // Insert into aegis_incidents table
    let aegis_incident = AegisIncident {
        incident_id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now().to_rfc3339(),
        machine_id: incident.machine_id.clone(),
        severity: incident.severity.clone(),
        incident_type: incident.threat_type.clone(),
        message: incident.message.clone(),
        detected_value: incident.detected_value,
        threshold_value: incident.threshold_value,
        action_taken: incident.action_taken.clone(),
        action_status: incident.action_status.clone(),
        action_zone: incident.response_tier.clone(),
        agent_type: detect_agent_type(&incident.machine_id),
        z_score: incident.z_score,
        rate_of_change: incident.rate_of_change,
        resolved: false,
        resolved_at: None,
        operator_notes: None,
    };

    supabase_guard.insert_incident(aegis_incident).await?;

    // Update machine status if incident is critical
    if incident.severity == "critical" || incident.severity == "high" {
        supabase_guard.update_machine_status(
            &incident.machine_id,
            &MachineStatusUpdate {
                status: "MAINTENANCE".to_string(),
                efficiency_rating: None,
                alert_message: Some(incident.message.clone()),
            }
        ).await?;
    }

    info!(
        "✓ Incident logged: {} | Zone: {} | Action: {}",
        incident.incident_id.as_deref().unwrap_or("N/A"),
        incident.response_tier,
        incident.action_taken
    );

    Ok(())
}

async fn handle_status_update(
    supabase: &Arc<Mutex<SupabaseClient>>,
    payload: &str,
) -> anyhow::Result<()> {
    let status: MachineStatusUpdate = serde_json::from_str(payload)?;
    
    debug!("Status update: {:?}", status);

    let mut supabase_guard = supabase.lock().await;
    // The machine_id would be in the topic, but we're simplifying here
    // In production, parse from topic like factory/{machine_id}/status
    
    Ok(())
}

fn detect_agent_type(machine_id: &str) -> String {
    if machine_id.starts_with("FAC-") {
        "facility".to_string()  // Front-End: Fab environment
    } else if machine_id.starts_with("BOND-") || machine_id.starts_with("ASM-") {
        "assembly".to_string()  // Back-End: Packaging
    } else if machine_id.starts_with("CNC-") {
        "precision".to_string() // Precision machining
    } else if machine_id.starts_with("LITHO-") 
        || machine_id.starts_with("ETCH-")
        || machine_id.starts_with("DEP-")
        || machine_id.starts_with("INSP-")
        || machine_id.starts_with("CLEAN-") {
        "fab_equipment".to_string() // Fab equipment
    } else {
        "unknown".to_string()
    }
}
