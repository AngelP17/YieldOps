//! Aegis Sentinel - Autonomous Defense Agent for Industrial Equipment
//!
//! The Aegis Sentinel monitors machine telemetry, detects anomalies using
//! statistical analysis, and executes autonomous responses based on the
//! Safety Circuit (3-tier response model).

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

mod agents;
mod api_bridge;
mod detection;
mod mqtt;
mod safety;
mod types;

use agents::precision::PrecisionSentinel;
use agents::facility::FacilitySentinel;
use agents::assembly::AssemblySentinel;
use agents::SentinelAgent;
use api_bridge::{report_threat, YieldOpsClient};
use mqtt::MqttClient;
use types::*;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("aegis_sentinel=info")
        .init();

    info!("╔══════════════════════════════════════════════════════════════════╗");
    info!("║                                                                  ║");
    info!("║           AEGIS SENTINEL - Autonomous Defense Agent              ║");
    info!("║           CrowdStrike for Physical Infrastructure                ║");
    info!("║                                                                  ║");
    info!("║           Fab → Precision → Assembly (Full Value Chain)          ║");
    info!("║                                                                  ║");
    info!("╚══════════════════════════════════════════════════════════════════╝");

    // Load configuration
    let config = load_config()?;
    info!("Configuration loaded successfully");

    // Initialize YieldOps API client (optional, for direct HTTP reporting)
    let yieldops_client = YieldOpsClient::from_env();
    if yieldops_client.is_some() {
        info!("✓ YieldOps API integration enabled");
    } else {
        info!("ℹ YieldOps API not configured - using MQTT only");
        info!("  Set YIELDOPS_API_URL to enable direct API integration");
    }

    // Initialize agents
    let mut agents: Vec<Box<dyn SentinelAgent>> = vec![];
    
    for agent_config in &config.agents {
        match agent_config.agent_type.as_str() {
            "precision" => {
                info!("Initializing Precision Sentinel for {}", agent_config.machine_id);
                let agent = PrecisionSentinel::new(
                    agent_config.machine_id.clone(),
                    agent_config.config.clone(),
                );
                agents.push(Box::new(agent));
            }
            "facility" => {
                info!("Initializing Facility Sentinel for {}", agent_config.machine_id);
                let agent = FacilitySentinel::new(
                    agent_config.machine_id.clone(),
                    agent_config.config.clone(),
                );
                agents.push(Box::new(agent));
            }
            "assembly" => {
                info!("Initializing Assembly Sentinel for {}", agent_config.machine_id);
                let agent = AssemblySentinel::new(
                    agent_config.machine_id.clone(),
                    agent_config.config.clone(),
                );
                agents.push(Box::new(agent));
            }
            _ => {
                warn!("Unknown agent type: {}", agent_config.agent_type);
            }
        }
    }

    if agents.is_empty() {
        warn!("No agents configured - running in monitoring mode only");
    }

    // Initialize MQTT client
    let broker = std::env::var("MQTT_BROKER").unwrap_or_else(|_| "localhost".to_string());
    info!("Connecting to MQTT broker at {}...", broker);
    
    let mqtt_client = Arc::new(RwLock::new(MqttClient::new(&broker).await?));
    info!("Connected to MQTT broker");

    // Register agents with YieldOps API
    if let Some(ref api) = yieldops_client {
        for agent_config in &config.agents {
            let agent_type = agent_config.agent_type.clone();
            let machine_id = agent_config.machine_id.clone();
            let agent_id = format!("agent-{}-{}", agent_type, machine_id.to_lowercase());
            
            let capabilities = match agent_type.as_str() {
                "precision" => vec![
                    "z_score_analysis".to_string(),
                    "thermal_drift_detection".to_string(),
                    "tool_wear_tracking".to_string(),
                    "chatter_detection".to_string(),
                ],
                "facility" => vec![
                    "iso_14644_compliance".to_string(),
                    "filter_life_prediction".to_string(),
                    "particle_monitoring".to_string(),
                    "chemical_leak_detection".to_string(),
                ],
                "assembly" => vec![
                    "nsop_detection".to_string(),
                    "ultrasonic_monitoring".to_string(),
                    "shear_strength_tracking".to_string(),
                    "oee_calculation".to_string(),
                ],
                _ => vec!["general_monitoring".to_string()],
            };

            if let Err(e) = api.register_agent(&agent_id, &agent_type, &machine_id, &capabilities).await {
                warn!("Failed to register agent {}: {}", agent_id, e);
            }
        }
    }

    // Subscribe to telemetry topics
    mqtt_client.write().await.subscribe("factory/+/telemetry").await?;
    info!("Subscribed to factory/+/telemetry");

    // Main event loop
    info!("Aegis Sentinel is running - Press Ctrl+C to stop");
    
    loop {
        tokio::select! {
            // Handle incoming telemetry
            Some(telemetry) = mqtt_client.write().await.receive_telemetry() => {
                handle_telemetry(&agents, &mqtt_client, telemetry).await?;
            }
            
            // Handle shutdown signal
            _ = tokio::signal::ctrl_c() => {
                info!("Shutdown signal received");
                break;
            }
        }
    }

    info!("Aegis Sentinel stopped");
    Ok(())
}

async fn handle_telemetry(
    agents: &[Box<dyn SentinelAgent>],
    mqtt_client: &Arc<RwLock<MqttClient>>,
    yieldops_client: &Option<YieldOpsClient>,
    telemetry: Telemetry,
) -> anyhow::Result<()> {
    for agent in agents {
        if agent.can_handle(&telemetry.machine_id) {
            // Analyze telemetry for threats
            let threats = agent.analyze(&telemetry);
            
            for threat in threats {
                let (tier, action) = agent.safety_circuit(&threat);
                
                log_threat(&threat, &tier, &action);
                
                // Report threat to YieldOps API
                report_threat(yieldops_client, &threat, &action, &tier).await;

                match tier {
                    ResponseTier::Green => {
                        // Auto-execute
                        if let Err(e) = agent.execute(&action).await {
                            error!("Failed to execute action: {}", e);
                        } else {
                            // Publish command to machine
                            let command = action_to_command(&action);
                            mqtt_client.write().await.publish_command(
                                &telemetry.machine_id,
                                &command,
                            ).await?;
                        }
                    }
                    ResponseTier::Yellow => {
                        // Queue for approval (in production, wait for dashboard)
                        warn!("YELLOW ZONE: Action '{}' queued for approval", action.name());
                        // Publish for dashboard visibility
                        let incident = Incident::from_threat(&threat, &action, "pending_approval");
                        mqtt_client.write().await.publish_incident(&incident).await?;
                    }
                    ResponseTier::Red => {
                        // Alert only - no autonomous action
                        error!("RED ZONE: Human intervention required for {:?}", threat);
                        // Publish incident for dashboard
                        let incident = Incident::from_threat(&threat, &action, "alert_only");
                        mqtt_client.write().await.publish_incident(&incident).await?;
                    }
                }
            }
        }
    }
    
    Ok(())
}

fn log_threat(threat: &Threat, tier: &ResponseTier, action: &Action) {
    let tier_str = match tier {
        ResponseTier::Green => "🟢 GREEN",
        ResponseTier::Yellow => "🟡 YELLOW",
        ResponseTier::Red => "🔴 RED",
    };
    
    warn!(
        "[DETECTION] {} | {:?} | Severity: {:?} | Action: {} | Zone: {}",
        threat.machine_id(),
        threat.threat_type(),
        threat.severity(),
        action.name(),
        tier_str
    );
}

fn action_to_command(action: &Action) -> Command {
    match action {
        Action::AdjustParameter { parameter_name, new_value, unit } => Command {
            action: "adjust_parameter".to_string(),
            parameter: Some(parameter_name.clone()),
            value: Some(*new_value),
            unit: Some(unit.clone()),
        },
        Action::ReduceSpeed { percent_reduction } => Command {
            action: "reduce_speed".to_string(),
            parameter: None,
            value: Some(*percent_reduction as f64),
            unit: Some("percent".to_string()),
        },
        Action::EmergencyStop => Command {
            action: "emergency_stop".to_string(),
            parameter: None,
            value: None,
            unit: None,
        },
        _ => Command {
            action: "alert".to_string(),
            parameter: None,
            value: None,
            unit: None,
        },
    }
}

fn load_config() -> anyhow::Result<AegisConfig> {
    // For now, use default config
    // In production, load from YAML file
    Ok(AegisConfig {
        agents: vec![
            // Precision Agents (CNC Machining)
            AgentConfig {
                machine_id: "CNC-001".to_string(),
                agent_type: "precision".to_string(),
                config: serde_yaml::Value::Null,
            },
            AgentConfig {
                machine_id: "CNC-002".to_string(),
                agent_type: "precision".to_string(),
                config: serde_yaml::Value::Null,
            },
            AgentConfig {
                machine_id: "CNC-003".to_string(),
                agent_type: "precision".to_string(),
                config: serde_yaml::Value::Null,
            },
            AgentConfig {
                machine_id: "CNC-004".to_string(),
                agent_type: "precision".to_string(),
                config: serde_yaml::Value::Null,
            },
            AgentConfig {
                machine_id: "CNC-005".to_string(),
                agent_type: "precision".to_string(),
                config: serde_yaml::Value::Null,
            },
            // Facility Agents (Cleanroom & Infrastructure)
            AgentConfig {
                machine_id: "FAC-001".to_string(),
                agent_type: "facility".to_string(),
                config: serde_yaml::Value::Null,
            },
            AgentConfig {
                machine_id: "FAC-002".to_string(),
                agent_type: "facility".to_string(),
                config: serde_yaml::Value::Null,
            },
            // Assembly Agents (Wire Bonding & Packaging)
            AgentConfig {
                machine_id: "BOND-01".to_string(),
                agent_type: "assembly".to_string(),
                config: serde_yaml::Value::Null,
            },
            AgentConfig {
                machine_id: "BOND-02".to_string(),
                agent_type: "assembly".to_string(),
                config: serde_yaml::Value::Null,
            },
        ],
    })
}
