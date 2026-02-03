-- =====================================================
-- SEED DATA: TSMC SMART FACTORY
-- Run after schema creation
-- =====================================================

-- Clear existing data (optional - for reset)
-- TRUNCATE TABLE dispatch_decisions, production_jobs, sensor_readings, machines CASCADE;

-- =====================================================
-- SEED: Machines (8 machines representing a mini-fab)
-- =====================================================
INSERT INTO machines (machine_id, name, type, status, efficiency_rating, location_zone, max_temperature, max_vibration, last_maintenance) VALUES
-- Lithography (Bottleneck process - highest value)
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'LITHO-01', 'lithography', 'IDLE', 0.95, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '7 days'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'LITHO-02', 'lithography', 'IDLE', 0.88, 'ZONE_A', 75.00, 2.50, NOW() - INTERVAL '5 days'),

-- Etching
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'ETCH-01', 'etching', 'IDLE', 0.92, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '3 days'),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'ETCH-02', 'etching', 'IDLE', 0.85, 'ZONE_B', 85.00, 4.00, NOW() - INTERVAL '10 days'),

-- Deposition
('e5f6a7b8-c9d0-1234-efab-345678901234', 'DEP-01', 'deposition', 'IDLE', 0.90, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '4 days'),
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'DEP-02', 'deposition', 'IDLE', 0.87, 'ZONE_C', 80.00, 3.00, NOW() - INTERVAL '8 days'),

-- Inspection (Critical for quality)
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'INSP-01', 'inspection', 'IDLE', 0.93, 'ZONE_D', 70.00, 1.50, NOW() - INTERVAL '2 days'),

-- Cleaning
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'CLEAN-01', 'cleaning', 'IDLE', 0.89, 'ZONE_E', 65.00, 2.00, NOW() - INTERVAL '6 days');

-- =====================================================
-- SEED: Production Jobs (Mix of priorities and hot lots)
-- =====================================================
INSERT INTO production_jobs (job_id, job_name, wafer_count, priority_level, status, recipe_type, estimated_duration_minutes, deadline, customer_tag, is_hot_lot) VALUES
-- Hot Lots (Priority 1) - VIP customers
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'HOT-LOT-001', 25, 1, 'PENDING', 'ADVANCED_LOGIC', 180, NOW() + INTERVAL '12 hours', 'APPLE', TRUE),
('d0e1f2a3-b4c5-6789-defa-890123456789', 'HOT-LOT-002', 25, 1, 'PENDING', '5NM_FINFE', 240, NOW() + INTERVAL '18 hours', 'NVIDIA', TRUE),

-- High Priority (Priority 2)
('e1f2a3b4-c5d6-7890-efab-901234567890', 'WAFER-BATCH-103', 50, 2, 'PENDING', 'STANDARD_LOGIC', 300, NOW() + INTERVAL '24 hours', 'AMD', FALSE),
('f2a3b4c5-d6e7-8901-fabc-012345678901', 'WAFER-BATCH-104', 50, 2, 'PENDING', 'MEMORY_DRAM', 280, NOW() + INTERVAL '30 hours', 'MICRON', FALSE),

-- Medium Priority (Priority 3)
('a3b4c5d6-e7f8-9012-abcd-123456789012', 'WAFER-BATCH-105', 100, 3, 'PENDING', 'IO_CONTROLLER', 420, NOW() + INTERVAL '48 hours', 'QUALCOMM', FALSE),
('b4c5d6e7-f8a9-0123-bcde-234567890123', 'WAFER-BATCH-106', 100, 3, 'PENDING', 'POWER_MANAGEMENT', 360, NOW() + INTERVAL '52 hours', 'TI', FALSE),

-- Standard Priority (Priority 4)
('c5d6e7f8-a9b0-1234-cdef-345678901234', 'WAFER-BATCH-107', 200, 4, 'PENDING', 'ANALOG_MIXER', 600, NOW() + INTERVAL '72 hours', 'ADI', FALSE),

-- Low Priority (Priority 5)
('d6e7f8a9-b0c1-2345-defa-456789012345', 'WAFER-BATCH-108', 300, 5, 'PENDING', 'TEST_CHIPS', 900, NOW() + INTERVAL '168 hours', 'INTERNAL', FALSE);

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
