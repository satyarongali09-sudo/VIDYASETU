# VIDYASETU

VIDYASETU is structured as a split deployment:

- `frontend/`: Next.js App Router app for Vercel.
- `backend/`: Node.js/Express API for Render.
- `supabase/`: database, auth, storage, and realtime schema.
- Live media is intended to be handled by WebRTC/SFU infrastructure such as LiveKit.

## Local setup

1. Copy `.env.example` into the environment files used by each service.
2. Install dependencies from the repository root:

   ```bash
   npm install
   ```

3. Run the frontend:

   ```bash
   npm run dev:frontend
   ```

4. Run the backend:

   ```bash
   npm run dev:backend
   ```

## Deployment shape

Deploy `frontend/` to Vercel and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

Deploy `backend/` to Render as a web service and set:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `CORS_ORIGIN`
- Live media provider variables when enabled.

## Supabase

The initial migration creates profiles, classrooms, enrollments, live sessions, polls, questions, attendance, live events, and private storage buckets for slides, audio, and recordings.
