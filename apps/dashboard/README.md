# Smart Fab Dashboard

React + Vite + TypeScript frontend for the YieldOps Smart Fab manufacturing system.

## Features

- **Real-time Machine Monitoring**: Live machine status via Supabase Realtime
- **Machine Grid**: Visual representation of all fab machines with status indicators
- **Sensor Data**: Temperature and vibration readings with anomaly highlighting
- **Production Jobs**: View pending jobs and hot lots
- **Statistics Dashboard**: Overview of machine status, efficiency, and job counts

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase Realtime
- Recharts (for future data visualization)
- Lucide React (icons)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=your_api_url
```

## Deployment

This app is configured for deployment on Vercel. See `vercel.json` for configuration.
