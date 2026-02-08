-- =====================================================
-- FORCE CREATE: Incidents from existing sensor data
-- Run this to immediately populate incidents
-- =====================================================

-- 1. Create incidents from ANY recent sensor readings (not just threshold breaches)
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
    'Auto-resolved historical incident'::TEXT
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

-- 2. Create some current active incidents (unresolved)
INSERT INTO aegis_incidents (
    incident_id, created_at, machine_id, severity, incident_type, message,
    detected_value, threshold_value, action_taken, action_status, action_zone,
    agent_type, z_score, rate_of_change, resolved
)
SELECT 
    gen_random_uuid(),
    NOW() - INTERVAL '10 minutes' * random(),
    m.name,
    (ARRAY['low', 'medium', 'high', 'critical'])[1 + floor(random() * 4)]::VARCHAR(20),
    (ARRAY['temperature_warning', 'elevated_temperature', 'vibration_alert', 'threshold_breach'])[1 + floor(random() * 4)]::VARCHAR(100),
    ('Active incident on ' || m.name)::TEXT,
    70 + random() * 25,
    85.0,
    (ARRAY['increase_coolant', 'reduce_thermal_load', 'schedule_maintenance', 'alert_operator'])[1 + floor(random() * 4)]::VARCHAR(200),
    (ARRAY['auto_executed', 'pending_approval', 'approved'])[1 + floor(random() * 3)]::VARCHAR(50),
    (ARRAY['green', 'yellow', 'red'])[1 + floor(random() * 3)]::VARCHAR(20),
    CASE m.type
        WHEN 'lithography' THEN 'precision'
        WHEN 'etching' THEN 'facility'
        WHEN 'deposition' THEN 'assembly'
        ELSE 'facility'
    END::VARCHAR(50),
    random() * 3,
    random() * 2,
    false  -- NOT resolved (active)
FROM machines m
WHERE NOT EXISTS (
    SELECT 1 FROM aegis_incidents ai 
    WHERE ai.machine_id = m.name 
    AND ai.resolved = false
)
LIMIT 10;

-- 3. Update agent detection counts
UPDATE aegis_agents a
SET detections_24h = (
    SELECT COUNT(*) 
    FROM aegis_incidents i 
    WHERE i.machine_id = a.machine_id 
    AND i.created_at >= NOW() - INTERVAL '24 hours'
);

-- 4. Verify results
SELECT 
    'Results' as section,
    (SELECT COUNT(*) FROM aegis_incidents) as total_incidents,
    (SELECT COUNT(*) FROM aegis_incidents WHERE created_at >= NOW() - INTERVAL '24 hours') as incidents_24h,
    (SELECT COUNT(*) FROM aegis_incidents WHERE resolved = false) as active_incidents,
    (SELECT COUNT(*) FROM aegis_incidents WHERE action_zone = 'green') as green_zone,
    (SELECT COUNT(*) FROM aegis_incidents WHERE action_zone = 'yellow') as yellow_zone,
    (SELECT COUNT(*) FROM aegis_incidents WHERE action_zone = 'red') as red_zone;

-- 5. Show sample incidents
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
