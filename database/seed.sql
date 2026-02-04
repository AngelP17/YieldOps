-- =====================================================
-- SEED DATA: TSMC SMART FACTORY
-- Run after schema creation
-- =====================================================

-- Clear existing data (optional - for reset)
-- TRUNCATE TABLE dispatch_decisions, production_jobs, sensor_readings, machines CASCADE;

-- =====================================================
-- SEED: Machines (48 machines representing a realistic fab)
-- =====================================================
INSERT INTO machines (machine_id, name, type, status, efficiency_rating, location_zone, max_temperature, max_vibration, last_maintenance) VALUES
-- =====================================================
-- ZONE A: Lithography (Critical bottleneck - most machines)
-- EUV and DUV scanners for patterning wafers
-- =====================================================
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'LITHO-01', 'lithography', 'RUNNING', 0.96, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '2 days'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'LITHO-02', 'lithography', 'RUNNING', 0.94, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '5 days'),
('c1d2e3f4-a5b6-7890-cdef-1234567890ab', 'LITHO-03', 'lithography', 'IDLE', 0.92, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '8 days'),
('d2e3f4a5-b6c7-8901-defa-2345678901bc', 'LITHO-04', 'lithography', 'RUNNING', 0.95, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '3 days'),
('e3f4a5b6-c7d8-9012-efab-3456789012cd', 'LITHO-05', 'lithography', 'MAINTENANCE', 0.89, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '15 days'),
('f4a5b6c7-d8e9-0123-fabc-4567890123de', 'LITHO-06', 'lithography', 'RUNNING', 0.93, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '6 days'),
('a5b6c7d8-e9f0-1234-abcd-5678901234ef', 'LITHO-07', 'lithography', 'IDLE', 0.91, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '12 days'),
('b6c7d8e9-f0a1-2345-bcde-6789012345fa', 'LITHO-08', 'lithography', 'RUNNING', 0.97, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '1 day'),

-- =====================================================
-- ZONE B: Etching (Dry and Wet etch systems)
-- Critical for pattern transfer
-- =====================================================
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'ETCH-01', 'etching', 'RUNNING', 0.93, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '3 days'),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'ETCH-02', 'etching', 'RUNNING', 0.88, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '10 days'),
('c7d8e9f0-a1b2-3456-cdef-7890123456ab', 'ETCH-03', 'etching', 'IDLE', 0.90, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '7 days'),
('d8e9f0a1-b2c3-4567-defa-8901234567bc', 'ETCH-04', 'etching', 'RUNNING', 0.91, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '4 days'),
('e9f0a1b2-c3d4-5678-efab-9012345678cd', 'ETCH-05', 'etching', 'DOWN', 0.85, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '20 days'),
('f0a1b2c3-d4e5-6789-fabc-0123456789de', 'ETCH-06', 'etching', 'RUNNING', 0.89, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '9 days'),
('a1b2c3d4-e5f6-7890-abcd-1234567890ef', 'ETCH-07', 'etching', 'RUNNING', 0.92, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '5 days'),
('b2c3d4e5-f6a7-8901-bcde-2345678901fa', 'ETCH-08', 'etching', 'IDLE', 0.87, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '11 days'),

-- =====================================================
-- ZONE C: Deposition (CVD, PVD, ALD systems)
-- Film deposition equipment
-- =====================================================
('e5f6a7b8-c9d0-1234-efab-345678901234', 'DEP-01', 'deposition', 'RUNNING', 0.91, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '4 days'),
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'DEP-02', 'deposition', 'RUNNING', 0.88, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '8 days'),
('c3d4e5f6-a7b8-9012-abcd-567890123456', 'DEP-03', 'deposition', 'RUNNING', 0.90, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '6 days'),
('d4e5f6a7-b8c9-0123-bcde-678901234567', 'DEP-04', 'deposition', 'IDLE', 0.86, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '14 days'),
('e5f6a7b8-c9d0-1234-cdef-789012345678', 'DEP-05', 'deposition', 'RUNNING', 0.92, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '3 days'),
('f6a7b8c9-d0e1-2345-defa-890123456789', 'DEP-06', 'deposition', 'MAINTENANCE', 0.84, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '18 days'),
('a7b8c9d0-e1f2-3456-efab-901234567890', 'DEP-07', 'deposition', 'RUNNING', 0.89, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '7 days'),
('b8c9d0e1-f2a3-4567-fabc-012345678901', 'DEP-08', 'deposition', 'RUNNING', 0.87, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '10 days'),
('c9d0e1f2-a3b4-5678-abcd-123456789012', 'DEP-09', 'deposition', 'IDLE', 0.85, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '13 days'),
('d0e1f2a3-b4c5-6789-bcde-234567890123', 'DEP-10', 'deposition', 'RUNNING', 0.91, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '5 days'),

-- =====================================================
-- ZONE D: Inspection & Metrology
-- CD-SEM, Defect review, Overlay measurement
-- =====================================================
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'INSP-01', 'inspection', 'RUNNING', 0.94, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '2 days'),
('e1f2a3b4-c5d6-7890-abcd-345678901234', 'INSP-02', 'inspection', 'RUNNING', 0.92, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '6 days'),
('f2a3b4c5-d6e7-8901-bcde-456789012345', 'INSP-03', 'inspection', 'IDLE', 0.90, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '9 days'),
('a3b4c5d6-e7f8-9012-cdef-567890123456', 'INSP-04', 'inspection', 'RUNNING', 0.93, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '4 days'),
('b4c5d6e7-f8a9-0123-defa-678901234567', 'INSP-05', 'inspection', 'RUNNING', 0.88, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '8 days'),
('c5d6e7f8-a9b0-1234-efab-789012345678', 'INSP-06', 'inspection', 'DOWN', 0.86, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '22 days'),
('d6e7f8a9-b0c1-2345-fabc-890123456789', 'INSP-07', 'inspection', 'RUNNING', 0.91, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '7 days'),
('e7f8a9b0-c1d2-3456-abcd-901234567890', 'INSP-08', 'inspection', 'IDLE', 0.89, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '11 days'),

-- =====================================================
-- ZONE E: Cleaning & Surface Prep
-- Wet benches, strip tools, CMP
-- =====================================================
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'CLEAN-01', 'cleaning', 'RUNNING', 0.90, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '6 days'),
('f8a9b0c1-d2e3-4567-abcd-0123456789ab', 'CLEAN-02', 'cleaning', 'RUNNING', 0.87, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '10 days'),
('a9b0c1d2-e3f4-5678-bcde-1234567890bc', 'CLEAN-03', 'cleaning', 'IDLE', 0.89, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '8 days'),
('b0c1d2e3-f4a5-6789-cdef-2345678901cd', 'CLEAN-04', 'cleaning', 'RUNNING', 0.91, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '5 days'),
('c1d2e3f4-a5b6-7890-defa-3456789012de', 'CLEAN-05', 'cleaning', 'RUNNING', 0.85, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '12 days'),
('d2e3f4a5-b6c7-8901-efab-4567890123ef', 'CLEAN-06', 'cleaning', 'MAINTENANCE', 0.83, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '16 days'),
('e3f4a5b6-c7d8-9012-fabc-5678901234fa', 'CLEAN-07', 'cleaning', 'RUNNING', 0.88, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '7 days'),
('f4a5b6c7-d8e9-0123-abcd-6789012345ab', 'CLEAN-08', 'cleaning', 'IDLE', 0.86, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '14 days'),

-- =====================================================
-- ZONE F: Additional Lithography (Expansion bay)
-- New EUV scanners for advanced nodes
-- =====================================================
('a5b6c7d8-e9f0-1234-abcd-7890123456bc', 'LITHO-09', 'lithography', 'RUNNING', 0.95, 'ZONE_F', 75.00, 2.50, NOW() - INTERVAL '4 days'),
('b6c7d8e9-f0a1-2345-bcde-8901234567cd', 'LITHO-10', 'lithography', 'IDLE', 0.93, 'ZONE_F', 75.00, 2.50, NOW() - INTERVAL '9 days'),

-- =====================================================
-- ZONE G: Additional Etching (High-capacity etch bay)
-- =====================================================
('c7d8e9f0-a1b2-3456-cdef-9012345678de', 'ETCH-09', 'etching', 'RUNNING', 0.90, 'ZONE_G', 85.00, 4.00, NOW() - INTERVAL '6 days'),
('d8e9f0a1-b2c3-4567-defa-0123456789ef', 'ETCH-10', 'etching', 'RUNNING', 0.88, 'ZONE_G', 85.00, 4.00, NOW() - INTERVAL '8 days'),

-- =====================================================
-- ZONE H: Additional Deposition (ALD expansion)
-- =====================================================
('e9f0a1b2-c3d4-5678-efab-1234567890fa', 'DEP-11', 'deposition', 'IDLE', 0.87, 'ZONE_H', 80.00, 3.00, NOW() - INTERVAL '11 days'),
('f0a1b2c3-d4e5-6789-fabc-2345678901ab', 'DEP-12', 'deposition', 'RUNNING', 0.89, 'ZONE_H', 80.00, 3.00, NOW() - INTERVAL '7 days');

-- =====================================================
-- SEED: Production Jobs (Realistic fab workload)
-- =====================================================
INSERT INTO production_jobs (job_id, job_name, wafer_count, priority_level, status, recipe_type, estimated_duration_minutes, deadline, customer_tag, is_hot_lot) VALUES
-- Hot Lots (Priority 1) - VIP customers, urgent orders
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'HOT-LOT-001', 25, 1, 'RUNNING', 'ADVANCED_LOGIC', 180, NOW() + INTERVAL '12 hours', 'APPLE', TRUE),
('d0e1f2a3-b4c5-6789-defa-890123456789', 'HOT-LOT-002', 25, 1, 'QUEUED', '5NM_FINFE', 240, NOW() + INTERVAL '18 hours', 'NVIDIA', TRUE),
('e2f3a4b5-c6d7-8901-efab-123456789abc', 'HOT-LOT-003', 25, 1, 'PENDING', 'AI_ACCELERATOR', 200, NOW() + INTERVAL '14 hours', 'GOOGLE', TRUE),
('f3a4b5c6-d7e8-9012-fabc-234567890bcd', 'HOT-LOT-004', 25, 1, 'RUNNING', 'HPC_CPU', 220, NOW() + INTERVAL '16 hours', 'AMAZON', TRUE),
('a4b5c6d7-e8f9-0123-abcd-345678901cde', 'HOT-LOT-005', 25, 1, 'PENDING', 'MOBILE_SOC', 190, NOW() + INTERVAL '20 hours', 'SAMSUNG', TRUE),

-- High Priority (Priority 2) - Major customers
('e1f2a3b4-c5d6-7890-efab-901234567890', 'WAFER-BATCH-103', 50, 2, 'RUNNING', 'STANDARD_LOGIC', 300, NOW() + INTERVAL '24 hours', 'AMD', FALSE),
('f2a3b4c5-d6e7-8901-fabc-012345678901', 'WAFER-BATCH-104', 50, 2, 'QUEUED', 'MEMORY_DRAM', 280, NOW() + INTERVAL '30 hours', 'MICRON', FALSE),
('b5c6d7e8-f9a0-1234-bcde-456789012def', 'WAFER-BATCH-109', 50, 2, 'PENDING', 'GPU_DIE', 320, NOW() + INTERVAL '28 hours', 'NVIDIA', FALSE),
('c6d7e8f9-a0b1-2345-cdef-567890123efa', 'WAFER-BATCH-110', 50, 2, 'RUNNING', 'NETWORK_CHIP', 290, NOW() + INTERVAL '26 hours', 'BROADCOM', FALSE),
('d7e8f9a0-b1c2-3456-defa-678901234fab', 'WAFER-BATCH-111', 50, 2, 'PENDING', 'FPGA', 310, NOW() + INTERVAL '32 hours', 'XILINX', FALSE),
('e8f9a0b1-c2d3-4567-efab-789012345abc', 'WAFER-BATCH-112', 50, 2, 'QUEUED', 'MODEM_5G', 280, NOW() + INTERVAL '29 hours', 'QUALCOMM', FALSE),

-- Medium Priority (Priority 3) - Standard production
('a3b4c5d6-e7f8-9012-abcd-123456789012', 'WAFER-BATCH-105', 100, 3, 'RUNNING', 'IO_CONTROLLER', 420, NOW() + INTERVAL '48 hours', 'QUALCOMM', FALSE),
('b4c5d6e7-f8a9-0123-bcde-234567890123', 'WAFER-BATCH-106', 100, 3, 'QUEUED', 'POWER_MANAGEMENT', 360, NOW() + INTERVAL '52 hours', 'TI', FALSE),
('f9a0b1c2-d3e4-5678-fabc-890123456bcd', 'WAFER-BATCH-113', 100, 3, 'PENDING', 'MICROCONTROLLER', 400, NOW() + INTERVAL '50 hours', 'NXP', FALSE),
('a0b1c2d3-e4f5-6789-abcd-901234567cde', 'WAFER-BATCH-114', 100, 3, 'RUNNING', 'SENSOR_HUB', 380, NOW() + INTERVAL '54 hours', 'ST', FALSE),
('b1c2d3e4-f5a6-7890-bcde-012345678def', 'WAFER-BATCH-115', 100, 3, 'PENDING', 'RF_FRONTEND', 370, NOW() + INTERVAL '56 hours', 'SKYWORKS', FALSE),
('c2d3e4f5-a6b7-8901-cdef-123456789efa', 'WAFER-BATCH-116', 100, 3, 'QUEUED', 'WIFI_6E', 390, NOW() + INTERVAL '51 hours', 'MEDIATEK', FALSE),
('d3e4f5a6-b7c8-9012-defa-234567890fab', 'WAFER-BATCH-117', 100, 3, 'PENDING', 'BLUETOOTH_SOC', 360, NOW() + INTERVAL '55 hours', 'NORDIC', FALSE),
('e4f5a6b7-c8d9-0123-efab-345678901abc', 'WAFER-BATCH-118', 100, 3, 'RUNNING', 'DISPLAY_DRIVER', 410, NOW() + INTERVAL '49 hours', 'REALTEK', FALSE),

-- Standard Priority (Priority 4) - Regular orders
('c5d6e7f8-a9b0-1234-cdef-345678901234', 'WAFER-BATCH-107', 200, 4, 'QUEUED', 'ANALOG_MIXER', 600, NOW() + INTERVAL '72 hours', 'ADI', FALSE),
('f5a6b7c8-d9e0-2345-fabc-456789012bcd', 'WAFER-BATCH-119', 200, 4, 'PENDING', 'VOLTAGE_REGULATOR', 580, NOW() + INTERVAL '74 hours', 'MAXIM', FALSE),
('a6b7c8d9-e0f1-3456-abcd-567890123cde', 'WAFER-BATCH-120', 200, 4, 'RUNNING', 'AUDIO_CODEC', 620, NOW() + INTERVAL '70 hours', 'CIRRUS', FALSE),
('b7c8d9e0-f1a2-4567-bcde-678901234def', 'WAFER-BATCH-121', 200, 4, 'PENDING', 'LED_DRIVER', 560, NOW() + INTERVAL '76 hours', 'ONSEMI', FALSE),
('c8d9e0f1-a2b3-5678-cdef-789012345efa', 'WAFER-BATCH-122', 200, 4, 'QUEUED', 'DC_DC_CONVERTER', 590, NOW() + INTERVAL '73 hours', 'MPS', FALSE),
('d9e0f1a2-b3c4-6789-defa-890123456fab', 'WAFER-BATCH-123', 200, 4, 'PENDING', 'OP_AMPLIFIER', 570, NOW() + INTERVAL '75 hours', 'INTERSIL', FALSE),

-- Low Priority (Priority 5) - Internal/test lots
('d6e7f8a9-b0c1-2345-defa-456789012345', 'WAFER-BATCH-108', 300, 5, 'QUEUED', 'TEST_CHIPS', 900, NOW() + INTERVAL '168 hours', 'INTERNAL', FALSE),
('e0f1a2b3-c4d5-7890-efab-901234567abc', 'WAFER-BATCH-124', 300, 5, 'PENDING', 'CHARACTERIZATION', 880, NOW() + INTERVAL '170 hours', 'R&D', FALSE),
('f1a2b3c4-d5e6-8901-fabc-012345678bcd', 'WAFER-BATCH-125', 300, 5, 'PENDING', 'QUALIFICATION', 920, NOW() + INTERVAL '165 hours', 'QA', FALSE),
('a2b3c4d5-e6f7-9012-abcd-123456789cde', 'WAFER-BATCH-126', 300, 5, 'QUEUED', 'EXPERIMENTAL', 850, NOW() + INTERVAL '172 hours', 'R&D', FALSE),
('b3c4d5e6-f7a8-0123-bcde-234567890def', 'WAFER-BATCH-127', 300, 5, 'PENDING', 'PROCESS_DEV', 940, NOW() + INTERVAL '168 hours', 'ENG', FALSE);

-- =====================================================
-- SEED: Historical Sensor Readings (for ML training)
-- =====================================================
-- Generate 100 synthetic readings per machine
DO $$
DECLARE
    v_machine RECORD;
    v_i INTEGER;
    v_temp DECIMAL(6,2);
    v_vib DECIMAL(6,3);
BEGIN
    FOR v_machine IN SELECT machine_id, max_temperature, max_vibration FROM machines LOOP
        FOR v_i IN 1..100 LOOP
            -- Normal readings (95% of data)
            IF random() < 0.95 THEN
                v_temp := v_machine.max_temperature * (0.7 + random() * 0.2);
                v_vib := v_machine.max_vibration * (0.4 + random() * 0.3);
            ELSE
                -- Anomalous readings (5% of data)
                v_temp := v_machine.max_temperature * (0.95 + random() * 0.1);
                v_vib := v_machine.max_vibration * (0.85 + random() * 0.2);
            END IF;
            
            INSERT INTO sensor_readings (machine_id, temperature, vibration, recorded_at)
            VALUES (
                v_machine.machine_id,
                v_temp,
                v_vib,
                NOW() - (random() * 7 || ' days')::INTERVAL - (random() * 24 || ' hours')::INTERVAL
            );
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- SEED: Sample Dispatch Decisions (for analytics)
-- =====================================================
INSERT INTO dispatch_decisions (job_id, machine_id, decision_reason, efficiency_at_dispatch, queue_depth_at_dispatch)
SELECT 
    pj.job_id,
    m.machine_id,
    'Initial seed - ToC dispatch: Highest efficiency available machine',
    m.efficiency_rating,
    0
FROM production_jobs pj
CROSS JOIN (SELECT machine_id, efficiency_rating FROM machines ORDER BY efficiency_rating DESC LIMIT 1) m
WHERE pj.status = 'PENDING'
LIMIT 3;

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
