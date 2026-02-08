import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {

}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Type definitions for database tables
export interface DatabaseMachine {
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
  last_maintenance: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSensorReading {
  reading_id: string;
  machine_id: string;
  temperature: number;
  vibration: number;
  pressure: number | null;
  humidity: number | null;
  power_consumption: number | null;
  is_anomaly: boolean;
  anomaly_score: number | null;
  recorded_at: string;
}

export interface DatabaseProductionJob {
  job_id: string;
  job_name: string;
  wafer_count: number;
  priority_level: number;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  recipe_type: string;
  assigned_machine_id: string | null;
  estimated_duration_minutes: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  deadline: string | null;
  customer_tag: string | null;
  is_hot_lot: boolean;
  created_at: string;
  updated_at: string;
}
