-- Debug: Check if jobs exist and realtime is configured

-- 1. Check if jobs exist in database
SELECT 
    status,
    COUNT(*) as count
FROM production_jobs
GROUP BY status
ORDER BY status;

-- 2. Check if realtime is enabled for production_jobs
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE tablename = 'production_jobs';

-- 3. Check job_generation config
SELECT * FROM job_generation_config;

-- 4. Check recent job generations
SELECT 
    jgl.generation_reason,
    jgl.triggered_by,
    jgl.created_at,
    pj.job_name,
    pj.status,
    pj.priority_level
FROM job_generation_log jgl
JOIN production_jobs pj ON jgl.job_id = pj.job_id
ORDER BY jgl.created_at DESC
LIMIT 10;

-- 5. If no jobs exist, generate one manually to test:
-- SELECT generate_autonomous_job();

-- 6. Check if there are any pending/queued/running jobs
SELECT 
    job_id,
    job_name,
    status,
    priority_level,
    is_hot_lot,
    customer_tag,
    created_at
FROM production_jobs
WHERE status IN ('PENDING', 'QUEUED', 'RUNNING')
ORDER BY priority_level, created_at;