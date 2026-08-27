# Lecturn

A self-hosted course library and video player — point it at a folder of
downloaded courses (Udemy-style: chapters of numbered video files, notes,
subtitles) and it scans, organizes, and streams them with per-user watch
progress, notes, certificates, and access control.

## Stack

- **Backend**: Express + TypeScript, SQLite via Drizzle ORM, ffmpeg/ffprobe
  for media inspection and remuxing.
- **Frontend**: React + Vite + TypeScript, Tailwind + shadcn/ui.
- **Shared**: `packages/shared` — types shared between frontend and backend.
- npm workspaces monorepo (`frontend`, `backend`, `packages/shared`).

## Local development

Prerequisites: Node 20+, `ffmpeg`/`ffprobe` on `PATH`.

```bash
npm install
cp backend/.env.example backend/.env   # then set ADMIN_PASSWORD, COURSES_ROOT
npm run db:migrate
npm run dev
```

`npm run dev` runs the backend (port 8787) and frontend (port 5173,
proxying `/api` to the backend) concurrently. Sign in with `ADMIN_USERNAME`
(defaults to `admin`) and the `ADMIN_PASSWORD` you set — this bootstraps the
first admin account on first startup.

`COURSES_ROOT` in `backend/.env` is the folder the scanner walks. From the
admin Libraries page, add that root, browse its real structure, and mark
which folders are courses.

### Other scripts

```bash
npm run build        # typecheck + build shared, backend, frontend
npm test             # backend test suite (vitest)
npm run db:generate  # generate a new Drizzle migration after editing backend/src/db/schema.ts
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for running the whole stack with Docker Compose.

## Project layout

```
backend/     Express API, scanner, media pipeline, SQLite/Drizzle schema
frontend/    React app (course browsing, player, notes, admin)
packages/shared/  Types shared by both
```
