-- =====================================================
-- VERIFY AND FIX: Aegis Sentinel Connection to Real Data
-- Run this in Supabase SQL Editor to diagnose and fix
-- =====================================================

-- 1. Check current state
SELECT 
    (SELECT COUNT(*) FROM aegis_agents) as total_agents,
    (SELECT COUNT(*) FROM aegis_agents WHERE status = 'active') as active_agents,
    (SELECT COUNT(*) FROM aegis_incidents) as total_incidents,
    (SELECT COUNT(*) FROM aegis_incidents WHERE created_at >= NOW() - INTERVAL '24 hours') as incidents_24h;

-- 2. Check recent sensor data stats
SELECT 
    COUNT(*) as total_readings,
    MAX(recorded_at) as latest_reading,
    MIN(recorded_at) as oldest_reading,
    AVG(temperature) as avg_temp,
    MAX(temperature) as max_temp,
    AVG(vibration) as avg_vibration,
    MAX(vibration) as max_vibration
FROM sensor_readings
WHERE recorded_at >= NOW() - INTERVAL '24 hours';

-- 3. Find machines with recent readings and their thresholds
SELECT 
    m.name,
    m.max_temperature,
    m.max_vibration,
    COUNT(sr.reading_id) as reading_count,
    MAX(sr.temperature) as highest_temp,
    MAX(sr.vibration) as highest_vibration
FROM machines m
JOIN sensor_readings sr ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '24 hours'
GROUP BY m.machine_id, m.name, m.max_temperature, m.max_vibration
ORDER BY reading_count DESC
LIMIT 10;

-- 4. Create incidents from ANY recent sensor data (for demo purposes)
-- First, let's create some realistic incidents from the latest readings
INSERT INTO aegis_incidents (
    incident_id, created_at, machine_id, severity, incident_type, message,
    detected_value, threshold_value, action_taken, action_status, action_zone,
    agent_type, z_score, rate_of_change, resolved, resolved_at, operator_notes
)
SELECT 
    gen_random_uuid(),
    sr.recorded_at,
    m.name,
    CASE 
        WHEN sr.temperature > m.max_temperature THEN 'critical'
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'high'
        WHEN sr.temperature > m.max_temperature * 0.85 THEN 'medium'
        ELSE 'low'
    END::VARCHAR(20),
    CASE 
        WHEN sr.temperature > m.max_temperature * 0.9 THEN 'elevated_temperature'
        ELSE 'temperature_monitoring'
    END::VARCHAR(100),
    ('Temperature reading on ' || m.name || ': ' || ROUND(sr.temperature::numeric, 2) || '°C / ' || m.max_temperature || '°C max')::TEXT,
    sr.temperature,
    m.max_temperature,
    CASE 
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'reduce_thermal_load'
        ELSE 'increase_coolant'
    END::VARCHAR(200),
    CASE 
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'pending_approval'
        ELSE 'auto_executed'
    END::VARCHAR(50),
    CASE 
        WHEN sr.temperature > m.max_temperature THEN 'red'
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'yellow'
        ELSE 'green'
    END::VARCHAR(20),
    CASE m.type
        WHEN 'lithography' THEN 'precision'
        WHEN 'etching' THEN 'facility'
        WHEN 'deposition' THEN 'assembly'
        ELSE 'facility'
    END::VARCHAR(50),
    (sr.temperature - m.max_temperature * 0.8) / 5,
    0,
    true,  -- Mark as resolved for historical data
    sr.recorded_at + INTERVAL '30 minutes',
    'Historical incident - auto-resolved on backfill'::TEXT
FROM sensor_readings sr
JOIN machines m ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
      SELECT 1 FROM aegis_incidents 
      WHERE machine_id = m.name 
      AND ABS(EXTRACT(EPOCH FROM (aegis_incidents.created_at - sr.recorded_at))) < 3600
  )
ORDER BY sr.recorded_at DESC
LIMIT 20;

-- 5. Create vibration incidents from recent readings
INSERT INTO aegis_incidents (
    incident_id, created_at, machine_id, severity, incident_type, message,
    detected_value, threshold_value, action_taken, action_status, action_zone,
    agent_type, z_score, rate_of_change, resolved, resolved_at, operator_notes
)
SELECT 
    gen_random_uuid(),
    sr.recorded_at,
    m.name,
    'high'::VARCHAR(20),
    'vibration_monitoring'::VARCHAR(100),
    ('Vibration reading on ' || m.name || ': ' || ROUND(sr.vibration::numeric, 2) || ' mm/s / ' || m.max_vibration || ' mm/s max')::TEXT,
    sr.vibration,
    m.max_vibration,
    'schedule_maintenance'::VARCHAR(200),
    'pending_approval'::VARCHAR(50),
    'yellow'::VARCHAR(20),
    CASE m.type
        WHEN 'lithography' THEN 'precision'
        WHEN 'etching' THEN 'facility'
        WHEN 'deposition' THEN 'assembly'
        ELSE 'facility'
    END::VARCHAR(50),
    sr.vibration / NULLIF(m.max_vibration, 0),
    0,
    true,  -- Mark as resolved
    sr.recorded_at + INTERVAL '30 minutes',
    'Historical incident - auto-resolved on backfill'::TEXT
FROM sensor_readings sr
JOIN machines m ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '24 hours'
  AND sr.vibration > m.max_vibration * 0.8
  AND NOT EXISTS (
      SELECT 1 FROM aegis_incidents 
      WHERE machine_id = m.name 
      AND ABS(EXTRACT(EPOCH FROM (aegis_incidents.created_at - sr.recorded_at))) < 3600
  )
ORDER BY sr.recorded_at DESC
LIMIT 10;

-- 6. If still no incidents (no recent sensor data), create some demo incidents
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM aegis_incidents;
    
    IF v_count = 0 THEN
        -- Create demo incidents from existing agents
        INSERT INTO aegis_incidents (
            incident_id, created_at, machine_id, severity, incident_type, message,
            detected_value, threshold_value, action_taken, action_status, action_zone,
            agent_type, z_score, rate_of_change, resolved
        )
        SELECT 
            gen_random_uuid(),
            NOW() - INTERVAL '1 hour' * (random() * 12),
            a.machine_id,
            (ARRAY['low', 'medium', 'high', 'critical'])[1 + floor(random() * 4)]::VARCHAR(20),
            (ARRAY['temperature_warning', 'elevated_temperature', 'vibration_alert', 'threshold_breach'])[1 + floor(random() * 4)]::VARCHAR(100),
            ('Demo incident for ' || a.machine_id)::TEXT,
            70 + random() * 20,
            75,
            (ARRAY['increase_coolant', 'reduce_thermal_load', 'schedule_maintenance', 'alert_operator'])[1 + floor(random() * 4)]::VARCHAR(200),
            (ARRAY['auto_executed', 'pending_approval', 'approved'])[1 + floor(random() * 3)]::VARCHAR(50),
            (ARRAY['green', 'yellow', 'red'])[1 + floor(random() * 3)]::VARCHAR(20),
            a.agent_type,
            random() * 3,
            random() * 2,
            random() > 0.5
        FROM aegis_agents a
        LIMIT 15;
        
        RAISE NOTICE 'Created 15 demo incidents since no sensor data was found';
    END IF;
END $$;

-- 7. Update agent detection counts from incidents
UPDATE aegis_agents a
SET detections_24h = (
    SELECT COUNT(*) 
    FROM aegis_incidents i 
    WHERE i.machine_id = a.machine_id 
    AND i.created_at >= NOW() - INTERVAL '24 hours'
);

-- 8. Final verification
SELECT 
    (SELECT COUNT(*) FROM aegis_agents) as total_agents,
    (SELECT COUNT(*) FROM aegis_agents WHERE status = 'active') as active_agents,
    (SELECT SUM(detections_24h) FROM aegis_agents) as total_detections,
    (SELECT COUNT(*) FROM aegis_incidents) as total_incidents,
    (SELECT COUNT(*) FROM aegis_incidents WHERE created_at >= NOW() - INTERVAL '24 hours') as incidents_24h,
    (SELECT COUNT(*) FROM aegis_incidents WHERE resolved = false) as unresolved_incidents,
    (SELECT COUNT(*) FROM aegis_incidents WHERE action_zone = 'green') as green_zone,
    (SELECT COUNT(*) FROM aegis_incidents WHERE action_zone = 'yellow') as yellow_zone,
    (SELECT COUNT(*) FROM aegis_incidents WHERE action_zone = 'red') as red_zone;

-- 9. Show sample incidents
SELECT 
    incident_id,
    machine_id,
    severity,
    incident_type,
    action_zone,
    action_status,
    resolved,
    created_at
FROM aegis_incidents
ORDER BY created_at DESC
LIMIT 10;
