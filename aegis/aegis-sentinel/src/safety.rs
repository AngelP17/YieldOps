//! Safety Circuit implementation for Aegis Sentinel
//!
//! The Safety Circuit implements a 3-tier response model:
//! - GREEN: Auto-execute (low risk actions)
//! - YELLOW: Approval required (medium risk actions)
//! - RED: Alert only (high risk actions)

use crate::types::*;

/// Safety Circuit evaluator
pub struct SafetyCircuit;

impl SafetyCircuit {
    /// Evaluate a threat and determine the appropriate response tier
    pub fn evaluate(threat: &Threat) -> ResponseTier {
        match threat.severity() {
            Severity::Low => ResponseTier::Green,
            Severity::Medium => ResponseTier::Green,
            Severity::High => ResponseTier::Yellow,
            Severity::Critical => ResponseTier::Red,
        }
    }
    
    /// Determine if an action requires human approval
    pub fn requires_approval(action: &Action) -> bool {
        match action {
            Action::EmergencyStop => true,
            Action::ReduceSpeed { percent_reduction } => *percent_reduction > 20,
            _ => false,
        }
    }
}
