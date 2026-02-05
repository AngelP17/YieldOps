-- =====================================================
-- AUTONOMOUS JOB SIMULATION SYSTEM
-- PostgreSQL functions that simulate realistic fab operations
-- Jobs progress automatically through their lifecycle
-- =====================================================
-- =====================================================
-- FUNCTION: Simulate one tick of job progression
-- Call this periodically via pg_cron, Edge Function, or API
-- =====================================================
CREATE OR REPLACE FUNCTION simulate_job_progression() RETURNS JSON AS $$
DECLARE v_pending_dispatched INT := 0;
v_queued_started INT := 0;
v_running_completed INT := 0;
v_running_failed INT := 0;
v_new_jobs_created INT := 0;
v_machine RECORD;
v_job RECORD;
v_idle_machine_id UUID;
BEGIN -- =========================================
-- STEP 1: PENDING -> QUEUED (Dispatch)
-- Assign pending jobs to idle machines
-- =========================================
FOR v_job IN
SELECT *
FROM production_jobs
WHERE status = 'PENDING'
ORDER BY CASE
        WHEN is_hot_lot THEN 0
        ELSE 1
    END,
    priority_level,
    created_at
LIMIT 3 -- Dispatch up to 3 jobs per tick
    LOOP -- Find an idle machine
SELECT machine_id INTO v_idle_machine_id
FROM machines
WHERE status = 'IDLE'
ORDER BY efficiency_rating DESC
LIMIT 1;
IF v_idle_machine_id IS NOT NULL THEN -- Assign job to machine
UPDATE production_jobs
SET status = 'QUEUED',
    assigned_machine_id = v_idle_machine_id,
    updated_at = NOW()
WHERE job_id = v_job.job_id;
v_pending_dispatched := v_pending_dispatched + 1;
END IF;
END LOOP;
-- =========================================
-- STEP 2: QUEUED -> RUNNING (Start Processing)
-- Start jobs that are queued with assigned machines
-- =========================================
FOR v_job IN
SELECT pj.*,
    m.machine_id as m_id,
    m.status as m_status
FROM production_jobs pj
    JOIN machines m ON pj.assigned_machine_id = m.machine_id
WHERE pj.status = 'QUEUED'
    AND m.status = 'IDLE'
LIMIT 5 LOOP -- Start the job
UPDATE production_jobs
SET status = 'RUNNING',
    actual_start_time = NOW(),
    updated_at = NOW()
WHERE job_id = v_job.job_id;
-- Mark machine as running
UPDATE machines
SET status = 'RUNNING',
    current_wafer_count = v_job.wafer_count,
    updated_at = NOW()
WHERE machine_id = v_job.assigned_machine_id;
-- Log dispatch decision
INSERT INTO dispatch_decisions (
        job_id,
        machine_id,
        decision_reason,
        efficiency_at_dispatch
    )
VALUES (
        v_job.job_id,
        v_job.assigned_machine_id,
        'Auto-dispatch: P' || v_job.priority_level || CASE
            WHEN v_job.is_hot_lot THEN ' (HOT LOT)'
            ELSE ''
        END,
        (
            SELECT efficiency_rating
            FROM machines
            WHERE machine_id = v_job.assigned_machine_id
        )
    );
v_queued_started := v_queued_started + 1;
END LOOP;
-- =========================================
-- STEP 3: RUNNING -> COMPLETED/FAILED
-- Complete jobs based on probability
-- =========================================
FOR v_job IN
SELECT pj.*,
    EXTRACT(
        EPOCH
        FROM (NOW() - pj.actual_start_time)
    ) / 60 as minutes_running
FROM production_jobs pj
WHERE pj.status = 'RUNNING'
    AND pj.actual_start_time IS NOT NULL LOOP -- Jobs complete based on estimated duration (with some randomness)
    IF v_job.minutes_running >= (
        v_job.estimated_duration_minutes * (0.8 + random() * 0.4)
    ) THEN -- 95% complete successfully, 5% fail
    IF random() > 0.05 THEN
UPDATE production_jobs
SET status = 'COMPLETED',
    actual_end_time = NOW(),
    updated_at = NOW()
WHERE job_id = v_job.job_id;
v_running_completed := v_running_completed + 1;
ELSE
UPDATE production_jobs
SET status = 'FAILED',
    actual_end_time = NOW(),
    updated_at = NOW()
WHERE job_id = v_job.job_id;
v_running_failed := v_running_failed + 1;
END IF;
-- Free the machine
UPDATE machines
SET status = 'IDLE',
    current_wafer_count = 0,
    updated_at = NOW()
WHERE machine_id = v_job.assigned_machine_id;
END IF;
END LOOP;
-- =========================================
-- STEP 4: Generate new jobs periodically
-- Keep the queue populated
-- =========================================
IF (
    SELECT COUNT(*)
    FROM production_jobs
    WHERE status = 'PENDING'
) < 10 THEN
INSERT INTO production_jobs (
        job_id,
        job_name,
        wafer_count,
        priority_level,
        status,
        recipe_type,
        estimated_duration_minutes,
        deadline,
        customer_tag,
        is_hot_lot,
        created_at,
        updated_at
    )
SELECT gen_random_uuid(),
    'WF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((1000 + floor(random() * 9000))::text, 4, '0'),
    (20 + floor(random() * 80))::int,
    CASE
        WHEN random() > 0.85 THEN 1
        ELSE (2 + floor(random() * 3))::int
    END,
    'PENDING',
    (
        ARRAY ['N5-STD', 'N7-EXP', 'N3-ADV', 'N5-HOT', 'N7-STD', 'N3-EXP']
    ) [1 + floor(random() * 6)],
    (90 + floor(random() * 120))::int,
    NOW() + (interval '1 day' * (2 + floor(random() * 5))),
    (
        ARRAY ['Apple', 'NVIDIA', 'AMD', 'Intel', 'Qualcomm', 'Samsung', 'MediaTek', 'Broadcom']
    ) [1 + floor(random() * 8)],
    random() > 0.85,
    NOW(),
    NOW()
FROM generate_series(1, 2);
-- Generate 2 new jobs
v_new_jobs_created := 2;
END IF;
-- =========================================
-- STEP 5: Machine events (occasional failures/recovery)
-- =========================================
-- Random machine failure (1% chance per running machine)
UPDATE machines
SET status = 'DOWN',
    efficiency_rating = efficiency_rating * 0.5,
    updated_at = NOW()
WHERE status = 'RUNNING'
    AND random() < 0.01
    AND machine_id NOT IN (
        SELECT assigned_machine_id
        FROM production_jobs
        WHERE status = 'RUNNING'
            AND assigned_machine_id IS NOT NULL
    );
-- Recovery from DOWN (5% chance)
UPDATE machines
SET status = 'IDLE',
    efficiency_rating = 0.85 + random() * 0.1,
    updated_at = NOW()
WHERE status = 'DOWN'
    AND random() < 0.05;
-- Efficiency fluctuations for running machines
UPDATE machines
SET efficiency_rating = GREATEST(
        0.6,
        LEAST(1.0, efficiency_rating + (random() - 0.5) * 0.02)
    ),
    updated_at = NOW()
WHERE status = 'RUNNING'
    AND random() < 0.3;
RETURN json_build_object(
    'pending_dispatched',
    v_pending_dispatched,
    'queued_started',
    v_queued_started,
    'running_completed',
    v_running_completed,
    'running_failed',
    v_running_failed,
    'new_jobs_created',
    v_new_jobs_created,
    'timestamp',
    NOW()
);
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- FUNCTION: Fast simulation (for demo purposes)
-- Runs multiple ticks at once
-- =====================================================
CREATE OR REPLACE FUNCTION simulate_fast(ticks INT DEFAULT 5) RETURNS JSON AS $$
DECLARE v_results JSON [];
v_i INT;
BEGIN FOR v_i IN 1..ticks LOOP v_results := array_append(v_results, simulate_job_progression());
END LOOP;
RETURN json_build_object(
    'ticks_executed',
    ticks,
    'results',
    v_results
);
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- FUNCTION: Get simulation status
-- =====================================================
CREATE OR REPLACE FUNCTION get_simulation_status() RETURNS JSON AS $$ BEGIN RETURN json_build_object(
        'jobs',
        (
            SELECT json_build_object(
                    'pending',
                    COUNT(*) FILTER (
                        WHERE status = 'PENDING'
                    ),
                    'queued',
                    COUNT(*) FILTER (
                        WHERE status = 'QUEUED'
                    ),
                    'running',
                    COUNT(*) FILTER (
                        WHERE status = 'RUNNING'
                    ),
                    'completed',
                    COUNT(*) FILTER (
                        WHERE status = 'COMPLETED'
                    ),
                    'failed',
                    COUNT(*) FILTER (
                        WHERE status = 'FAILED'
                    ),
                    'total',
                    COUNT(*)
                )
            FROM production_jobs
        ),
        'machines',
        (
            SELECT json_build_object(
                    'idle',
                    COUNT(*) FILTER (
                        WHERE status = 'IDLE'
                    ),
                    'running',
                    COUNT(*) FILTER (
                        WHERE status = 'RUNNING'
                    ),
                    'down',
                    COUNT(*) FILTER (
                        WHERE status = 'DOWN'
                    ),
                    'maintenance',
                    COUNT(*) FILTER (
                        WHERE status = 'MAINTENANCE'
                    ),
                    'total',
                    COUNT(*)
                )
            FROM machines
        ),
        'timestamp',
        NOW()
    );
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- Grant execute permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION simulate_job_progression() TO authenticated;
GRANT EXECUTE ON FUNCTION simulate_job_progression() TO anon;
GRANT EXECUTE ON FUNCTION simulate_fast(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION simulate_fast(INT) TO anon;
GRANT EXECUTE ON FUNCTION get_simulation_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_simulation_status() TO anon;
-- =====================================================
-- OPTIONAL: Enable pg_cron for automatic execution
-- Uncomment if pg_cron extension is available
-- =====================================================
-- SELECT cron.schedule('simulate-jobs', '*/1 * * * *', 'SELECT simulate_job_progression()');
-- =====================================================
-- TEST: Run one simulation tick
-- =====================================================
SELECT simulate_job_progression();
SELECT get_simulation_status();