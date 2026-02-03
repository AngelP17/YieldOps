export interface Machine {
  machine_id: string;
  name: string;
  type: 'lithography' | 'etching' | 'deposition' | 'inspection' | 'cleaning';
  status: 'IDLE' | 'RUNNING' | 'DOWN' | 'MAINTENANCE';
  efficiency_rating: number;
  location_zone: string;
  max_temperature: number;
  max_vibration: number;
  current_wafer_count: number;
  total_wafers_processed: number;
  last_maintenance?: string;
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
  priority_level: 1 | 2 | 3 | 4 | 5;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  recipe_type: string;
  assigned_machine_id?: string;
  estimated_duration_minutes?: number;
  actual_start_time?: string;
  actual_end_time?: string;
  deadline?: string;
  customer_tag?: string;
  is_hot_lot: boolean;
  created_at: string;
  updated_at: string;
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

export interface MaintenanceLog {
  log_id: string;
  machine_id: string;
  maintenance_type: string;
  description?: string;
  technician_id?: string;
  started_at?: string;
  completed_at?: string;
  downtime_minutes?: number;
  parts_replaced?: string[];
}

export interface AnomalyAlert {
  alert_id: string;
  machine_id: string;
  reading_id?: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description?: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface CapacitySimulation {
  simulation_id: string;
  simulation_name: string;
  scenario_params: Record<string, any>;
  iterations: number;
  mean_throughput: number;
  p95_throughput: number;
  p99_throughput: number;
  confidence_interval?: Record<string, any>;
  results_data?: Record<string, any>;
  created_at: string;
}
