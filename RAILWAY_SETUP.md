# Railway Two-Service Setup (API + Dashboard)

## 1) API service (`apps/api`)

### Root directory
`apps/api`

### Config file
`/Users/apinzon/Desktop/Active Projects/YieldOps/apps/api/railway.toml`

### Required env vars in Railway API service
- `SUPABASE_URL` = your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` = your service role key  
  Note: app now accepts `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_SECRET_KEY`.
- `SUPABASE_ANON_KEY` = anon key  
  Note: app also accepts `SUPABASE_PUBLISHABLE_KEY`.
- `CORS_ALLOW_ORIGINS` = `https://yield-ops-dashboard.vercel.app,https://yieldops.vercel.app,https://yieldops-dashboard.vercel.app,http://localhost:5173,http://localhost:5174,http://localhost:3000`
- `CORS_ALLOW_ORIGIN_REGEX` = `^https://([a-z0-9-]+\.)*vercel\.app$|^http://localhost(:\d+)?$|^http://127\.0\.0\.1(:\d+)?$`
- `AUTO_INIT_MODEL` = `true`
- `DEBUG` = `false`

### Verify API deploy
- Open `https://<api-service-domain>/health`
- Must return JSON with `"status": "healthy"`

## 2) Dashboard service (`apps/dashboard`) - optional if you keep Vercel

### Root directory
`apps/dashboard`

### Config file
`/Users/apinzon/Desktop/Active Projects/YieldOps/apps/dashboard/railway.json`

### Required env vars in Railway dashboard service
- `VITE_API_URL` = `https://<api-service-domain>`
- `VITE_SUPABASE_URL` = your Supabase URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
- `VITE_TRANSVEC_BASE_URL` = `https://transvec.vercel.app` (optional)

## 3) If frontend stays on Vercel (recommended)

Set these in Vercel dashboard app env vars:
- `VITE_API_URL` = `https://<api-service-domain>`
- `VITE_SUPABASE_URL` = your Supabase URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

Then redeploy Vercel.
