-- Fix job generation config for realistic fab volume
-- Run this on your Supabase database to update existing config

UPDATE job_generation_config 
SET 
    generation_interval_seconds = 15,  -- Generate faster (was 30)
    min_jobs = 25,                      -- Maintain 25 jobs minimum (was 10)
    max_jobs = 100,                     -- Allow up to 100 jobs (was 50)
    updated_at = NOW()
WHERE enabled = true;

-- Verify the update
SELECT * FROM job_generation_config;

-- Optional: Manually trigger job generation to immediately populate jobs
-- SELECT generate_autonomous_job();
-- Or batch generate: SELECT batch_generate_jobs_if_needed(10);
