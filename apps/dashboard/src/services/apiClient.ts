import type { VMPredictionRecord, RecipeAdjustment } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Check if API is properly configured (not using placeholder values)
export const isApiConfigured = (): boolean => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl !== undefined && apiUrl !== '' && apiUrl !== 'your_api_url';
};

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return (
    supabaseUrl !== undefined && 
    supabaseUrl !== '' && 
    supabaseUrl !== 'your_supabase_url' &&
    supabaseKey !== undefined &&
    supabaseKey !== '' &&
    supabaseKey !== 'your_supabase_anon_key'
  );
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  console.log(`API Request: ${options?.method || 'GET'} ${url}`);
  
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    
    if (!res.ok) {
      let errorDetail = res.statusText;
      try {
        const errorData = await res.json();
        errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch {
        // If JSON parsing fails, use status text
      }
      console.error(`API Error ${res.status}: ${errorDetail}`);
      throw new Error(errorDetail);
    }
    
    return res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - API server may be unreachable');
      throw new Error('Cannot connect to API server. Please check your connection or start the backend server.');
    }
    throw error;
  }
}

// Response types
export interface DispatchDecisionResponse {
  decision_id: string;
  job_id: string;
  machine_id: string;
  machine_name: string;
  reason: string;
  dispatched_at: string;
}

export interface DispatchBatchResponse {
  decisions: DispatchDecisionResponse[];
  total_dispatched: number;
  algorithm_version: string;
}

export interface DispatchQueueResponse {
  pending_jobs: number;
  available_machines: number;
  queued_jobs: number;
  next_dispatch: Array<{
    job_id: string;
    job_name: string;
    priority_level: number;
    is_hot_lot: boolean;
  }>;
}

export interface MachineStatsResponse {
  machine_id: string;
  name: string;
  status: string;
  efficiency_rating: number;
  utilization_24h: number;
  avg_temperature_24h: number | null;
  avg_vibration_24h: number | null;
  anomaly_count_24h: number;
  recent_readings: Array<Record<string, unknown>>;
}

export interface CreateJobPayload {
  job_name: string;
  wafer_count: number;
  priority_level: number;
  recipe_type: string;
  is_hot_lot: boolean;
  customer_tag?: string;
  deadline?: string;
  estimated_duration_minutes?: number;
}

export interface ChaosRequest {
  failure_type: 'machine_down' | 'sensor_spike' | 'efficiency_drop';
  machine_id?: string;
  severity?: 'low' | 'medium' | 'high';
}

export const api = {
  // Machines
  updateMachine: (id: string, body: { status?: string; efficiency_rating?: number }) =>
    request(`/api/v1/machines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getMachineStats: (id: string) =>
    request<MachineStatsResponse>(`/api/v1/machines/${id}/stats`),

  // Jobs
  createJob: (body: CreateJobPayload) =>
    request(`/api/v1/jobs`, { method: 'POST', body: JSON.stringify(body) }),
  cancelJob: (id: string) =>
    request(`/api/v1/jobs/${id}/cancel`, { method: 'POST' }),
  updateJob: (id: string, body: { status?: string; assigned_machine_id?: string }) =>
    request(`/api/v1/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Dispatch
  runDispatch: (body?: { max_dispatches?: number; priority_filter?: number }) =>
    request<DispatchBatchResponse>(`/api/v1/dispatch/run`, { method: 'POST', body: JSON.stringify(body || {}) }),
  getDispatchQueue: () =>
    request<DispatchQueueResponse>(`/api/v1/dispatch/queue`),
  getDispatchHistory: (limit = 20) =>
    request<DispatchDecisionResponse[]>(`/api/v1/dispatch/history?limit=${limit}`),

  // Chaos
  injectChaos: (body: ChaosRequest) =>
    request(`/api/v1/chaos/inject`, { method: 'POST', body: JSON.stringify(body) }),
  recoverMachine: (id: string) =>
    request(`/api/v1/chaos/recover/${id}`, { method: 'POST' }),

  // Analytics
  getAnomalies: (days = 7) =>
    request<{ total_readings: number; anomalies_detected: number; anomaly_rate: number }>(
      `/api/v1/analytics/anomalies?days=${days}`
    ),

  // Virtual Metrology
  getVMPredictions: (toolId: string, limit = 50) =>
    request<VMPredictionRecord[]>(`/api/v1/vm/predictions/${toolId}?limit=${limit}`),

  requestVMPrediction: (body: {
    tool_id: string;
    lot_id: string;
    temperature: number;
    pressure: number;
    power_consumption: number;
  }) =>
    request<{
      lot_id: string;
      tool_id: string;
      predicted_thickness_nm: number;
      confidence_score: number;
      r2r_correction: number;
      prediction_id: string;
    }>(`/api/v1/vm/predict`, { method: 'POST', body: JSON.stringify(body) }),

  submitVMFeedback: (body: { prediction_id: string; actual_thickness_nm: number }) =>
    request<{
      prediction_error: number;
      ewma_error: number;
      recipe_adjustment?: { parameter_name: string; adjustment_value: number; reason: string } | null;
    }>(`/api/v1/vm/feedback`, { method: 'POST', body: JSON.stringify(body) }),

  getRecipeAdjustments: (toolId: string, limit = 20) =>
    request<RecipeAdjustment[]>(`/api/v1/vm/adjustments/${toolId}?limit=${limit}`),

  getVMModelInfo: () =>
    request<{ is_trained: boolean; features: string[]; ewma_tracked_tools: number; model_path: string }>(
      `/api/v1/vm/model/info`
    ),

  // VM Status & History (for frontend integration)
  getVMStatus: (machineId: string) =>
    request<{
      machine_id: string;
      has_prediction: boolean;
      predicted_thickness_nm?: number;
      confidence_score?: number;
      r2r_correction?: number;
      ewma_error?: number;
      needs_correction?: boolean;
      last_updated?: string;
      message?: string;
    }>(`/api/v1/vm/status/${machineId}`),

  getVMHistory: (machineId: string, hours = 24) =>
    request<{
      machine_id: string;
      history: Array<{
        recorded_at: string;
        predicted_thickness_nm?: number;
        temperature?: number;
        pressure?: number;
        power_consumption?: number;
      }>;
      trend: 'improving' | 'stable' | 'degrading' | 'increasing' | 'decreasing';
      avg_thickness: number;
      std_thickness: number;
    }>(`/api/v1/vm/history/${machineId}?hours=${hours}`),
};
