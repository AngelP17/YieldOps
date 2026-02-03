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
  priority_level: 1 | 2 | 3 | 4 | 5;
  status: JobStatus;
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
