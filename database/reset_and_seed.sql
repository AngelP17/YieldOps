-- =====================================================
-- RESET AND SEED: TSMC SMART FACTORY
-- Run this in Supabase SQL Editor to reset and load realistic data
-- =====================================================

-- Step 1: Clear existing data (in correct order to avoid FK constraints)
DELETE FROM dispatch_decisions;
DELETE FROM vm_predictions;
DELETE FROM metrology_results;
DELETE FROM recipe_adjustments;
DELETE FROM anomaly_alerts;
DELETE FROM maintenance_logs;
DELETE FROM capacity_simulations;
DELETE FROM sensor_readings;
DELETE FROM production_jobs;
DELETE FROM machines;

-- Step 2: Reset sequences if any
-- (Supabase uses UUIDs so no sequence reset needed)

-- =====================================================
-- SEED: Machines (48 machines representing a realistic fab)
-- =====================================================
INSERT INTO machines (machine_id, name, type, status, efficiency_rating, location_zone, max_temperature, max_vibration, current_wafer_count, total_wafers_processed, last_maintenance, created_at, updated_at) VALUES
-- ZONE A: Lithography (Critical bottleneck - most machines)
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'LITHO-01', 'lithography', 'RUNNING', 0.96, 'ZONE_A', 75.00, 2.50, 24, 45234, NOW() - INTERVAL '2 days', NOW(), NOW()),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'LITHO-02', 'lithography', 'RUNNING', 0.94, 'ZONE_A', 75.00, 2.50, 18, 42890, NOW() - INTERVAL '5 days', NOW(), NOW()),
('c1d2e3f4-a5b6-7890-cdef-1234567890ab', 'LITHO-03', 'lithography', 'IDLE', 0.92, 'ZONE_A', 75.00, 2.50, 0, 38500, NOW() - INTERVAL '8 days', NOW(), NOW()),
('d2e3f4a5-b6c7-8901-defa-2345678901bc', 'LITHO-04', 'lithography', 'RUNNING', 0.95, 'ZONE_A', 75.00, 2.50, 22, 44100, NOW() - INTERVAL '3 days', NOW(), NOW()),
('e3f4a5b6-c7d8-9012-efab-3456789012cd', 'LITHO-05', 'lithography', 'MAINTENANCE', 0.89, 'ZONE_A', 75.00, 2.50, 0, 32100, NOW() - INTERVAL '15 days', NOW(), NOW()),
('f4a5b6c7-d8e9-0123-fabc-4567890123de', 'LITHO-06', 'lithography', 'RUNNING', 0.93, 'ZONE_A', 75.00, 2.50, 20, 39800, NOW() - INTERVAL '6 days', NOW(), NOW()),
('a5b6c7d8-e9f0-1234-abcd-5678901234ef', 'LITHO-07', 'lithography', 'IDLE', 0.91, 'ZONE_A', 75.00, 2.50, 0, 36500, NOW() - INTERVAL '12 days', NOW(), NOW()),
('b6c7d8e9-f0a1-2345-bcde-6789012345fa', 'LITHO-08', 'lithography', 'RUNNING', 0.97, 'ZONE_A', 75.00, 2.50, 25, 47800, NOW() - INTERVAL '1 day', NOW(), NOW()),

-- ZONE B: Etching (Dry and Wet etch systems)
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'ETCH-01', 'etching', 'RUNNING', 0.93, 'ZONE_B', 85.00, 4.00, 16, 38900, NOW() - INTERVAL '3 days', NOW(), NOW()),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'ETCH-02', 'etching', 'RUNNING', 0.88, 'ZONE_B', 85.00, 4.00, 14, 34200, NOW() - INTERVAL '10 days', NOW(), NOW()),
('c7d8e9f0-a1b2-3456-cdef-7890123456ab', 'ETCH-03', 'etching', 'IDLE', 0.90, 'ZONE_B', 85.00, 4.00, 0, 32100, NOW() - INTERVAL '7 days', NOW(), NOW()),
('d8e9f0a1-b2c3-4567-defa-8901234567bc', 'ETCH-04', 'etching', 'RUNNING', 0.91, 'ZONE_B', 85.00, 4.00, 15, 35400, NOW() - INTERVAL '4 days', NOW(), NOW()),
('e9f0a1b2-c3d4-5678-efab-9012345678cd', 'ETCH-05', 'etching', 'DOWN', 0.85, 'ZONE_B', 85.00, 4.00, 0, 29800, NOW() - INTERVAL '20 days', NOW(), NOW()),
('f0a1b2c3-d4e5-6789-fabc-0123456789de', 'ETCH-06', 'etching', 'RUNNING', 0.89, 'ZONE_B', 85.00, 4.00, 13, 33600, NOW() - INTERVAL '9 days', NOW(), NOW()),
('a1b2c3d4-e5f6-7890-abcd-1234567890ef', 'ETCH-07', 'etching', 'RUNNING', 0.92, 'ZONE_B', 85.00, 4.00, 17, 37100, NOW() - INTERVAL '5 days', NOW(), NOW()),
('b2c3d4e5-f6a7-8901-bcde-2345678901fa', 'ETCH-08', 'etching', 'IDLE', 0.87, 'ZONE_B', 85.00, 4.00, 0, 31500, NOW() - INTERVAL '11 days', NOW(), NOW()),

-- ZONE C: Deposition (CVD, PVD, ALD systems)
('e5f6a7b8-c9d0-1234-efab-345678901234', 'DEP-01', 'deposition', 'RUNNING', 0.91, 'ZONE_C', 80.00, 3.00, 19, 36400, NOW() - INTERVAL '4 days', NOW(), NOW()),
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'DEP-02', 'deposition', 'RUNNING', 0.88, 'ZONE_C', 80.00, 3.00, 16, 33800, NOW() - INTERVAL '8 days', NOW(), NOW()),
('c3d4e5f6-a7b8-9012-abcd-567890123456', 'DEP-03', 'deposition', 'RUNNING', 0.90, 'ZONE_C', 80.00, 3.00, 18, 35200, NOW() - INTERVAL '6 days', NOW(), NOW()),
('d4e5f6a7-b8c9-0123-bcde-678901234567', 'DEP-04', 'deposition', 'IDLE', 0.86, 'ZONE_C', 80.00, 3.00, 0, 28400, NOW() - INTERVAL '14 days', NOW(), NOW()),
('e5f6a7b8-c9d0-1234-cdef-789012345678', 'DEP-05', 'deposition', 'RUNNING', 0.92, 'ZONE_C', 80.00, 3.00, 20, 37800, NOW() - INTERVAL '3 days', NOW(), NOW()),
('f6a7b8c9-d0e1-2345-defa-890123456789', 'DEP-06', 'deposition', 'MAINTENANCE', 0.84, 'ZONE_C', 80.00, 3.00, 0, 25600, NOW() - INTERVAL '18 days', NOW(), NOW()),
('a7b8c9d0-e1f2-3456-efab-901234567890', 'DEP-07', 'deposition', 'RUNNING', 0.89, 'ZONE_C', 80.00, 3.00, 15, 32900, NOW() - INTERVAL '7 days', NOW(), NOW()),
('b8c9d0e1-f2a3-4567-fabc-012345678901', 'DEP-08', 'deposition', 'RUNNING', 0.87, 'ZONE_C', 80.00, 3.00, 14, 30800, NOW() - INTERVAL '10 days', NOW(), NOW()),
('c9d0e1f2-a3b4-5678-abcd-123456789012', 'DEP-09', 'deposition', 'IDLE', 0.85, 'ZONE_C', 80.00, 3.00, 0, 27500, NOW() - INTERVAL '13 days', NOW(), NOW()),
('d0e1f2a3-b4c5-6789-bcde-234567890123', 'DEP-10', 'deposition', 'RUNNING', 0.91, 'ZONE_C', 80.00, 3.00, 17, 34100, NOW() - INTERVAL '5 days', NOW(), NOW()),

-- ZONE D: Inspection & Metrology
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'INSP-01', 'inspection', 'RUNNING', 0.94, 'ZONE_D', 70.00, 1.50, 8, 41200, NOW() - INTERVAL '2 days', NOW(), NOW()),
('e1f2a3b4-c5d6-7890-abcd-345678901234', 'INSP-02', 'inspection', 'RUNNING', 0.92, 'ZONE_D', 70.00, 1.50, 7, 38400, NOW() - INTERVAL '6 days', NOW(), NOW()),
('f2a3b4c5-d6e7-8901-bcde-456789012345', 'INSP-03', 'inspection', 'IDLE', 0.90, 'ZONE_D', 70.00, 1.50, 0, 35600, NOW() - INTERVAL '9 days', NOW(), NOW()),
('a3b4c5d6-e7f8-9012-cdef-567890123456', 'INSP-04', 'inspection', 'RUNNING', 0.93, 'ZONE_D', 70.00, 1.50, 9, 39800, NOW() - INTERVAL '4 days', NOW(), NOW()),
('b4c5d6e7-f8a9-0123-defa-678901234567', 'INSP-05', 'inspection', 'RUNNING', 0.88, 'ZONE_D', 70.00, 1.50, 6, 34200, NOW() - INTERVAL '8 days', NOW(), NOW()),
('c5d6e7f8-a9b0-1234-efab-789012345678', 'INSP-06', 'inspection', 'DOWN', 0.86, 'ZONE_D', 70.00, 1.50, 0, 29800, NOW() - INTERVAL '22 days', NOW(), NOW()),
('d6e7f8a9-b0c1-2345-fabc-890123456789', 'INSP-07', 'inspection', 'RUNNING', 0.91, 'ZONE_D', 70.00, 1.50, 8, 36700, NOW() - INTERVAL '7 days', NOW(), NOW()),
('e7f8a9b0-c1d2-3456-abcd-901234567890', 'INSP-08', 'inspection', 'IDLE', 0.89, 'ZONE_D', 70.00, 1.50, 0, 33400, NOW() - INTERVAL '11 days', NOW(), NOW()),

-- ZONE E: Cleaning & Surface Prep
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'CLEAN-01', 'cleaning', 'RUNNING', 0.90, 'ZONE_E', 65.00, 2.00, 21, 45600, NOW() - INTERVAL '6 days', NOW(), NOW()),
('f8a9b0c1-d2e3-4567-abcd-0123456789ab', 'CLEAN-02', 'cleaning', 'RUNNING', 0.87, 'ZONE_E', 65.00, 2.00, 19, 42300, NOW() - INTERVAL '10 days', NOW(), NOW()),
('a9b0c1d2-e3f4-5678-bcde-1234567890bc', 'CLEAN-03', 'cleaning', 'IDLE', 0.89, 'ZONE_E', 65.00, 2.00, 0, 39800, NOW() - INTERVAL '8 days', NOW(), NOW()),
('b0c1d2e3-f4a5-6789-cdef-2345678901cd', 'CLEAN-04', 'cleaning', 'RUNNING', 0.91, 'ZONE_E', 65.00, 2.00, 22, 46700, NOW() - INTERVAL '5 days', NOW(), NOW()),
('c1d2e3f4-a5b6-7890-defa-3456789012de', 'CLEAN-05', 'cleaning', 'RUNNING', 0.85, 'ZONE_E', 65.00, 2.00, 18, 41200, NOW() - INTERVAL '12 days', NOW(), NOW()),
('d2e3f4a5-b6c7-8901-efab-4567890123ef', 'CLEAN-06', 'cleaning', 'MAINTENANCE', 0.83, 'ZONE_E', 65.00, 2.00, 0, 37800, NOW() - INTERVAL '16 days', NOW(), NOW()),
('e3f4a5b6-c7d8-9012-fabc-5678901234fa', 'CLEAN-07', 'cleaning', 'RUNNING', 0.88, 'ZONE_E', 65.00, 2.00, 20, 43400, NOW() - INTERVAL '7 days', NOW(), NOW()),
('f4a5b6c7-d8e9-0123-abcd-6789012345ab', 'CLEAN-08', 'cleaning', 'IDLE', 0.86, 'ZONE_E', 65.00, 2.00, 0, 38900, NOW() - INTERVAL '14 days', NOW(), NOW()),

-- ZONE F: Additional Lithography (Expansion bay)
('a5b6c7d8-e9f0-1234-abcd-7890123456bc', 'LITHO-09', 'lithography', 'RUNNING', 0.95, 'ZONE_F', 75.00, 2.50, 23, 32100, NOW() - INTERVAL '4 days', NOW(), NOW()),
('b6c7d8e9-f0a1-2345-bcde-8901234567cd', 'LITHO-10', 'lithography', 'IDLE', 0.93, 'ZONE_F', 75.00, 2.50, 0, 28400, NOW() - INTERVAL '9 days', NOW(), NOW()),

-- ZONE G: Additional Etching (High-capacity etch bay)
('c7d8e9f0-a1b2-3456-cdef-9012345678de', 'ETCH-09', 'etching', 'RUNNING', 0.90, 'ZONE_G', 85.00, 4.00, 15, 25600, NOW() - INTERVAL '6 days', NOW(), NOW()),
('d8e9f0a1-b2c3-4567-defa-0123456789ef', 'ETCH-10', 'etching', 'RUNNING', 0.88, 'ZONE_G', 85.00, 4.00, 14, 23800, NOW() - INTERVAL '8 days', NOW(), NOW()),

-- ZONE H: Additional Deposition (ALD expansion)
('e9f0a1b2-c3d4-5678-efab-1234567890fa', 'DEP-11', 'deposition', 'IDLE', 0.87, 'ZONE_H', 80.00, 3.00, 0, 21200, NOW() - INTERVAL '11 days', NOW(), NOW()),
('f0a1b2c3-d4e5-6789-fabc-2345678901ab', 'DEP-12', 'deposition', 'RUNNING', 0.89, 'ZONE_H', 80.00, 3.00, 16, 23400, NOW() - INTERVAL '7 days', NOW(), NOW());

-- =====================================================
-- SEED: Production Jobs (Realistic fab workload)
-- =====================================================
INSERT INTO production_jobs (job_id, job_name, wafer_count, priority_level, status, recipe_type, assigned_machine_id, estimated_duration_minutes, actual_start_time, deadline, customer_tag, is_hot_lot, created_at, updated_at) VALUES
-- Hot Lots (Priority 1) - VIP customers, urgent orders
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'HOT-LOT-001', 25, 1, 'RUNNING', 'ADVANCED_LOGIC', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 180, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '12 hours', 'APPLE', TRUE, NOW(), NOW()),
('d0e1f2a3-b4c5-6789-defa-890123456789', 'HOT-LOT-002', 25, 1, 'QUEUED', '5NM_FINFE', NULL, 240, NULL, NOW() + INTERVAL '18 hours', 'NVIDIA', TRUE, NOW(), NOW()),
('e2f3a4b5-c6d7-8901-efab-123456789abc', 'HOT-LOT-003', 25, 1, 'PENDING', 'AI_ACCELERATOR', NULL, 200, NULL, NOW() + INTERVAL '14 hours', 'GOOGLE', TRUE, NOW(), NOW()),
('f3a4b5c6-d7e8-9012-fabc-234567890bcd', 'HOT-LOT-004', 25, 1, 'RUNNING', 'HPC_CPU', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 220, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '16 hours', 'AMAZON', TRUE, NOW(), NOW()),
('a4b5c6d7-e8f9-0123-abcd-345678901cde', 'HOT-LOT-005', 25, 1, 'PENDING', 'MOBILE_SOC', NULL, 190, NULL, NOW() + INTERVAL '20 hours', 'SAMSUNG', TRUE, NOW(), NOW()),

-- High Priority (Priority 2) - Major customers
('e1f2a3b4-c5d6-7890-efab-901234567890', 'WAFER-BATCH-103', 50, 2, 'RUNNING', 'STANDARD_LOGIC', 'd4e5f6a7-b8c9-0123-defa-234567890123', 300, NOW() - INTERVAL '3 hours', NOW() + INTERVAL '24 hours', 'AMD', FALSE, NOW(), NOW()),
('f2a3b4c5-d6e7-8901-fabc-012345678901', 'WAFER-BATCH-104', 50, 2, 'QUEUED', 'MEMORY_DRAM', NULL, 280, NULL, NOW() + INTERVAL '30 hours', 'MICRON', FALSE, NOW(), NOW()),
('b5c6d7e8-f9a0-1234-bcde-456789012def', 'WAFER-BATCH-109', 50, 2, 'PENDING', 'GPU_DIE', NULL, 320, NULL, NOW() + INTERVAL '28 hours', 'NVIDIA', FALSE, NOW(), NOW()),
('c6d7e8f9-a0b1-2345-cdef-567890123efa', 'WAFER-BATCH-110', 50, 2, 'RUNNING', 'NETWORK_CHIP', 'e5f6a7b8-c9d0-1234-efab-345678901234', 290, NOW() - INTERVAL '4 hours', NOW() + INTERVAL '26 hours', 'BROADCOM', FALSE, NOW(), NOW()),
('d7e8f9a0-b1c2-3456-defa-678901234fab', 'WAFER-BATCH-111', 50, 2, 'PENDING', 'FPGA', NULL, 310, NULL, NOW() + INTERVAL '32 hours', 'XILINX', FALSE, NOW(), NOW()),
('e8f9a0b1-c2d3-4567-efab-789012345abc', 'WAFER-BATCH-112', 50, 2, 'QUEUED', 'MODEM_5G', NULL, 280, NULL, NOW() + INTERVAL '29 hours', 'QUALCOMM', FALSE, NOW(), NOW()),

-- Medium Priority (Priority 3) - Standard production
('a3b4c5d6-e7f8-9012-abcd-123456789012', 'WAFER-BATCH-105', 100, 3, 'RUNNING', 'IO_CONTROLLER', 'f6a7b8c9-d0e1-2345-fabc-456789012345', 420, NOW() - INTERVAL '5 hours', NOW() + INTERVAL '48 hours', 'QUALCOMM', FALSE, NOW(), NOW()),
('b4c5d6e7-f8a9-0123-bcde-234567890123', 'WAFER-BATCH-106', 100, 3, 'QUEUED', 'POWER_MANAGEMENT', NULL, 360, NULL, NOW() + INTERVAL '52 hours', 'TI', FALSE, NOW(), NOW()),
('f9a0b1c2-d3e4-5678-fabc-890123456bcd', 'WAFER-BATCH-113', 100, 3, 'PENDING', 'MICROCONTROLLER', NULL, 400, NULL, NOW() + INTERVAL '50 hours', 'NXP', FALSE, NOW(), NOW()),
('a0b1c2d3-e4f5-6789-abcd-901234567cde', 'WAFER-BATCH-114', 100, 3, 'RUNNING', 'SENSOR_HUB', 'c3d4e5f6-a7b8-9012-abcd-567890123456', 380, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '54 hours', 'ST', FALSE, NOW(), NOW()),
('b1c2d3e4-f5a6-7890-bcde-012345678def', 'WAFER-BATCH-115', 100, 3, 'PENDING', 'RF_FRONTEND', NULL, 370, NULL, NOW() + INTERVAL '56 hours', 'SKYWORKS', FALSE, NOW(), NOW()),
('c2d3e4f5-a6b7-8901-cdef-123456789efa', 'WAFER-BATCH-116', 100, 3, 'QUEUED', 'WIFI_6E', NULL, 390, NULL, NOW() + INTERVAL '51 hours', 'MEDIATEK', FALSE, NOW(), NOW()),
('d3e4f5a6-b7c8-9012-defa-234567890fab', 'WAFER-BATCH-117', 100, 3, 'PENDING', 'BLUETOOTH_SOC', NULL, 360, NULL, NOW() + INTERVAL '55 hours', 'NORDIC', FALSE, NOW(), NOW()),
('e4f5a6b7-c8d9-0123-efab-345678901abc', 'WAFER-BATCH-118', 100, 3, 'RUNNING', 'DISPLAY_DRIVER', 'd4e5f6a7-b8c9-0123-bcde-678901234567', 410, NOW() - INTERVAL '6 hours', NOW() + INTERVAL '49 hours', 'REALTEK', FALSE, NOW(), NOW()),

-- Standard Priority (Priority 4) - Regular orders
('c5d6e7f8-a9b0-1234-cdef-345678901234', 'WAFER-BATCH-107', 200, 4, 'QUEUED', 'ANALOG_MIXER', NULL, 600, NULL, NOW() + INTERVAL '72 hours', 'ADI', FALSE, NOW(), NOW()),
('f5a6b7c8-d9e0-2345-fabc-456789012bcd', 'WAFER-BATCH-119', 200, 4, 'PENDING', 'VOLTAGE_REGULATOR', NULL, 580, NULL, NOW() + INTERVAL '74 hours', 'MAXIM', FALSE, NOW(), NOW()),
('a6b7c8d9-e0f1-3456-abcd-567890123cde', 'WAFER-BATCH-120', 200, 4, 'RUNNING', 'AUDIO_CODEC', 'e5f6a7b8-c9d0-1234-cdef-789012345678', 620, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '70 hours', 'CIRRUS', FALSE, NOW(), NOW()),
('b7c8d9e0-f1a2-4567-bcde-678901234def', 'WAFER-BATCH-121', 200, 4, 'PENDING', 'LED_DRIVER', NULL, 560, NULL, NOW() + INTERVAL '76 hours', 'ONSEMI', FALSE, NOW(), NOW()),
('c8d9e0f1-a2b3-5678-cdef-789012345efa', 'WAFER-BATCH-122', 200, 4, 'QUEUED', 'DC_DC_CONVERTER', NULL, 590, NULL, NOW() + INTERVAL '73 hours', 'MPS', FALSE, NOW(), NOW()),
('d9e0f1a2-b3c4-6789-defa-890123456fab', 'WAFER-BATCH-123', 200, 4, 'PENDING', 'OP_AMPLIFIER', NULL, 570, NULL, NOW() + INTERVAL '75 hours', 'INTERSIL', FALSE, NOW(), NOW()),

-- Low Priority (Priority 5) - Internal/test lots
('d6e7f8a9-b0c1-2345-defa-456789012345', 'WAFER-BATCH-108', 300, 5, 'QUEUED', 'TEST_CHIPS', NULL, 900, NULL, NOW() + INTERVAL '168 hours', 'INTERNAL', FALSE, NOW(), NOW()),
('e0f1a2b3-c4d5-7890-efab-901234567abc', 'WAFER-BATCH-124', 300, 5, 'PENDING', 'CHARACTERIZATION', NULL, 880, NULL, NOW() + INTERVAL '170 hours', 'R&D', FALSE, NOW(), NOW()),
('f1a2b3c4-d5e6-8901-fabc-012345678bcd', 'WAFER-BATCH-125', 300, 5, 'PENDING', 'QUALIFICATION', NULL, 920, NULL, NOW() + INTERVAL '165 hours', 'QA', FALSE, NOW(), NOW()),
('a2b3c4d5-e6f7-9012-abcd-123456789cde', 'WAFER-BATCH-126', 300, 5, 'QUEUED', 'EXPERIMENTAL', NULL, 850, NULL, NOW() + INTERVAL '172 hours', 'R&D', FALSE, NOW(), NOW()),
('b3c4d5e6-f7a8-0123-bcde-234567890def', 'WAFER-BATCH-127', 300, 5, 'PENDING', 'PROCESS_DEV', NULL, 940, NULL, NOW() + INTERVAL '168 hours', 'ENG', FALSE, NOW(), NOW());

-- =====================================================
-- SEED: Historical Sensor Readings (for ML training)
-- =====================================================
INSERT INTO sensor_readings (machine_id, temperature, vibration, pressure, power_consumption, is_anomaly, anomaly_score, recorded_at)
SELECT 
    m.machine_id,
    -- Normal readings (95% of data)
    CASE WHEN random() < 0.95 
        THEN m.max_temperature * (0.7 + random() * 0.2)
        ELSE m.max_temperature * (0.95 + random() * 0.1)  -- Anomalous
    END as temperature,
    CASE WHEN random() < 0.95 
        THEN m.max_vibration * (0.4 + random() * 0.3)
        ELSE m.max_vibration * (0.85 + random() * 0.2)  -- Anomalous
    END as vibration,
    100 + random() * 50 as pressure,
    500 + random() * 300 as power_consumption,
    random() < 0.05 as is_anomaly,
    CASE WHEN random() < 0.05 THEN 0.7 + random() * 0.25 ELSE NULL END as anomaly_score,
    NOW() - (random() * 7 || ' days')::INTERVAL - (random() * 24 || ' hours')::INTERVAL as recorded_at
FROM machines m
CROSS JOIN generate_series(1, 100) as s;

-- =====================================================
-- SEED: Sample Dispatch Decisions (for analytics)
-- =====================================================
INSERT INTO dispatch_decisions (job_id, machine_id, decision_reason, efficiency_at_dispatch, queue_depth_at_dispatch, dispatched_at)
SELECT 
    pj.job_id,
    m.machine_id,
    'Initial seed - ToC dispatch: Highest efficiency available machine',
    m.efficiency_rating,
    0,
    NOW() - INTERVAL '1 hour'
FROM production_jobs pj
CROSS JOIN (SELECT machine_id, efficiency_rating FROM machines WHERE status = 'RUNNING' ORDER BY efficiency_rating DESC LIMIT 1) m
WHERE pj.status IN ('RUNNING', 'QUEUED')
LIMIT 5;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
SELECT 'Machines' as table_name, COUNT(*) as record_count FROM machines
UNION ALL
SELECT 'Sensor Readings', COUNT(*) FROM sensor_readings
UNION ALL
SELECT 'Production Jobs', COUNT(*) FROM production_jobs
UNION ALL
SELECT 'Dispatch Decisions', COUNT(*) FROM dispatch_decisions;
