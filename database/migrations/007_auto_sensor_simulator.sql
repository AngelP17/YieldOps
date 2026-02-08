-- =====================================================
-- Automatic Sensor Data Simulator
-- Generates realistic sensor readings for machines
-- This connects the YieldOps simulation to Aegis Sentinel
-- =====================================================

-- Function to generate sensor readings for active machines
CREATE OR REPLACE FUNCTION generate_machine_sensor_reading(
    p_machine_id UUID,
    p_machine_type TEXT DEFAULT 'etching'
) RETURNS UUID AS $$
DECLARE
    v_reading_id UUID;
    v_base_temp DECIMAL(6,2);
    v_base_vibration DECIMAL(6,3);
    v_temp_variation DECIMAL(6,2);
    v_vib_variation DECIMAL(6,3);
    v_is_anomaly BOOLEAN := FALSE;
    v_anomaly_score DECIMAL(5,4) := 0.0;
    v_machine_record RECORD;
BEGIN
    -- Get machine info
    SELECT * INTO v_machine_record 
    FROM machines 
    WHERE machine_id = p_machine_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Base values depend on machine status
    IF v_machine_record.status = 'RUNNING' THEN
        v_base_temp := 65.0 + random() * 10.0;  -- 65-75°C normal
        v_base_vibration := 0.005 + random() * 0.01;  -- Low vibration
    ELSIF v_machine_record.status = 'DOWN' THEN
        v_base_temp := 45.0 + random() * 5.0;  -- Cooling down
        v_base_vibration := 0.001 + random() * 0.002;  -- Minimal
    ELSE  -- IDLE
        v_base_temp := 55.0 + random() * 5.0;  -- Warm idle
        v_base_vibration := 0.002 + random() * 0.005;  -- Very low
    END IF;
    
    -- Add some random variation
    v_temp_variation := (random() - 0.5) * 4.0;  -- ±2°C
    v_vib_variation := (random() - 0.5) * 0.005;  -- ±0.0025 mm/s
    
    -- Occasionally create anomalies (5% chance)
    IF random() < 0.05 THEN
        v_is_anomaly := TRUE;
        v_anomaly_score := 0.7 + random() * 0.3;  -- 0.7-1.0 score
        
        -- Boost the readings for anomalies
        v_temp_variation := v_temp_variation + 10.0 + random() * 15.0;  -- Spike temperature
        v_vib_variation := v_vib_variation + 0.02 + random() * 0.03;  -- Spike vibration
    END IF;
    
    -- Insert the reading
    INSERT INTO sensor_readings (
        machine_id,
        temperature,
        vibration,
        pressure,
        power_consumption,
        is_anomaly,
        anomaly_score,
        recorded_at
    ) VALUES (
        p_machine_id,
        LEAST(120.0, GREATEST(20.0, v_base_temp + v_temp_variation)),
        LEAST(0.5, GREATEST(0.0, v_base_vibration + v_vib_variation)),
        10.0 + random() * 5.0,  -- Pressure 10-15 PSI
        1000.0 + random() * 500.0,  -- Power 1000-1500W
        v_is_anomaly,
        CASE WHEN v_is_anomaly THEN v_anomaly_score ELSE NULL END,
        NOW()
    )
    RETURNING reading_id INTO v_reading_id;
    
    RETURN v_reading_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate readings for all active machines
CREATE OR REPLACE FUNCTION simulate_sensor_readings_for_all_machines()
RETURNS TABLE (
    machine_name TEXT,
    reading_id UUID,
    temperature DECIMAL(6,2),
    vibration DECIMAL(6,3),
    is_anomaly BOOLEAN
) AS $$
DECLARE
    v_machine RECORD;
    v_reading_id UUID;
    v_temp DECIMAL(6,2);
    v_vib DECIMAL(6,3);
    v_anomaly BOOLEAN;
BEGIN
    FOR v_machine IN 
        SELECT m.machine_id, m.name, m.type, m.status
        FROM machines m
        WHERE m.status IN ('RUNNING', 'IDLE', 'DOWN')
        ORDER BY m.name
    LOOP
        v_reading_id := generate_machine_sensor_reading(v_machine.machine_id, v_machine.type);
        
        IF v_reading_id IS NOT NULL THEN
            SELECT sr.temperature, sr.vibration, sr.is_anomaly
            INTO v_temp, v_vib, v_anomaly
            FROM sensor_readings sr
            WHERE sr.reading_id = v_reading_id;
            
            RETURN QUERY SELECT v_machine.name, v_reading_id, v_temp, v_vib, v_anomaly;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to run continuous sensor simulation (call this periodically)
CREATE OR REPLACE FUNCTION run_sensor_simulation_tick()
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER := 0;
    v_anomaly_count INTEGER := 0;
    v_result RECORD;
BEGIN
    -- Generate readings for all machines
    FOR v_result IN 
        SELECT * FROM simulate_sensor_readings_for_all_machines()
    LOOP
        v_count := v_count + 1;
        IF v_result.is_anomaly THEN
            v_anomaly_count := v_anomaly_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'readings_generated', v_count,
        'anomalies_created', v_anomaly_count,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Run initial simulation to populate data
SELECT run_sensor_simulation_tick() as initial_simulation;

-- Show what was created
SELECT 
    'Simulation Results' as section,
    (SELECT COUNT(*) FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL '1 minute') as recent_readings,
    (SELECT COUNT(*) FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL '1 minute' AND is_anomaly = true) as anomalies,
    (SELECT COUNT(*) FROM aegis_incidents WHERE created_at >= NOW() - INTERVAL '1 minute') as new_incidents;

-- Show sample readings
SELECT 
    sr.reading_id,
    m.name as machine_name,
    sr.temperature,
    sr.vibration,
    sr.is_anomaly,
    sr.recorded_at
FROM sensor_readings sr
JOIN machines m ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '1 minute'
ORDER BY sr.recorded_at DESC
LIMIT 10;

-- Show incidents created from readings
SELECT 
    incident_id,
    machine_id,
    severity,
    incident_type,
    action_zone,
    created_at
FROM aegis_incidents
WHERE created_at >= NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC
LIMIT 10;
