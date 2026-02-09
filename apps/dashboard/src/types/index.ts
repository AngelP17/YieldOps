export type MachineStatus = 'IDLE' | 'RUNNING' | 'DOWN' | 'MAINTENANCE';
export type MachineType = 'lithography' | 'etching' | 'deposition' | 'inspection' | 'cleaning';
export type JobStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Machine {
  machine_id: string;
  name: string;
  type: MachineType;
  status: MachineStatus;
  efficiency_rating: number;
  location_zone: string;
  max_temperature: number;
  max_vibration: number;
  current_wafer_count: number;
  total_wafers_processed: number;
  last_maintenance?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  temperature?: number;
  vibration?: number;
}

export interface ProductionJob {
  job_id: string;
  job_name: string;
  wafer_count: number;
  priority_level: number;
  status: JobStatus;
  recipe_type: string;
  assigned_machine_id?: string | null;
  estimated_duration_minutes?: number | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  deadline?: string | null;
  customer_tag?: string | null;
  is_hot_lot: boolean;
  created_at: string;
  updated_at: string;
  // Internal flag to track simulated jobs (not persisted to database)
  _isSimulated?: boolean;
}

export interface SensorReading {
  reading_id: string;
  machine_id: string;
  temperature: number;
  vibration: number;
  pressure?: number;
  humidity?: number;
  power_consumption?: number;
  is_anomaly: boolean;
  anomaly_score?: number;
  recorded_at: string;
}

export interface DispatchDecision {
  decision_id: string;
  job_id: string;
  machine_id: string;
  decision_reason: string;
  algorithm_version: string;
  efficiency_at_dispatch?: number;
  queue_depth_at_dispatch?: number;
  estimated_completion?: string;
  dispatched_at: string;
}

// =====================================================
// Virtual Metrology Types
// =====================================================

export interface VMPredictionRequest {
  tool_id: string;
  lot_id: string;
  temperature: number;
  pressure?: number;
  power_consumption?: number;
}

export interface VMPredictionResponse {
  lot_id: string;
  tool_id: string;
  predicted_thickness_nm: number;
  confidence_score: number;
  r2r_correction: number;
  prediction_id: string;
}

export interface VMFeedbackRequest {
  prediction_id: string;
  actual_thickness_nm: number;
}

export interface VMFeedbackResponse {
  prediction_id: string;
  prediction_error: number;
  ewma_error: number;
  recipe_adjustment?: {
    parameter_name: string;
    adjustment_value: number;
    reason: string;
  } | null;
}

export interface VMTrainRequest {
  min_samples?: number;
}

export interface VMTrainResponse {
  trained: boolean;
  samples: number;
  features: string[];
  r2_mean: number;
  r2_std: number;
  coefficients?: Record<string, number>;
}

export interface VMModelInfo {
  is_trained: boolean;
  features: string[];
  ewma_tracked_tools: number;
  model_path: string;
}

export interface VMPredictionRecord {
  prediction_id: string;
  lot_id: string;
  tool_id: string;
  predicted_thickness_nm: number;
  confidence_score: number;
  model_version: string;
  features_used?: Record<string, number>;
  actual_thickness_nm?: number;
  prediction_error?: number;
  created_at: string;
}

export interface RecipeAdjustment {
  adjustment_id: string;
  tool_id: string;
  lot_id?: string;
  parameter_name: string;
  current_value: number;
  adjustment_value: number;
  new_value: number;
  reason?: string;
  applied: boolean;
  created_at: string;
}

// =====================================================
// Aegis Sentinel Types
// =====================================================

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type SafetyZone = 'green' | 'yellow' | 'red';
export type ActionStatus = 'auto_executed' | 'pending_approval' | 'approved' | 'rejected' | 'alert_only';
export type AgentType = 'precision' | 'facility' | 'assembly';

export interface AegisIncident {
  incident_id: string;
  created_at: string;
  machine_id: string;
  severity: SeverityLevel;
  incident_type: string;
  message: string;
  detected_value: number;
  threshold_value: number;
  action_taken: string;
  action_status: ActionStatus;
  action_zone: SafetyZone;
  agent_type?: AgentType | null;
  z_score?: number | null;
  rate_of_change?: number | null;
  resolved: boolean;
  resolved_at?: string | null;
  operator_notes?: string | null;
}

export interface AegisAgent {
  agent_id: string;
  agent_type: AgentType;
  machine_id: string;
  status: string;
  last_heartbeat?: string | null;
  detections_24h: number;
  uptime_hours: number;
  capabilities: string[];
  protocol: string;
}

export interface SafetyCircuitStatus {
  green_actions_24h: number;
  yellow_pending: number;
  red_alerts_24h: number;
  agents_active: number;
  agents_total: number;
  last_incident?: AegisIncident | null;
}

export interface SentinelSummary {
  total_incidents_24h: number;
  critical_incidents_24h: number;
  active_agents: number;
  safety_circuit: SafetyCircuitStatus;
  recent_incidents: AegisIncident[];
  top_affected_machines: Array<{ machine_id: string; incident_count: number }>;
}

export interface KnowledgeGraphData {
  nodes: Array<{
    data: { id: string; label: string; type: string; color: string };
  }>;
  edges: Array<{
    data: { id: string; source: string; target: string; label: string; weight: number };
  }>;
  stats: {
    node_count: number;
    edge_count: number;
    central_concepts: Array<[string, number]>;
  };
}
