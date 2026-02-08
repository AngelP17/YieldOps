//! Aegis Sentinel Agents
//!
//! Specialized agents for different types of industrial equipment.
//! Each agent implements detection logic specific to its equipment type.
//!
//! # Agent Coverage
//! - **Precision Sentinel**: CNC machining (mills, lathes)
//! - **Facility Sentinel**: Cleanroom & infrastructure (FFU, HVAC)
//! - **Assembly Sentinel**: Wire bonding & packaging

use async_trait::async_trait;
use crate::types::*;

pub mod precision;
pub mod facility;
pub mod assembly;

/// Trait that all Sentinel agents must implement
#[async_trait]
pub trait SentinelAgent: Send + Sync {
    /// Analyze telemetry and return detected threats
    fn analyze(&mut self, telemetry: &Telemetry) -> Vec<Threat>;

    /// Determine safety circuit response for a threat
    fn safety_circuit(&self, threat: &Threat) -> (ResponseTier, Action);

    /// Execute an action
    async fn execute(&self, action: &Action) -> Result<(), AgentError>;

    /// Get agent metadata
    fn metadata(&self) -> AgentMetadata;

    /// Check if this agent can handle a specific machine
    fn can_handle(&self, machine_id: &str) -> bool;
}
