import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react';
import { Machine, ProductionJob } from './types';
import { useRealtimeMachines, useLatestSensorData, useRealtimeJobs } from './hooks/useRealtime';
import { useAutonomousSimulation } from './hooks/useAutonomousSimulation';
import { useJobStream, useJobArrivals } from './hooks/useJobStream';
import { isApiConfigured, isSupabaseConfigured } from './services/apiClient';
import { OverviewTab } from './components/tabs/OverviewTab';
import { MachinesTab } from './components/tabs/MachinesTab';
import { JobsTab } from './components/tabs/JobsTab';
import { JobArrivalNotifications, JobArrivalBadge } from './components/JobArrivalNotifications';
import { RealtimeJobFeed } from './components/RealtimeJobFeed';
import {
  Factory,
  BarChart3,
  Cpu,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause,
  LayoutDashboard
} from 'lucide-react';

// =====================================================
// REALISTIC SEED DATA: TSMC Smart Factory
// Matches database/seed.sql exactly
// 48 machines representing a realistic semiconductor fab
// =====================================================

const MOCK_MACHINES: Machine[] = [
  // ZONE A: Lithography (Critical bottleneck - most machines)
  { machine_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'LITHO-01', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.96, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 24, total_wafers_processed: 45234, last_maintenance: '2024-12-15', created_at: '2024-01-01', updated_at: '2024-12-15' },
  { machine_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'LITHO-02', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.94, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 18, total_wafers_processed: 42890, last_maintenance: '2024-12-12', created_at: '2024-01-01', updated_at: '2024-12-12' },
  { machine_id: 'c1d2e3f4-a5b6-7890-cdef-1234567890ab', name: 'LITHO-03', type: 'lithography', status: 'IDLE', efficiency_rating: 0.92, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 0, total_wafers_processed: 38500, last_maintenance: '2024-12-09', created_at: '2024-01-01', updated_at: '2024-12-09' },
  { machine_id: 'd2e3f4a5-b6c7-8901-defa-2345678901bc', name: 'LITHO-04', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.95, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 22, total_wafers_processed: 44100, last_maintenance: '2024-12-14', created_at: '2024-01-01', updated_at: '2024-12-14' },
  { machine_id: 'e3f4a5b6-c7d8-9012-efab-3456789012cd', name: 'LITHO-05', type: 'lithography', status: 'MAINTENANCE', efficiency_rating: 0.89, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 0, total_wafers_processed: 32100, last_maintenance: '2024-12-02', created_at: '2024-01-01', updated_at: '2024-12-02' },
  { machine_id: 'f4a5b6c7-d8e9-0123-fabc-4567890123de', name: 'LITHO-06', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.93, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 20, total_wafers_processed: 39800, last_maintenance: '2024-12-11', created_at: '2024-01-01', updated_at: '2024-12-11' },
  { machine_id: 'a5b6c7d8-e9f0-1234-abcd-5678901234ef', name: 'LITHO-07', type: 'lithography', status: 'IDLE', efficiency_rating: 0.91, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 0, total_wafers_processed: 36500, last_maintenance: '2024-12-05', created_at: '2024-01-01', updated_at: '2024-12-05' },
  { machine_id: 'b6c7d8e9-f0a1-2345-bcde-6789012345fa', name: 'LITHO-08', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.97, location_zone: 'ZONE_A', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 25, total_wafers_processed: 47800, last_maintenance: '2024-12-16', created_at: '2024-01-01', updated_at: '2024-12-16' },

  // ZONE B: Etching (Dry and Wet etch systems)
  { machine_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', name: 'ETCH-01', type: 'etching', status: 'RUNNING', efficiency_rating: 0.93, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 16, total_wafers_processed: 38900, last_maintenance: '2024-12-13', created_at: '2024-01-01', updated_at: '2024-12-13' },
  { machine_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', name: 'ETCH-02', type: 'etching', status: 'RUNNING', efficiency_rating: 0.88, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 14, total_wafers_processed: 34200, last_maintenance: '2024-12-06', created_at: '2024-01-01', updated_at: '2024-12-06' },
  { machine_id: 'c7d8e9f0-a1b2-3456-cdef-7890123456ab', name: 'ETCH-03', type: 'etching', status: 'IDLE', efficiency_rating: 0.90, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 0, total_wafers_processed: 32100, last_maintenance: '2024-12-09', created_at: '2024-01-01', updated_at: '2024-12-09' },
  { machine_id: 'd8e9f0a1-b2c3-4567-defa-8901234567bc', name: 'ETCH-04', type: 'etching', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 15, total_wafers_processed: 35400, last_maintenance: '2024-12-12', created_at: '2024-01-01', updated_at: '2024-12-12' },
  { machine_id: 'e9f0a1b2-c3d4-5678-efab-9012345678cd', name: 'ETCH-05', type: 'etching', status: 'DOWN', efficiency_rating: 0.85, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 0, total_wafers_processed: 29800, last_maintenance: '2024-11-26', created_at: '2024-01-01', updated_at: '2024-11-26' },
  { machine_id: 'f0a1b2c3-d4e5-6789-fabc-0123456789de', name: 'ETCH-06', type: 'etching', status: 'RUNNING', efficiency_rating: 0.89, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 13, total_wafers_processed: 33600, last_maintenance: '2024-12-07', created_at: '2024-01-01', updated_at: '2024-12-07' },
  { machine_id: 'a1b2c3d4-e5f6-7890-abcd-1234567890ef', name: 'ETCH-07', type: 'etching', status: 'RUNNING', efficiency_rating: 0.92, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 17, total_wafers_processed: 37100, last_maintenance: '2024-12-11', created_at: '2024-01-01', updated_at: '2024-12-11' },
  { machine_id: 'b2c3d4e5-f6a7-8901-bcde-2345678901fa', name: 'ETCH-08', type: 'etching', status: 'IDLE', efficiency_rating: 0.87, location_zone: 'ZONE_B', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 0, total_wafers_processed: 31500, last_maintenance: '2024-12-05', created_at: '2024-01-01', updated_at: '2024-12-05' },

  // ZONE C: Deposition (CVD, PVD, ALD systems)
  { machine_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', name: 'DEP-01', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 19, total_wafers_processed: 36400, last_maintenance: '2024-12-12', created_at: '2024-01-01', updated_at: '2024-12-12' },
  { machine_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345', name: 'DEP-02', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.88, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 16, total_wafers_processed: 33800, last_maintenance: '2024-12-08', created_at: '2024-01-01', updated_at: '2024-12-08' },
  { machine_id: 'c3d4e5f6-a7b8-9012-abcd-567890123456', name: 'DEP-03', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.90, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 18, total_wafers_processed: 35200, last_maintenance: '2024-12-10', created_at: '2024-01-01', updated_at: '2024-12-10' },
  { machine_id: 'd4e5f6a7-b8c9-0123-bcde-678901234567', name: 'DEP-04', type: 'deposition', status: 'IDLE', efficiency_rating: 0.86, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 0, total_wafers_processed: 28400, last_maintenance: '2024-12-02', created_at: '2024-01-01', updated_at: '2024-12-02' },
  { machine_id: 'e5f6a7b8-c9d0-1234-cdef-789012345678', name: 'DEP-05', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.92, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 20, total_wafers_processed: 37800, last_maintenance: '2024-12-13', created_at: '2024-01-01', updated_at: '2024-12-13' },
  { machine_id: 'f6a7b8c9-d0e1-2345-defa-890123456789', name: 'DEP-06', type: 'deposition', status: 'MAINTENANCE', efficiency_rating: 0.84, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 0, total_wafers_processed: 25600, last_maintenance: '2024-11-28', created_at: '2024-01-01', updated_at: '2024-11-28' },
  { machine_id: 'a7b8c9d0-e1f2-3456-efab-901234567890', name: 'DEP-07', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.89, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 15, total_wafers_processed: 32900, last_maintenance: '2024-12-09', created_at: '2024-01-01', updated_at: '2024-12-09' },
  { machine_id: 'b8c9d0e1-f2a3-4567-fabc-012345678901', name: 'DEP-08', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.87, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 14, total_wafers_processed: 30800, last_maintenance: '2024-12-06', created_at: '2024-01-01', updated_at: '2024-12-06' },
  { machine_id: 'c9d0e1f2-a3b4-5678-abcd-123456789012', name: 'DEP-09', type: 'deposition', status: 'IDLE', efficiency_rating: 0.85, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 0, total_wafers_processed: 27500, last_maintenance: '2024-12-03', created_at: '2024-01-01', updated_at: '2024-12-03' },
  { machine_id: 'd0e1f2a3-b4c5-6789-bcde-234567890123', name: 'DEP-10', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'ZONE_C', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 17, total_wafers_processed: 34100, last_maintenance: '2024-12-11', created_at: '2024-01-01', updated_at: '2024-12-11' },

  // ZONE D: Inspection & Metrology
  { machine_id: 'a7b8c9d0-e1f2-3456-abcd-567890123456', name: 'INSP-01', type: 'inspection', status: 'RUNNING', efficiency_rating: 0.94, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 8, total_wafers_processed: 41200, last_maintenance: '2024-12-14', created_at: '2024-01-01', updated_at: '2024-12-14' },
  { machine_id: 'e1f2a3b4-c5d6-7890-abcd-345678901234', name: 'INSP-02', type: 'inspection', status: 'RUNNING', efficiency_rating: 0.92, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 7, total_wafers_processed: 38400, last_maintenance: '2024-12-10', created_at: '2024-01-01', updated_at: '2024-12-10' },
  { machine_id: 'f2a3b4c5-d6e7-8901-bcde-456789012345', name: 'INSP-03', type: 'inspection', status: 'IDLE', efficiency_rating: 0.90, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 0, total_wafers_processed: 35600, last_maintenance: '2024-12-07', created_at: '2024-01-01', updated_at: '2024-12-07' },
  { machine_id: 'a3b4c5d6-e7f8-9012-cdef-567890123456', name: 'INSP-04', type: 'inspection', status: 'RUNNING', efficiency_rating: 0.93, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 9, total_wafers_processed: 39800, last_maintenance: '2024-12-12', created_at: '2024-01-01', updated_at: '2024-12-12' },
  { machine_id: 'b4c5d6e7-f8a9-0123-defa-678901234567', name: 'INSP-05', type: 'inspection', status: 'RUNNING', efficiency_rating: 0.88, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 6, total_wafers_processed: 34200, last_maintenance: '2024-12-08', created_at: '2024-01-01', updated_at: '2024-12-08' },
  { machine_id: 'c5d6e7f8-a9b0-1234-efab-789012345678', name: 'INSP-06', type: 'inspection', status: 'DOWN', efficiency_rating: 0.86, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 0, total_wafers_processed: 29800, last_maintenance: '2024-11-24', created_at: '2024-01-01', updated_at: '2024-11-24' },
  { machine_id: 'd6e7f8a9-b0c1-2345-fabc-890123456789', name: 'INSP-07', type: 'inspection', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 8, total_wafers_processed: 36700, last_maintenance: '2024-12-09', created_at: '2024-01-01', updated_at: '2024-12-09' },
  { machine_id: 'e7f8a9b0-c1d2-3456-abcd-901234567890', name: 'INSP-08', type: 'inspection', status: 'IDLE', efficiency_rating: 0.89, location_zone: 'ZONE_D', max_temperature: 70, max_vibration: 1.5, current_wafer_count: 0, total_wafers_processed: 33400, last_maintenance: '2024-12-05', created_at: '2024-01-01', updated_at: '2024-12-05' },

  // ZONE E: Cleaning & Surface Prep
  { machine_id: 'b8c9d0e1-f2a3-4567-bcde-678901234567', name: 'CLEAN-01', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.90, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 21, total_wafers_processed: 45600, last_maintenance: '2024-12-10', created_at: '2024-01-01', updated_at: '2024-12-10' },
  { machine_id: 'f8a9b0c1-d2e3-4567-abcd-0123456789ab', name: 'CLEAN-02', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.87, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 19, total_wafers_processed: 42300, last_maintenance: '2024-12-06', created_at: '2024-01-01', updated_at: '2024-12-06' },
  { machine_id: 'a9b0c1d2-e3f4-5678-bcde-1234567890bc', name: 'CLEAN-03', type: 'cleaning', status: 'IDLE', efficiency_rating: 0.89, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 0, total_wafers_processed: 39800, last_maintenance: '2024-12-08', created_at: '2024-01-01', updated_at: '2024-12-08' },
  { machine_id: 'b0c1d2e3-f4a5-6789-cdef-2345678901cd', name: 'CLEAN-04', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.91, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 22, total_wafers_processed: 46700, last_maintenance: '2024-12-11', created_at: '2024-01-01', updated_at: '2024-12-11' },
  { machine_id: 'c1d2e3f4-a5b6-7890-defa-3456789012de', name: 'CLEAN-05', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.85, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 18, total_wafers_processed: 41200, last_maintenance: '2024-12-04', created_at: '2024-01-01', updated_at: '2024-12-04' },
  { machine_id: 'd2e3f4a5-b6c7-8901-efab-4567890123ef', name: 'CLEAN-06', type: 'cleaning', status: 'MAINTENANCE', efficiency_rating: 0.83, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 0, total_wafers_processed: 37800, last_maintenance: '2024-11-30', created_at: '2024-01-01', updated_at: '2024-11-30' },
  { machine_id: 'e3f4a5b6-c7d8-9012-fabc-5678901234fa', name: 'CLEAN-07', type: 'cleaning', status: 'RUNNING', efficiency_rating: 0.88, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 20, total_wafers_processed: 43400, last_maintenance: '2024-12-09', created_at: '2024-01-01', updated_at: '2024-12-09' },
  { machine_id: 'f4a5b6c7-d8e9-0123-abcd-6789012345ab', name: 'CLEAN-08', type: 'cleaning', status: 'IDLE', efficiency_rating: 0.86, location_zone: 'ZONE_E', max_temperature: 65, max_vibration: 2.0, current_wafer_count: 0, total_wafers_processed: 38900, last_maintenance: '2024-12-02', created_at: '2024-01-01', updated_at: '2024-12-02' },

  // ZONE F: Additional Lithography (Expansion bay)
  { machine_id: 'a5b6c7d8-e9f0-1234-abcd-7890123456bc', name: 'LITHO-09', type: 'lithography', status: 'RUNNING', efficiency_rating: 0.95, location_zone: 'ZONE_F', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 23, total_wafers_processed: 32100, last_maintenance: '2024-12-12', created_at: '2024-01-01', updated_at: '2024-12-12' },
  { machine_id: 'b6c7d8e9-f0a1-2345-bcde-8901234567cd', name: 'LITHO-10', type: 'lithography', status: 'IDLE', efficiency_rating: 0.93, location_zone: 'ZONE_F', max_temperature: 75, max_vibration: 2.5, current_wafer_count: 0, total_wafers_processed: 28400, last_maintenance: '2024-12-07', created_at: '2024-01-01', updated_at: '2024-12-07' },

  // ZONE G: Additional Etching (High-capacity etch bay)
  { machine_id: 'c7d8e9f0-a1b2-3456-cdef-9012345678de', name: 'ETCH-09', type: 'etching', status: 'RUNNING', efficiency_rating: 0.90, location_zone: 'ZONE_G', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 15, total_wafers_processed: 25600, last_maintenance: '2024-12-10', created_at: '2024-01-01', updated_at: '2024-12-10' },
  { machine_id: 'd8e9f0a1-b2c3-4567-defa-0123456789ef', name: 'ETCH-10', type: 'etching', status: 'RUNNING', efficiency_rating: 0.88, location_zone: 'ZONE_G', max_temperature: 85, max_vibration: 4.0, current_wafer_count: 14, total_wafers_processed: 23800, last_maintenance: '2024-12-08', created_at: '2024-01-01', updated_at: '2024-12-08' },

  // ZONE H: Additional Deposition (ALD expansion)
  { machine_id: 'e9f0a1b2-c3d4-5678-efab-1234567890fa', name: 'DEP-11', type: 'deposition', status: 'IDLE', efficiency_rating: 0.87, location_zone: 'ZONE_H', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 0, total_wafers_processed: 21200, last_maintenance: '2024-12-05', created_at: '2024-01-01', updated_at: '2024-12-05' },
  { machine_id: 'f0a1b2c3-d4e5-6789-fabc-2345678901ab', name: 'DEP-12', type: 'deposition', status: 'RUNNING', efficiency_rating: 0.89, location_zone: 'ZONE_H', max_temperature: 80, max_vibration: 3.0, current_wafer_count: 16, total_wafers_processed: 23400, last_maintenance: '2024-12-09', created_at: '2024-01-01', updated_at: '2024-12-09' },
];

// =====================================================
// REALISTIC PRODUCTION JOBS
// Matches database/seed.sql exactly
// =====================================================

const MOCK_JOBS: ProductionJob[] = [
  // Hot Lots (Priority 1) - VIP customers, urgent orders
  { job_id: 'c9d0e1f2-a3b4-5678-cdef-789012345678', job_name: 'HOT-LOT-001', wafer_count: 25, priority_level: 1, status: 'RUNNING', recipe_type: 'ADVANCED_LOGIC', assigned_machine_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', estimated_duration_minutes: 180, actual_start_time: '2024-12-16T08:00:00Z', deadline: '2024-12-17T00:00:00Z', customer_tag: 'APPLE', is_hot_lot: true, created_at: '2024-12-16T06:00:00Z', updated_at: '2024-12-16T08:00:00Z' },
  { job_id: 'd0e1f2a3-b4c5-6789-defa-890123456789', job_name: 'HOT-LOT-002', wafer_count: 25, priority_level: 1, status: 'QUEUED', recipe_type: '5NM_FINFE', estimated_duration_minutes: 240, deadline: '2024-12-17T06:00:00Z', customer_tag: 'NVIDIA', is_hot_lot: true, created_at: '2024-12-16T06:30:00Z', updated_at: '2024-12-16T06:30:00Z' },
  { job_id: 'e2f3a4b5-c6d7-8901-efab-123456789abc', job_name: 'HOT-LOT-003', wafer_count: 25, priority_level: 1, status: 'PENDING', recipe_type: 'AI_ACCELERATOR', estimated_duration_minutes: 200, deadline: '2024-12-17T02:00:00Z', customer_tag: 'GOOGLE', is_hot_lot: true, created_at: '2024-12-16T07:00:00Z', updated_at: '2024-12-16T07:00:00Z' },
  { job_id: 'f3a4b5c6-d7e8-9012-fabc-234567890bcd', job_name: 'HOT-LOT-004', wafer_count: 25, priority_level: 1, status: 'RUNNING', recipe_type: 'HPC_CPU', assigned_machine_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', estimated_duration_minutes: 220, actual_start_time: '2024-12-16T09:00:00Z', deadline: '2024-12-17T04:00:00Z', customer_tag: 'AMAZON', is_hot_lot: true, created_at: '2024-12-16T07:30:00Z', updated_at: '2024-12-16T09:00:00Z' },
  { job_id: 'a4b5c6d7-e8f9-0123-abcd-345678901cde', job_name: 'HOT-LOT-005', wafer_count: 25, priority_level: 1, status: 'PENDING', recipe_type: 'MOBILE_SOC', estimated_duration_minutes: 190, deadline: '2024-12-17T08:00:00Z', customer_tag: 'SAMSUNG', is_hot_lot: true, created_at: '2024-12-16T08:00:00Z', updated_at: '2024-12-16T08:00:00Z' },

  // High Priority (Priority 2) - Major customers
  { job_id: 'e1f2a3b4-c5d6-7890-efab-901234567890', job_name: 'WAFER-BATCH-103', wafer_count: 50, priority_level: 2, status: 'RUNNING', recipe_type: 'STANDARD_LOGIC', assigned_machine_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', estimated_duration_minutes: 300, actual_start_time: '2024-12-16T07:30:00Z', deadline: '2024-12-17T12:00:00Z', customer_tag: 'AMD', is_hot_lot: false, created_at: '2024-12-15T10:00:00Z', updated_at: '2024-12-16T07:30:00Z' },
  { job_id: 'f2a3b4c5-d6e7-8901-fabc-012345678901', job_name: 'WAFER-BATCH-104', wafer_count: 50, priority_level: 2, status: 'QUEUED', recipe_type: 'MEMORY_DRAM', estimated_duration_minutes: 280, deadline: '2024-12-17T18:00:00Z', customer_tag: 'MICRON', is_hot_lot: false, created_at: '2024-12-15T11:00:00Z', updated_at: '2024-12-15T11:00:00Z' },
  { job_id: 'b5c6d7e8-f9a0-1234-bcde-456789012def', job_name: 'WAFER-BATCH-109', wafer_count: 50, priority_level: 2, status: 'PENDING', recipe_type: 'GPU_DIE', estimated_duration_minutes: 320, deadline: '2024-12-17T16:00:00Z', customer_tag: 'NVIDIA', is_hot_lot: false, created_at: '2024-12-15T14:00:00Z', updated_at: '2024-12-15T14:00:00Z' },
  { job_id: 'c6d7e8f9-a0b1-2345-cdef-567890123efa', job_name: 'WAFER-BATCH-110', wafer_count: 50, priority_level: 2, status: 'RUNNING', recipe_type: 'NETWORK_CHIP', assigned_machine_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', estimated_duration_minutes: 290, actual_start_time: '2024-12-16T08:30:00Z', deadline: '2024-12-17T14:00:00Z', customer_tag: 'BROADCOM', is_hot_lot: false, created_at: '2024-12-15T15:00:00Z', updated_at: '2024-12-16T08:30:00Z' },
  { job_id: 'd7e8f9a0-b1c2-3456-defa-678901234fab', job_name: 'WAFER-BATCH-111', wafer_count: 50, priority_level: 2, status: 'PENDING', recipe_type: 'FPGA', estimated_duration_minutes: 310, deadline: '2024-12-17T20:00:00Z', customer_tag: 'XILINX', is_hot_lot: false, created_at: '2024-12-15T16:00:00Z', updated_at: '2024-12-15T16:00:00Z' },
  { job_id: 'e8f9a0b1-c2d3-4567-efab-789012345abc', job_name: 'WAFER-BATCH-112', wafer_count: 50, priority_level: 2, status: 'QUEUED', recipe_type: 'MODEM_5G', estimated_duration_minutes: 280, deadline: '2024-12-17T17:00:00Z', customer_tag: 'QUALCOMM', is_hot_lot: false, created_at: '2024-12-15T17:00:00Z', updated_at: '2024-12-15T17:00:00Z' },

  // Medium Priority (Priority 3) - Standard production
  { job_id: 'a3b4c5d6-e7f8-9012-abcd-123456789012', job_name: 'WAFER-BATCH-105', wafer_count: 100, priority_level: 3, status: 'RUNNING', recipe_type: 'IO_CONTROLLER', assigned_machine_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345', estimated_duration_minutes: 420, actual_start_time: '2024-12-16T06:00:00Z', deadline: '2024-12-18T12:00:00Z', customer_tag: 'QUALCOMM', is_hot_lot: false, created_at: '2024-12-14T09:00:00Z', updated_at: '2024-12-16T06:00:00Z' },
  { job_id: 'b4c5d6e7-f8a9-0123-bcde-234567890123', job_name: 'WAFER-BATCH-106', wafer_count: 100, priority_level: 3, status: 'QUEUED', recipe_type: 'POWER_MANAGEMENT', estimated_duration_minutes: 360, deadline: '2024-12-18T16:00:00Z', customer_tag: 'TI', is_hot_lot: false, created_at: '2024-12-14T10:00:00Z', updated_at: '2024-12-14T10:00:00Z' },
  { job_id: 'f9a0b1c2-d3e4-5678-fabc-890123456bcd', job_name: 'WAFER-BATCH-113', wafer_count: 100, priority_level: 3, status: 'PENDING', recipe_type: 'MICROCONTROLLER', estimated_duration_minutes: 400, deadline: '2024-12-18T14:00:00Z', customer_tag: 'NXP', is_hot_lot: false, created_at: '2024-12-15T08:00:00Z', updated_at: '2024-12-15T08:00:00Z' },
  { job_id: 'a0b1c2d3-e4f5-6789-abcd-901234567cde', job_name: 'WAFER-BATCH-114', wafer_count: 100, priority_level: 3, status: 'RUNNING', recipe_type: 'SENSOR_HUB', assigned_machine_id: 'c3d4e5f6-a7b8-9012-abcd-567890123456', estimated_duration_minutes: 380, actual_start_time: '2024-12-16T09:30:00Z', deadline: '2024-12-18T18:00:00Z', customer_tag: 'ST', is_hot_lot: false, created_at: '2024-12-15T09:00:00Z', updated_at: '2024-12-16T09:30:00Z' },
  { job_id: 'b1c2d3e4-f5a6-7890-bcde-012345678def', job_name: 'WAFER-BATCH-115', wafer_count: 100, priority_level: 3, status: 'PENDING', recipe_type: 'RF_FRONTEND', estimated_duration_minutes: 370, deadline: '2024-12-18T20:00:00Z', customer_tag: 'SKYWORKS', is_hot_lot: false, created_at: '2024-12-15T10:00:00Z', updated_at: '2024-12-15T10:00:00Z' },
  { job_id: 'c2d3e4f5-a6b7-8901-cdef-123456789efa', job_name: 'WAFER-BATCH-116', wafer_count: 100, priority_level: 3, status: 'QUEUED', recipe_type: 'WIFI_6E', estimated_duration_minutes: 390, deadline: '2024-12-18T15:00:00Z', customer_tag: 'MEDIATEK', is_hot_lot: false, created_at: '2024-12-15T11:00:00Z', updated_at: '2024-12-15T11:00:00Z' },
  { job_id: 'd3e4f5a6-b7c8-9012-defa-234567890fab', job_name: 'WAFER-BATCH-117', wafer_count: 100, priority_level: 3, status: 'PENDING', recipe_type: 'BLUETOOTH_SOC', estimated_duration_minutes: 360, deadline: '2024-12-18T19:00:00Z', customer_tag: 'NORDIC', is_hot_lot: false, created_at: '2024-12-15T12:00:00Z', updated_at: '2024-12-15T12:00:00Z' },
  { job_id: 'e4f5a6b7-c8d9-0123-efab-345678901abc', job_name: 'WAFER-BATCH-118', wafer_count: 100, priority_level: 3, status: 'RUNNING', recipe_type: 'DISPLAY_DRIVER', assigned_machine_id: 'd4e5f6a7-b8c9-0123-bcde-678901234567', estimated_duration_minutes: 410, actual_start_time: '2024-12-16T07:00:00Z', deadline: '2024-12-18T13:00:00Z', customer_tag: 'REALTEK', is_hot_lot: false, created_at: '2024-12-15T13:00:00Z', updated_at: '2024-12-16T07:00:00Z' },

  // Standard Priority (Priority 4) - Regular orders
  { job_id: 'c5d6e7f8-a9b0-1234-cdef-345678901234', job_name: 'WAFER-BATCH-107', wafer_count: 200, priority_level: 4, status: 'QUEUED', recipe_type: 'ANALOG_MIXER', estimated_duration_minutes: 600, deadline: '2024-12-19T12:00:00Z', customer_tag: 'ADI', is_hot_lot: false, created_at: '2024-12-13T14:00:00Z', updated_at: '2024-12-13T14:00:00Z' },
  { job_id: 'f5a6b7c8-d9e0-2345-fabc-456789012bcd', job_name: 'WAFER-BATCH-119', wafer_count: 200, priority_level: 4, status: 'PENDING', recipe_type: 'VOLTAGE_REGULATOR', estimated_duration_minutes: 580, deadline: '2024-12-19T14:00:00Z', customer_tag: 'MAXIM', is_hot_lot: false, created_at: '2024-12-14T15:00:00Z', updated_at: '2024-12-14T15:00:00Z' },
  { job_id: 'a6b7c8d9-e0f1-3456-abcd-567890123cde', job_name: 'WAFER-BATCH-120', wafer_count: 200, priority_level: 4, status: 'RUNNING', recipe_type: 'AUDIO_CODEC', assigned_machine_id: 'e5f6a7b8-c9d0-1234-cdef-789012345678', estimated_duration_minutes: 620, actual_start_time: '2024-12-16T08:00:00Z', deadline: '2024-12-19T10:00:00Z', customer_tag: 'CIRRUS', is_hot_lot: false, created_at: '2024-12-14T16:00:00Z', updated_at: '2024-12-16T08:00:00Z' },
  { job_id: 'b7c8d9e0-f1a2-4567-bcde-678901234def', job_name: 'WAFER-BATCH-121', wafer_count: 200, priority_level: 4, status: 'PENDING', recipe_type: 'LED_DRIVER', estimated_duration_minutes: 560, deadline: '2024-12-19T16:00:00Z', customer_tag: 'ONSEMI', is_hot_lot: false, created_at: '2024-12-14T17:00:00Z', updated_at: '2024-12-14T17:00:00Z' },
  { job_id: 'c8d9e0f1-a2b3-5678-cdef-789012345efa', job_name: 'WAFER-BATCH-122', wafer_count: 200, priority_level: 4, status: 'QUEUED', recipe_type: 'DC_DC_CONVERTER', estimated_duration_minutes: 590, deadline: '2024-12-19T13:00:00Z', customer_tag: 'MPS', is_hot_lot: false, created_at: '2024-12-14T18:00:00Z', updated_at: '2024-12-14T18:00:00Z' },
  { job_id: 'd9e0f1a2-b3c4-6789-defa-890123456fab', job_name: 'WAFER-BATCH-123', wafer_count: 200, priority_level: 4, status: 'PENDING', recipe_type: 'OP_AMPLIFIER', estimated_duration_minutes: 570, deadline: '2024-12-19T15:00:00Z', customer_tag: 'INTERSIL', is_hot_lot: false, created_at: '2024-12-14T19:00:00Z', updated_at: '2024-12-14T19:00:00Z' },

  // Low Priority (Priority 5) - Internal/test lots
  { job_id: 'd6e7f8a9-b0c1-2345-defa-456789012345', job_name: 'WAFER-BATCH-108', wafer_count: 300, priority_level: 5, status: 'QUEUED', recipe_type: 'TEST_CHIPS', estimated_duration_minutes: 900, deadline: '2024-12-23T12:00:00Z', customer_tag: 'INTERNAL', is_hot_lot: false, created_at: '2024-12-12T10:00:00Z', updated_at: '2024-12-12T10:00:00Z' },
  { job_id: 'e0f1a2b3-c4d5-7890-efab-901234567abc', job_name: 'WAFER-BATCH-124', wafer_count: 300, priority_level: 5, status: 'PENDING', recipe_type: 'CHARACTERIZATION', estimated_duration_minutes: 880, deadline: '2024-12-23T14:00:00Z', customer_tag: 'R&D', is_hot_lot: false, created_at: '2024-12-13T11:00:00Z', updated_at: '2024-12-13T11:00:00Z' },
  { job_id: 'f1a2b3c4-d5e6-8901-fabc-012345678bcd', job_name: 'WAFER-BATCH-125', wafer_count: 300, priority_level: 5, status: 'PENDING', recipe_type: 'QUALIFICATION', estimated_duration_minutes: 920, deadline: '2024-12-23T10:00:00Z', customer_tag: 'QA', is_hot_lot: false, created_at: '2024-12-13T12:00:00Z', updated_at: '2024-12-13T12:00:00Z' },
  { job_id: 'a2b3c4d5-e6f7-9012-abcd-123456789cde', job_name: 'WAFER-BATCH-126', wafer_count: 300, priority_level: 5, status: 'QUEUED', recipe_type: 'EXPERIMENTAL', estimated_duration_minutes: 850, deadline: '2024-12-23T16:00:00Z', customer_tag: 'R&D', is_hot_lot: false, created_at: '2024-12-13T13:00:00Z', updated_at: '2024-12-13T13:00:00Z' },
  { job_id: 'b3c4d5e6-f7a8-0123-bcde-234567890def', job_name: 'WAFER-BATCH-127', wafer_count: 300, priority_level: 5, status: 'PENDING', recipe_type: 'PROCESS_DEV', estimated_duration_minutes: 940, deadline: '2024-12-23T12:00:00Z', customer_tag: 'ENG', is_hot_lot: false, created_at: '2024-12-13T14:00:00Z', updated_at: '2024-12-13T14:00:00Z' },
];

// Context for app configuration and state management
interface AppConfigContextType {
  isUsingMockData: boolean;
  isSupabaseConnected: boolean;
  isApiConfigured: boolean;
  machines: Machine[];
  jobs: ProductionJob[];
  updateMachine: (machineId: string, updates: Partial<Machine>) => void;
  addJob: (job: ProductionJob) => void;
  updateJob: (jobId: string, updates: Partial<ProductionJob>) => void;
  refreshData: () => void;
  recoverAllMachines: () => number;
  simulationEnabled: boolean;
  setSimulationEnabled: (enabled: boolean) => void;
  simulationSpeed: 1 | 10 | 100;
  setSimulationSpeed: (speed: 1 | 10 | 100) => void;
}

const AppConfigContext = createContext<AppConfigContextType>({
  isUsingMockData: true,
  isSupabaseConnected: false,
  isApiConfigured: false,
  machines: MOCK_MACHINES,
  jobs: MOCK_JOBS,
  updateMachine: () => { },
  addJob: () => { },
  updateJob: () => { },
  refreshData: () => { },
  recoverAllMachines: () => 0,
  simulationEnabled: true,
  setSimulationEnabled: () => { },
  simulationSpeed: 1,
  setSimulationSpeed: () => { },
});

export const useAppConfig = () => useContext(AppConfigContext);

function App() {
  const { machines: realtimeMachines, isConnected: isSupabaseConnected, refresh: refreshMachines } = useRealtimeMachines();
  const { sensorData } = useLatestSensorData();
  const { jobs: realtimeJobs, refresh: refreshJobs } = useRealtimeJobs();
  const [activeTab, setActiveTab] = useState<'overview' | 'machines' | 'jobs'>('overview');
  // Job feed visible by default when Supabase is connected
  const [showJobFeed, setShowJobFeed] = useState(true);

  const hasSupabase = isSupabaseConfigured();
  const hasApi = isApiConfigured();
  const isUsingMockData = !hasSupabase;

  // Real-time job stream for Supabase mode
  const {
    jobs: streamJobs,
    stats: jobStreamStats
  } = useJobStream({
    enabled: hasSupabase,
    statusFilter: ['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED'],
    batchUpdates: true,
    batchInterval: 100,
  });

  // Job arrival notifications
  const { pendingCount, hotLotCount } = useJobArrivals({
    enabled: hasSupabase,
  });

  // Local state for mock data (allows modifications in demo mode)
  const [, setLocalMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [, setLocalJobs] = useState<ProductionJob[]>(MOCK_JOBS);

  // Use realtime data if available, otherwise use local mock data
  const [displayMachines, setDisplayMachines] = useState<Machine[]>(MOCK_MACHINES);
  const [displayJobs, setDisplayJobs] = useState<ProductionJob[]>(MOCK_JOBS);

  // =====================================================
  // DATA SOURCE SELECTION - REAL SUPABASE DATA ONLY
  // When Supabase is connected, ONLY use real data from database
  // Mock data is ONLY used as fallback when Supabase is NOT configured
  // =====================================================

  // Sync machines - REAL DATA ONLY when Supabase is connected
  useEffect(() => {
    if (hasSupabase) {
      // ALWAYS use realtime data from Supabase - never mock data
      setDisplayMachines(realtimeMachines);
    } else {
      // Demo mode fallback - only use mock when no Supabase
      setDisplayMachines(MOCK_MACHINES);
      setLocalMachines(MOCK_MACHINES);
    }
  }, [hasSupabase, realtimeMachines]);

  // Sync jobs - PRIORITIZE REAL-TIME STREAM from Supabase
  useEffect(() => {
    if (hasSupabase) {
      // Use job stream for real-time updates (more responsive than polling)
      if (streamJobs.length > 0) {
        setDisplayJobs(streamJobs);
      } else if (realtimeJobs.length > 0) {
        // Fallback to realtimeJobs if stream is empty (initial load)
        setDisplayJobs(realtimeJobs);
      }
    } else {
      // Demo mode fallback - only use mock when no Supabase
      setDisplayJobs(MOCK_JOBS);
      setLocalJobs(MOCK_JOBS);
    }
  }, [hasSupabase, streamJobs, realtimeJobs]);

  // Safety check - ensure mock data is never used when Supabase is connected
  useEffect(() => {
    if (hasSupabase) {
      // If somehow display data is mock data (by ID check), force reset to real data
      const hasMockMachine = displayMachines.some(m =>
        MOCK_MACHINES.some(mm => mm.machine_id === m.machine_id)
      );
      if (hasMockMachine && realtimeMachines.length > 0) {
        console.warn('[YieldOps] Detected mock machine data while Supabase is connected - resetting to real data');
        setDisplayMachines(realtimeMachines);
      }
    }
  }, [hasSupabase, displayMachines, realtimeMachines]);

  // Demo mode only - ensure mock data is loaded
  useEffect(() => {
    if (!hasSupabase) {
      if (displayMachines.length !== MOCK_MACHINES.length ||
        displayMachines[0]?.name !== MOCK_MACHINES[0]?.name) {
        setDisplayMachines(MOCK_MACHINES);
        setLocalMachines(MOCK_MACHINES);
      }
      if (displayJobs.length !== MOCK_JOBS.length ||
        displayJobs[0]?.job_name !== MOCK_JOBS[0]?.job_name) {
        setDisplayJobs(MOCK_JOBS);
        setLocalJobs(MOCK_JOBS);
      }
    }
  }, [hasSupabase, displayMachines.length, displayJobs.length]);

  const machinesWithSensorData = useMemo(() => {
    return displayMachines.map((m) => ({
      ...m,
      temperature: sensorData[m.machine_id]?.temperature,
      vibration: sensorData[m.machine_id]?.vibration,
    }));
  }, [displayMachines, sensorData]);

  // Update machine - works for both real and mock data with immediate UI update
  const updateMachine = useCallback((machineId: string, updates: Partial<Machine>) => {
    const updatedMachine = { ...updates, updated_at: new Date().toISOString() };

    // Always update local state for immediate UI feedback
    setLocalMachines(prev => prev.map(m =>
      m.machine_id === machineId ? { ...m, ...updatedMachine } : m
    ));

    // Also update display machines immediately
    setDisplayMachines(prev => prev.map(m =>
      m.machine_id === machineId ? { ...m, ...updatedMachine } : m
    ));

    // If using Supabase, the realtime subscription will eventually sync the real data
  }, []);

  // Add job - works for both real and mock data with immediate UI update
  const addJob = useCallback((job: ProductionJob) => {
    // Always add to local state for immediate UI feedback
    setLocalJobs(prev => [job, ...prev]);

    // Also update display jobs immediately
    setDisplayJobs(prev => [job, ...prev]);

    // If using Supabase, refresh to get the real data
    if (hasSupabase) {
      setTimeout(() => refreshJobs(), 500);
    }
  }, [hasSupabase, refreshJobs]);

  // Update job - works for both real and mock data with immediate UI update
  const updateJob = useCallback((jobId: string, updates: Partial<ProductionJob>) => {
    const updatedJob = { ...updates, updated_at: new Date().toISOString() };

    // Always update local state for immediate UI feedback
    setLocalJobs(prev => prev.map(j =>
      j.job_id === jobId ? { ...j, ...updatedJob } : j
    ));

    // Also update display jobs immediately
    setDisplayJobs(prev => prev.map(j =>
      j.job_id === jobId ? { ...j, ...updatedJob } : j
    ));

    // If using Supabase, the realtime subscription will eventually sync the real data
  }, []);

  // Refresh data
  const refreshData = useCallback(() => {
    if (hasSupabase) {
      refreshMachines();
      refreshJobs();
    }
    // For demo mode, just keep current state
  }, [hasSupabase, refreshMachines, refreshJobs]);

  // Autonomous simulation toggle - DISABLED when Supabase is connected
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<1 | 10 | 100>(1);

  // Start autonomous simulation ONLY in demo mode (not with Supabase)
  useAutonomousSimulation({
    enabled: simulationEnabled && !hasSupabase,
    jobProgressionInterval: Math.max(50, 5000 / simulationSpeed),
    machineEventInterval: Math.max(80, 8000 / simulationSpeed),
    newJobInterval: Math.max(150, 15000 / simulationSpeed),
    sensorDataInterval: Math.max(30, 3000 / simulationSpeed),
  });

  // Recover all broken machines at once
  const recoverAllMachines = useCallback(() => {
    const brokenMachines = displayMachines.filter(m => m.status === 'DOWN' || m.status === 'MAINTENANCE');
    brokenMachines.forEach(machine => {
      updateMachine(machine.machine_id, { status: 'IDLE', efficiency_rating: 0.90 });
    });
    return brokenMachines.length;
  }, [displayMachines, updateMachine]);

  const appConfigValue: AppConfigContextType = {
    isUsingMockData,
    isSupabaseConnected,
    isApiConfigured: hasApi,
    machines: machinesWithSensorData,
    jobs: displayJobs,
    updateMachine,
    addJob,
    updateJob,
    refreshData,
    recoverAllMachines,
    simulationEnabled,
    setSimulationEnabled,
    simulationSpeed,
    setSimulationSpeed,
  };

  return (
    <AppConfigContext.Provider value={appConfigValue}>
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 md:h-16">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-200">
                  <Factory className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">YieldOps</h1>
                  <p className="text-xs text-slate-500 font-medium hidden sm:block">Smart Manufacturing Platform</p>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'machines', label: 'Machines', icon: Cpu },
                  { id: 'jobs', label: 'Jobs', icon: Layers },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'overview' | 'machines' | 'jobs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-1.5 sm:gap-3">
                {/* Demo Mode Badge - only shown when using mock data */}
                {isUsingMockData && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Demo Mode</span>
                  </div>
                )}

                {/* Simulation Controls - ONLY shown in demo mode (mock data) */}
                {isUsingMockData && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSimulationEnabled(!simulationEnabled)}
                      className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${simulationEnabled
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      title="Toggle demo simulation"
                    >
                      {simulationEnabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      <span className="hidden sm:inline">{simulationEnabled ? 'Sim' : 'Paused'}</span>
                    </button>

                    {simulationEnabled && (
                      <div className="flex items-center gap-0.5 sm:gap-1 ml-1">
                        {([1, 10, 100] as const).map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setSimulationSpeed(speed)}
                            className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors ${simulationSpeed === speed
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            title={`${speed}x speed`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Connection Status - Simplified to just show Connected/Offline */}
                {!isUsingMockData && (
                  <div className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full ${isSupabaseConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isSupabaseConnected ? (
                      <>
                        <Wifi className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs font-medium">Connected</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs font-medium">Offline</span>
                      </>
                    )}
                  </div>
                )}
                
                {/* Job Stream Badge - shows in Supabase mode */}
                {hasSupabase && (
                  <JobArrivalBadge onClick={() => setShowJobFeed(!showJobFeed)} />
                )}

                <button
                  onClick={refreshData}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Job Arrival Notifications */}
        {hasSupabase && <JobArrivalNotifications enabled={true} />}

        <main className="px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
          {/* Real-time Job Feed - Collapsible in Supabase mode */}
          {hasSupabase && showJobFeed && (
            <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
              <RealtimeJobFeed 
                jobs={streamJobs}
                maxItems={15} 
                className="shadow-lg"
                isConnected={isSupabaseConnected}
                isLoading={false}
                onRefresh={refreshJobs}
              />
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              machines={machinesWithSensorData}
              jobs={displayJobs}
              jobStreamStats={hasSupabase ? jobStreamStats : undefined}
            />
          )}
          {activeTab === 'machines' && (
            <MachinesTab machines={machinesWithSensorData} />
          )}
          {activeTab === 'jobs' && (
            <JobsTab
              jobs={displayJobs}
              machines={machinesWithSensorData}
              isRealTime={hasSupabase}
              pendingCount={hasSupabase ? pendingCount : undefined}
              hotLotCount={hasSupabase ? hotLotCount : undefined}
            />
          )}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
          <div className="flex items-center justify-around">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'machines', label: 'Machines', icon: Cpu },
              { id: 'jobs', label: 'Jobs', icon: Layers },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'machines' | 'jobs')}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 min-h-[48px] transition-colors ${activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-slate-400'
                  }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </AppConfigContext.Provider>
  );
}

export default App;
