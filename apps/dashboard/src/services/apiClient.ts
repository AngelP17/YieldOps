const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'API Error');
  }
  return res.json();
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
};
