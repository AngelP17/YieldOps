//! MQTT client for Aegis Sentinel

use rumqttc::{AsyncClient, EventLoop, MqttOptions, Packet, Publish, QoS};
use serde_json;
use tracing::{debug, error, info};

use crate::types::*;

pub struct MqttClient {
    client: AsyncClient,
    eventloop: EventLoop,
}

impl MqttClient {
    pub async fn new(broker: &str) -> anyhow::Result<Self> {
        let mut mqttoptions = MqttOptions::new(
            "aegis-sentinel",
            broker,
            1883,
        );
        mqttoptions.set_keep_alive(std::time::Duration::from_secs(5));
        
        let (client, eventloop) = AsyncClient::new(mqttoptions, 10);
        
        Ok(Self { client, eventloop })
    }
    
    pub async fn subscribe(&mut self, topic: &str) -> anyhow::Result<()> {
        self.client.subscribe(topic, QoS::AtLeastOnce).await?;
        Ok(())
    }
    
    pub async fn receive_telemetry(&mut self) -> Option<Telemetry> {
        loop {
            match self.eventloop.poll().await {
                Ok(notification) => {
                    if let rumqttc::Event::Incoming(Packet::Publish(publish)) = notification {
                        if let Ok(telemetry) = Self::parse_telemetry(&publish) {
                            return Some(telemetry);
                        }
                    }
                }
                Err(e) => {
                    error!("MQTT error: {}", e);
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    }
    
    fn parse_telemetry(publish: &Publish) -> anyhow::Result<Telemetry> {
        let payload = String::from_utf8_lossy(&publish.payload);
        let telemetry: Telemetry = serde_json::from_str(&payload)?;
        Ok(telemetry)
    }
    
    pub async fn publish_command(&mut self, machine_id: &str, command: &Command) -> anyhow::Result<()> {
        let topic = format!("factory/{}/command", machine_id);
        let payload = serde_json::to_string(command)?;
        self.client.publish(&topic, QoS::AtLeastOnce, false, payload).await?;
        info!("Published command to {}: {:?}", machine_id, command);
        Ok(())
    }
    
    pub async fn publish_incident(&mut self, incident: &Incident) -> anyhow::Result<()> {
        let topic = "aegis/incidents";
        let payload = serde_json::to_string(incident)?;
        self.client.publish(topic, QoS::AtLeastOnce, false, payload).await?;
        info!("Published incident: {:?}", incident);
        Ok(())
    }
}
