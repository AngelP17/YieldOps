-- Aegis Industrial Defense Platform - TimescaleDB Initialization
-- Creates tables for telemetry storage and analysis

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- Telemetry Data Table
-- Stores all machine telemetry with time-series optimization
-- =============================================================================
CREATE TABLE IF NOT EXISTS telemetry (
    time TIMESTAMPTZ NOT NULL,
    machine_id TEXT NOT NULL,
    rpm INTEGER,
    temperature DOUBLE PRECISION,
    vibration DOUBLE PRECISION,
    spindle_load DOUBLE PRECISION,
    power_draw DOUBLE PRECISION,
    feed_rate INTEGER,
    thermal_state TEXT,
    vibration_state TEXT,
    wear_percent DOUBLE PRECISION,
    runtime_hours DOUBLE PRECISION,
    status TEXT
);

-- Convert to hypertable for time-series performance
SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time 
    ON telemetry (machine_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_state 
    ON telemetry (thermal_state, vibration_state);

-- =============================================================================
-- Incidents Table
-- Stores detected anomalies and autonomous responses
-- =============================================================================
CREATE TABLE IF NOT EXISTS incidents (
    time TIMESTAMPTZ NOT NULL,
    incident_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    severity TEXT NOT NULL,  -- 'critical', 'high', 'medium', 'low'
    incident_type TEXT NOT NULL,
    description TEXT,
    detected_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    action_taken TEXT,
    action_status TEXT,  -- 'auto_executed', 'pending_approval', 'alert_only'
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);

SELECT create_hypertable('incidents', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_incidents_machine 
    ON incidents (machine_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_severity 
    ON incidents (severity, resolved);

-- =============================================================================
-- Machine Registry
-- Static information about monitored machines
-- =============================================================================
CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    machine_type TEXT,
    manufacturer TEXT,
    model TEXT,
    install_date DATE,
    location TEXT,
    max_rpm INTEGER,
    max_temp DOUBLE PRECISION,
    vibration_threshold DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Continuous Aggregates for Dashboard Performance
-- =============================================================================

-- Hourly average metrics per machine
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    machine_id,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp,
    AVG(vibration) AS avg_vibration,
    MAX(vibration) AS max_vibration,
    AVG(power_draw) AS avg_power,
    AVG(spindle_load) AS avg_load,
    COUNT(*) AS sample_count
FROM telemetry
GROUP BY bucket, machine_id
WITH NO DATA;

-- Add retention policy (keep raw data for 30 days)
SELECT add_retention_policy('telemetry', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('incidents', INTERVAL '90 days', if_not_exists => TRUE);

-- =============================================================================
-- Sample Data for Testing
-- =============================================================================
INSERT INTO machines (machine_id, machine_type, manufacturer, model, location, max_rpm, max_temp, vibration_threshold)
VALUES
    ('CNC-001', 'CNC Mill', 'Haas', 'VF-2', 'Building A - Line 1', 8000, 95.0, 0.05),
    ('CNC-002', 'CNC Lathe', 'Mazak', 'QT-200', 'Building A - Line 1', 6000, 90.0, 0.05),
    ('CNC-003', 'CNC Mill', 'Haas', 'VF-4', 'Building A - Line 2', 8000, 95.0, 0.05),
    ('CNC-004', 'CNC Lathe', 'Okuma', 'LB3000', 'Building B - Line 1', 5000, 85.0, 0.04),
    ('CNC-005', 'CNC Mill', 'DMG Mori', 'NLX-2500', 'Building B - Line 2', 7000, 90.0, 0.05)
ON CONFLICT (machine_id) DO NOTHING;
