//! MQTT client for the Supabase Bridge

use rumqttc::{AsyncClient, EventLoop, MqttOptions, Packet, Publish, QoS};
use tracing::{debug, error, info};

use crate::types::MqttMessage;

pub struct MqttBridge {
    client: AsyncClient,
    eventloop: EventLoop,
}

impl MqttBridge {
    pub async fn new(broker: &str) -> anyhow::Result<Self> {
        let parts: Vec<&str> = broker.split(':').collect();
        let host = parts[0];
        let port = parts.get(1)
            .and_then(|p| p.parse().ok())
            .unwrap_or(1883u16);

        let mut mqttoptions = MqttOptions::new(
            "aegis-supabase-bridge",
            host,
            port,
        );
        mqttoptions.set_keep_alive(std::time::Duration::from_secs(5));
        
        let (client, eventloop) = AsyncClient::new(mqttoptions, 10);
        
        info!("MQTT client initialized for {}:{}", host, port);
        Ok(Self { client, eventloop })
    }
    
    pub async fn subscribe(&mut self, topic: &str) -> anyhow::Result<()> {
        self.client.subscribe(topic, QoS::AtLeastOnce).await?;
        info!("Subscribed to MQTT topic: {}", topic);
        Ok(())
    }
    
    pub async fn receive(&mut self) -> Option<MqttMessage> {
        loop {
            match self.eventloop.poll().await {
                Ok(notification) => {
                    if let rumqttc::Event::Incoming(Packet::Publish(publish)) = notification {
                        if let Ok(message) = Self::parse_message(&publish) {
                            return Some(message);
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
    
    fn parse_message(publish: &Publish) -> anyhow::Result<MqttMessage> {
        let topic = publish.topic.clone();
        let payload = String::from_utf8_lossy(&publish.payload).to_string();
        
        debug!("Received message on topic: {}", topic);
        
        Ok(MqttMessage { topic, payload })
    }
    
    pub async fn publish(&mut self, topic: &str, payload: &str) -> anyhow::Result<()> {
        self.client.publish(
            topic,
            QoS::AtLeastOnce,
            false,
            payload.as_bytes(),
        ).await?;
        debug!("Published to {}: {}", topic, payload);
        Ok(())
    }
}
