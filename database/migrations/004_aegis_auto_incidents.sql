-- =====================================================
-- Aegis Auto-Incident Generation from Sensor Readings
-- This creates the automatic bridge between YieldOps
-- sensor data and Aegis Sentinel incidents
-- =====================================================

-- Function to check if incident already exists for this reading
CREATE OR REPLACE FUNCTION check_existing_incident(
    p_machine_id TEXT,
    p_recorded_at TIMESTAMPTZ,
    p_window_seconds INT DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM aegis_incidents
        WHERE machine_id = p_machine_id
        AND ABS(EXTRACT(EPOCH FROM (created_at - p_recorded_at))) < p_window_seconds
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to determine severity and action zone from sensor values
CREATE OR REPLACE FUNCTION analyze_sensor_thresholds(
    p_machine_id UUID,
    p_temperature DOUBLE PRECISION,
    p_vibration DOUBLE PRECISION
) RETURNS TABLE (
    severity TEXT,
    incident_type TEXT,
    message TEXT,
    detected_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    action_taken TEXT,
    action_zone TEXT,
    agent_type TEXT,
    z_score DOUBLE PRECISION
) AS $$
DECLARE
    v_machine RECORD;
    v_temp_ratio DOUBLE PRECISION;
    v_vib_ratio DOUBLE PRECISION;
BEGIN
    -- Get machine thresholds
    SELECT * INTO v_machine FROM machines WHERE machine_id = p_machine_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Check temperature thresholds
    v_temp_ratio := p_temperature / NULLIF(v_machine.max_temperature, 0);
    
    IF v_temp_ratio > 1.0 THEN
        -- Critical: Over max temperature
        RETURN QUERY SELECT 
            'critical'::TEXT,
            'thermal_runaway'::TEXT,
            ('CRITICAL: Temperature ' || ROUND(p_temperature::numeric, 1) || '°C exceeds maximum ' || v_machine.max_temperature || '°C')::TEXT,
            p_temperature,
            v_machine.max_temperature,
            'emergency_stop'::TEXT,
            'red'::TEXT,
            CASE v_machine.type 
                WHEN 'lithography' THEN 'precision'
                WHEN 'etching' THEN 'facility'  
                WHEN 'deposition' THEN 'assembly'
                ELSE 'facility'
            END::TEXT,
            (p_temperature - v_machine.max_temperature * 0.8) / 5.0;
        RETURN;
        
    ELSIF v_temp_ratio > 0.95 THEN
        -- High: Near max
        RETURN QUERY SELECT 
            'high'::TEXT,
            'elevated_temperature'::TEXT,
            ('HIGH: Temperature ' || ROUND(p_temperature::numeric, 1) || '°C near maximum threshold')::TEXT,
            p_temperature,
            v_machine.max_temperature * 0.95,
            'reduce_thermal_load'::TEXT,
            'yellow'::TEXT,
            CASE v_machine.type 
                WHEN 'lithography' THEN 'precision'
                WHEN 'etching' THEN 'facility'
                WHEN 'deposition' THEN 'assembly'
                ELSE 'facility'
            END::TEXT,
            3.0;
        RETURN;
        
    ELSIF v_temp_ratio > 0.85 THEN
        -- Medium: Warning level
        RETURN QUERY SELECT 
            'medium'::TEXT,
            'temperature_warning'::TEXT,
            ('WARNING: Elevated temperature ' || ROUND(p_temperature::numeric, 1) || '°C')::TEXT,
            p_temperature,
            v_machine.max_temperature * 0.85,
            'increase_coolant'::TEXT,
            'green'::TEXT,
            CASE v_machine.type 
                WHEN 'lithography' THEN 'precision'
                WHEN 'etching' THEN 'facility'
                WHEN 'deposition' THEN 'assembly'
                ELSE 'facility'
            END::TEXT,
            2.5;
        RETURN;
    END IF;
    
    -- Check vibration thresholds
    v_vib_ratio := p_vibration / NULLIF(v_machine.max_vibration, 0);
    
    IF v_vib_ratio > 1.0 THEN
        -- Critical vibration
        RETURN QUERY SELECT 
            'critical'::TEXT,
            'vibration_alert'::TEXT,
            ('CRITICAL: Vibration ' || ROUND(p_vibration::numeric, 4) || ' mm/s exceeds maximum ' || v_machine.max_vibration)::TEXT,
            p_vibration,
            v_machine.max_vibration,
            'schedule_maintenance'::TEXT,
            'red'::TEXT,
            'facility'::TEXT,
            4.0;
        RETURN;
        
    ELSIF v_vib_ratio > 0.85 THEN
        -- High vibration warning
        RETURN QUERY SELECT 
            'high'::TEXT,
            'increased_vibration'::TEXT,
            ('HIGH: Vibration ' || ROUND(p_vibration::numeric, 4) || ' mm/s above normal')::TEXT,
            p_vibration,
            v_machine.max_vibration * 0.85,
            'schedule_inspection'::TEXT,
            'yellow'::TEXT,
            'facility'::TEXT,
            3.0;
        RETURN;
    END IF;
    
    -- No threshold breach
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Main function to auto-create incidents from sensor readings
CREATE OR REPLACE FUNCTION auto_create_incident_from_reading()
RETURNS TRIGGER AS $$
DECLARE
    v_analysis RECORD;
    v_machine_name TEXT;
    v_exists BOOLEAN;
BEGIN
    -- Skip if this is not a real anomaly (is_anomaly flag or threshold breach)
    IF NOT NEW.is_anomaly THEN
        -- Check if readings breach thresholds anyway
        SELECT * INTO v_analysis FROM analyze_sensor_thresholds(
            NEW.machine_id, 
            NEW.temperature, 
            NEW.vibration
        );
        
        -- No threshold breach, skip
        IF NOT FOUND THEN
            RETURN NEW;
        END IF;
    ELSE
        -- It's marked as anomaly, create incident
        SELECT * INTO v_analysis FROM analyze_sensor_thresholds(
            NEW.machine_id, 
            NEW.temperature, 
            NEW.vibration
        );
        
        -- Fallback if no threshold analysis
        IF NOT FOUND THEN
            v_analysis.severity := 'medium';
            v_analysis.incident_type := 'anomaly_detected';
            v_analysis.message := 'Anomaly detected in sensor readings';
            v_analysis.detected_value := NEW.temperature;
            v_analysis.threshold_value := 80.0;
            v_analysis.action_taken := 'alert_operator';
            v_analysis.action_zone := 'green';
            v_analysis.agent_type := 'facility';
            v_analysis.z_score := 2.5;
        END IF;
    END IF;
    
    -- Get machine name
    SELECT name INTO v_machine_name FROM machines WHERE machine_id = NEW.machine_id;
    
    -- Check for existing recent incident
    v_exists := check_existing_incident(v_machine_name, NEW.recorded_at, 300);
    
    IF NOT v_exists THEN
        -- Create the incident
        INSERT INTO aegis_incidents (
            incident_id,
            created_at,
            machine_id,
            severity,
            incident_type,
            message,
            detected_value,
            threshold_value,
            action_taken,
            action_status,
            action_zone,
            agent_type,
            z_score,
            rate_of_change,
            resolved
        ) VALUES (
            gen_random_uuid(),
            NEW.recorded_at,
            v_machine_name,
            v_analysis.severity,
            v_analysis.incident_type,
            v_analysis.message,
            v_analysis.detected_value,
            v_analysis.threshold_value,
            v_analysis.action_taken,
            CASE 
                WHEN v_analysis.action_zone = 'green' THEN 'auto_executed'
                WHEN v_analysis.action_zone = 'yellow' THEN 'pending_approval'
                ELSE 'alert_only'
            END,
            v_analysis.action_zone,
            v_analysis.agent_type,
            v_analysis.z_score,
            0,
            false
        );
        
        -- Update agent detection count
        UPDATE aegis_agents 
        SET detections_24h = detections_24h + 1,
            last_heartbeat = NOW()
        WHERE machine_id = v_machine_name;
        
        -- Create notification for realtime updates
        PERFORM pg_notify(
            'aegis_incident_created',
            json_build_object(
                'machine_id', v_machine_name,
                'severity', v_analysis.severity,
                'type', v_analysis.incident_type,
                'zone', v_analysis.action_zone,
                'timestamp', NEW.recorded_at
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_auto_incident_on_reading ON sensor_readings;

-- Create the trigger
CREATE TRIGGER trg_auto_incident_on_reading
    AFTER INSERT ON sensor_readings
    FOR EACH ROW
    WHEN (NEW.is_anomaly = true OR NEW.temperature > 70 OR NEW.vibration > 0.02)
    EXECUTE FUNCTION auto_create_incident_from_reading();

-- =====================================================
-- Function to sync incidents from historical data
-- Run this to backfill incidents from existing readings
-- =====================================================
CREATE OR REPLACE FUNCTION backfill_incidents_from_readings(
    p_hours_back INT DEFAULT 24
)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    v_reading RECORD;
    v_analysis RECORD;
    v_machine_name TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR v_reading IN 
        SELECT sr.*, m.name as machine_name, m.max_temperature, m.max_vibration
        FROM sensor_readings sr
        JOIN machines m ON sr.machine_id = m.machine_id
        WHERE sr.recorded_at >= NOW() - INTERVAL '1 hour' * p_hours_back
          AND (sr.is_anomaly = true 
               OR sr.temperature > m.max_temperature * 0.85
               OR sr.vibration > m.max_vibration * 0.85)
        ORDER BY sr.recorded_at DESC
    LOOP
        -- Check for existing incident
        v_exists := check_existing_incident(v_reading.machine_name, v_reading.recorded_at, 300);
        
        IF NOT v_exists THEN
            -- Get analysis
            SELECT * INTO v_analysis FROM analyze_sensor_thresholds(
                v_reading.machine_id,
                v_reading.temperature,
                v_reading.vibration
            );
            
            IF FOUND THEN
                INSERT INTO aegis_incidents (
                    incident_id, created_at, machine_id, severity, incident_type,
                    message, detected_value, threshold_value, action_taken,
                    action_status, action_zone, agent_type, z_score, resolved
                ) VALUES (
                    gen_random_uuid(),
                    v_reading.recorded_at,
                    v_reading.machine_name,
                    v_analysis.severity,
                    v_analysis.incident_type,
                    v_analysis.message,
                    v_analysis.detected_value,
                    v_analysis.threshold_value,
                    v_analysis.action_taken,
                    CASE 
                        WHEN v_analysis.action_zone = 'green' THEN 'auto_executed'
                        WHEN v_analysis.action_zone = 'yellow' THEN 'pending_approval'
                        ELSE 'alert_only'
                    END,
                    v_analysis.action_zone,
                    v_analysis.agent_type,
                    v_analysis.z_score,
                    false
                );
                
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Run backfill for recent data
SELECT backfill_incidents_from_readings(24) as incidents_created;

-- Verify the trigger is working
SELECT 
    'Trigger active' as status,
    (SELECT COUNT(*) FROM aegis_incidents WHERE created_at >= NOW() - INTERVAL '1 hour') as recent_incidents;
