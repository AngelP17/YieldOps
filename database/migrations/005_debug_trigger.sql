-- =====================================================
-- DEBUG: Verify Aegis Auto-Incident Trigger is Working
-- =====================================================

-- 1. Check trigger exists and is enabled
SELECT 
    trigger_name,
    event_object_table,
    action_statement,
    action_orientation,
    action_timing,
    enabled
FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_incident_on_reading';

-- 2. Check recent sensor readings that SHOULD trigger incidents
SELECT 
    sr.reading_id,
    sr.machine_id,
    m.name as machine_name,
    sr.temperature,
    m.max_temperature,
    ROUND((sr.temperature / NULLIF(m.max_temperature, 0) * 100)::numeric, 1) as temp_pct,
    sr.vibration,
    m.max_vibration,
    sr.is_anomaly,
    sr.recorded_at,
    CASE 
        WHEN sr.is_anomaly THEN 'ANOMALY FLAG'
        WHEN sr.temperature > m.max_temperature THEN 'CRITICAL TEMP'
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'HIGH TEMP'
        WHEN sr.temperature > m.max_temperature * 0.85 THEN 'MEDIUM TEMP'
        WHEN sr.vibration > m.max_vibration THEN 'CRITICAL VIB'
        WHEN sr.vibration > m.max_vibration * 0.85 THEN 'HIGH VIB'
        ELSE 'NORMAL'
    END as would_trigger
FROM sensor_readings sr
JOIN machines m ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '1 hour'
ORDER BY sr.recorded_at DESC
LIMIT 20;

-- 3. Test the trigger manually by inserting a test reading
-- First, let's see what machines exist
SELECT machine_id, name, type, max_temperature, max_vibration 
FROM machines 
LIMIT 5;

-- 4. Count readings by trigger condition in last hour
SELECT 
    COUNT(*) as total_readings,
    COUNT(*) FILTER (WHERE is_anomaly = true) as anomaly_flagged,
    COUNT(*) FILTER (WHERE temperature > 70) as high_temp,
    COUNT(*) FILTER (WHERE vibration > 0.02) as high_vibration,
    COUNT(*) FILTER (WHERE is_anomaly = true OR temperature > 70 OR vibration > 0.02) as would_trigger
FROM sensor_readings
WHERE recorded_at >= NOW() - INTERVAL '1 hour';

-- 5. Check for any trigger execution errors
SELECT 
    relname as table_name,
    tgname as trigger_name,
    tgenabled as enabled_status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname = 'trg_auto_incident_on_reading';

-- 6. MANUAL TEST: Insert a test reading that SHOULD trigger an incident
-- Uncomment and run this to test:
/*
DO $$
DECLARE
    v_machine_id TEXT;
    v_machine_name TEXT;
BEGIN
    -- Get first machine
    SELECT machine_id, name INTO v_machine_id, v_machine_name
    FROM machines LIMIT 1;
    
    RAISE NOTICE 'Inserting test reading for machine: %', v_machine_name;
    
    INSERT INTO sensor_readings (
        machine_id,
        temperature,
        vibration,
        pressure,
        power_consumption,
        is_anomaly,
        recorded_at
    ) VALUES (
        v_machine_id,
        95.0,  -- High temperature to trigger
        0.05,  -- High vibration
        12.0,
        1500,
        true,  -- Mark as anomaly
        NOW()
    );
    
    RAISE NOTICE 'Test reading inserted. Check if incident was created.';
END $$;
*/

-- 7. Show all incidents (not just recent)
SELECT 
    incident_id,
    machine_id,
    severity,
    incident_type,
    action_zone,
    action_status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM aegis_incidents
ORDER BY created_at DESC
LIMIT 10;

-- 8. Check if trigger function has any errors
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc
WHERE proname = 'auto_create_incident_from_reading';

-- 9. Create a simpler test function to manually trigger incident creation
CREATE OR REPLACE FUNCTION test_create_incident_from_reading(
    p_machine_id TEXT,
    p_temperature DOUBLE PRECISION,
    p_vibration DOUBLE PRECISION,
    p_is_anomaly BOOLEAN DEFAULT false
) RETURNS TEXT AS $$
DECLARE
    v_machine_name TEXT;
    v_max_temp DOUBLE PRECISION;
    v_max_vib DOUBLE PRECISION;
    v_incident_id UUID;
BEGIN
    -- Get machine info
    SELECT name, max_temperature, max_vibration 
    INTO v_machine_name, v_max_temp, v_max_vib
    FROM machines 
    WHERE machine_id = p_machine_id;
    
    IF NOT FOUND THEN
        RETURN 'Machine not found: ' || p_machine_id;
    END IF;
    
    RAISE NOTICE 'Machine: %, Max Temp: %, Max Vib: %', v_machine_name, v_max_temp, v_max_vib;
    
    -- Determine severity based on values
    IF p_temperature > v_max_temp THEN
        INSERT INTO aegis_incidents (
            incident_id, created_at, machine_id, severity, incident_type,
            message, detected_value, threshold_value, action_taken,
            action_status, action_zone, agent_type, z_score, resolved
        ) VALUES (
            gen_random_uuid(), NOW(), v_machine_name, 'critical', 'thermal_runaway',
            'CRITICAL: Temperature ' || p_temperature || '°C exceeds maximum ' || v_max_temp || '°C',
            p_temperature, v_max_temp, 'emergency_stop', 'alert_only', 'red', 'facility', 4.0, false
        )
        RETURNING incident_id INTO v_incident_id;
        
        RETURN 'Created CRITICAL incident: ' || v_incident_id;
        
    ELSIF p_temperature > v_max_temp * 0.85 OR p_is_anomaly THEN
        INSERT INTO aegis_incidents (
            incident_id, created_at, machine_id, severity, incident_type,
            message, detected_value, threshold_value, action_taken,
            action_status, action_zone, agent_type, z_score, resolved
        ) VALUES (
            gen_random_uuid(), NOW(), v_machine_name, 'high', 'temperature_warning',
            'HIGH: Temperature ' || p_temperature || '°C above normal threshold',
            p_temperature, v_max_temp * 0.85, 'reduce_thermal_load', 'pending_approval', 'yellow', 'facility', 3.0, false
        )
        RETURNING incident_id INTO v_incident_id;
        
        RETURN 'Created HIGH incident: ' || v_incident_id;
    ELSE
        RETURN 'No threshold breached - no incident created';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 10. Run the test - this will create an actual incident
-- Uncomment to test:
-- SELECT test_create_incident_from_reading(
--     (SELECT machine_id FROM machines LIMIT 1),  -- First machine
--     95.0,  -- High temp
--     0.05,  -- High vibration  
--     true   -- Mark as anomaly
-- );

-- 11. Final verification - show counts
SELECT 
    'Summary' as check_type,
    (SELECT COUNT(*) FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL '1 hour') as recent_readings,
    (SELECT COUNT(*) FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL '1 hour' AND (is_anomaly = true OR temperature > 70)) as trigger_worthy_readings,
    (SELECT COUNT(*) FROM aegis_incidents) as total_incidents,
    (SELECT COUNT(*) FROM aegis_incidents WHERE created_at >= NOW() - INTERVAL '1 hour') as recent_incidents;
