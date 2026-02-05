-- =====================================================
-- REALISTIC JOB DISTRIBUTION RESET
-- Creates a realistic mix of job statuses for the dispatch system
-- =====================================================
-- First, view current state
SELECT 'BEFORE RESET' as label;
SELECT status,
    COUNT(*) as count
FROM production_jobs
GROUP BY status
ORDER BY status;
-- Step 1: Reset ALL jobs to PENDING first (clean slate)
UPDATE production_jobs
SET status = 'PENDING',
    assigned_machine_id = NULL,
    actual_start_time = NULL,
    actual_end_time = NULL,
    updated_at = NOW();
-- Step 2: Reset all machines to a realistic distribution
UPDATE machines
SET status = 'IDLE',
    updated_at = NOW();
-- Set some machines as RUNNING (about 50%)
UPDATE machines
SET status = 'RUNNING',
    updated_at = NOW()
WHERE machine_id IN (
        SELECT machine_id
        FROM machines
        ORDER BY efficiency_rating DESC
        LIMIT 24
    );
-- Set a few as DOWN (about 4%)
UPDATE machines
SET status = 'DOWN',
    efficiency_rating = 0.5,
    updated_at = NOW()
WHERE machine_id IN (
        SELECT machine_id
        FROM machines
        WHERE status = 'IDLE'
        ORDER BY random()
        LIMIT 2
    );
-- Set a few as MAINTENANCE (about 6%)
UPDATE machines
SET status = 'MAINTENANCE',
    updated_at = NOW()
WHERE machine_id IN (
        SELECT machine_id
        FROM machines
        WHERE status = 'IDLE'
        ORDER BY random()
        LIMIT 3
    );
-- Step 3: Distribute jobs realistically
-- Target distribution:
--   PENDING: ~40% (waiting to be dispatched)
--   QUEUED: ~15% (assigned but waiting)
--   RUNNING: ~25% (actively processing)
--   COMPLETED: ~15% (finished)
--   FAILED: ~5% (need attention)
-- Get running machines for assignments
WITH running_machines AS (
    SELECT machine_id,
        name,
        efficiency_rating,
        ROW_NUMBER() OVER (
            ORDER BY efficiency_rating DESC
        ) as rn
    FROM machines
    WHERE status = 'RUNNING'
),
all_jobs AS (
    SELECT job_id,
        priority_level,
        is_hot_lot,
        ROW_NUMBER() OVER (
            ORDER BY priority_level,
                CASE
                    WHEN is_hot_lot THEN 0
                    ELSE 1
                END,
                created_at
        ) as rn,
        COUNT(*) OVER () as total
    FROM production_jobs
) -- RUNNING jobs (25%) - highest priority, hot lots first
UPDATE production_jobs
SET status = 'RUNNING',
    assigned_machine_id = rm.machine_id,
    actual_start_time = NOW() - (random() * INTERVAL '2 hours'),
    updated_at = NOW()
FROM all_jobs aj
    JOIN running_machines rm ON (
        aj.rn % (
            SELECT COUNT(*)
            FROM running_machines
        ) + 1
    ) = rm.rn
WHERE production_jobs.job_id = aj.job_id
    AND aj.rn <= (
        SELECT CEIL(total * 0.25)
        FROM all_jobs
        LIMIT 1
    );
-- QUEUED jobs (15%) - next batch
WITH all_jobs AS (
    SELECT job_id,
        ROW_NUMBER() OVER (
            ORDER BY priority_level,
                created_at
        ) as rn,
        COUNT(*) OVER () as total
    FROM production_jobs
    WHERE status = 'PENDING'
),
idle_machines AS (
    SELECT machine_id
    FROM machines
    WHERE status = 'IDLE'
)
UPDATE production_jobs
SET status = 'QUEUED',
    assigned_machine_id = (
        SELECT machine_id
        FROM idle_machines
        ORDER BY random()
        LIMIT 1
    ), updated_at = NOW()
FROM all_jobs aj
WHERE production_jobs.job_id = aj.job_id
    AND aj.rn <= 4;
-- COMPLETED jobs (15%) - some already done
WITH pending_jobs AS (
    SELECT job_id,
        ROW_NUMBER() OVER (
            ORDER BY random()
        ) as rn
    FROM production_jobs
    WHERE status = 'PENDING'
)
UPDATE production_jobs
SET status = 'COMPLETED',
    actual_start_time = NOW() - INTERVAL '6 hours',
    actual_end_time = NOW() - INTERVAL '2 hours',
    updated_at = NOW()
FROM pending_jobs pj
WHERE production_jobs.job_id = pj.job_id
    AND pj.rn <= 4;
-- FAILED jobs (5%) - a couple failures for realism
WITH pending_jobs AS (
    SELECT job_id,
        ROW_NUMBER() OVER (
            ORDER BY random()
        ) as rn
    FROM production_jobs
    WHERE status = 'PENDING'
)
UPDATE production_jobs
SET status = 'FAILED',
    actual_start_time = NOW() - INTERVAL '4 hours',
    actual_end_time = NOW() - INTERVAL '3 hours',
    updated_at = NOW()
FROM pending_jobs pj
WHERE production_jobs.job_id = pj.job_id
    AND pj.rn <= 2;
-- Rest stay as PENDING (~40%)
-- Clear old dispatch decisions and create fresh ones
DELETE FROM dispatch_decisions;
-- Log dispatch decisions for running jobs
INSERT INTO dispatch_decisions (
        job_id,
        machine_id,
        decision_reason,
        efficiency_at_dispatch,
        queue_depth_at_dispatch
    )
SELECT pj.job_id,
    pj.assigned_machine_id,
    'ToC Dispatch: Priority ' || pj.priority_level || CASE
        WHEN pj.is_hot_lot THEN ' (HOT LOT - Expedited)'
        ELSE ''
    END || ' assigned to ' || m.name,
    m.efficiency_rating,
    0
FROM production_jobs pj
    JOIN machines m ON pj.assigned_machine_id = m.machine_id
WHERE pj.status IN ('RUNNING', 'QUEUED')
    AND pj.assigned_machine_id IS NOT NULL;
-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'AFTER RESET - JOB DISTRIBUTION' as label;
SELECT status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage,
    SUM(
        CASE
            WHEN is_hot_lot THEN 1
            ELSE 0
        END
    ) as hot_lots
FROM production_jobs
GROUP BY status
ORDER BY CASE
        status
        WHEN 'PENDING' THEN 1
        WHEN 'QUEUED' THEN 2
        WHEN 'RUNNING' THEN 3
        WHEN 'COMPLETED' THEN 4
        WHEN 'FAILED' THEN 5
    END;
SELECT 'MACHINE DISTRIBUTION' as label;
SELECT status,
    COUNT(*) as count,
    ROUND(AVG(efficiency_rating), 3) as avg_efficiency
FROM machines
GROUP BY status
ORDER BY status;
SELECT 'DISPATCH QUEUE PREVIEW' as label;
SELECT job_name,
    priority_level,
    is_hot_lot,
    status
FROM production_jobs
WHERE status = 'PENDING'
ORDER BY CASE
        WHEN is_hot_lot THEN 0
        ELSE 1
    END,
    priority_level,
    created_at
LIMIT 10;