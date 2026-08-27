# Deploying Lecturn to your local server

Verified end-to-end on 2026-08-25: `docker compose build`, `docker compose up`,
login, admin folder browser, library scan, cover extraction, video streaming
(Range requests through nginx), and progress persistence all confirmed working
in real containers — not just written speculatively.

There's no git remote yet (name isn't finalized), so code gets to the server by
syncing the working tree directly rather than `git pull`.

## Fast loop: develop → commit → redeploy → test on real data

This is the quickest path while iterating, and doesn't require touching Portainer at all.

1. On this Mac, after committing a change:

   ```bash
   rsync -az --delete \
     --exclude node_modules --exclude .git --exclude 'backend/data' \
     /Users/noormohammed/projects/lecturn/ \
     user@YOUR_SERVER_IP:/opt/lecturn/
   ```

2. On the server:

   ```bash
   cd /opt/lecturn
   cp .env.example .env   # first time only, then edit real values (see below)
   docker compose up -d --build
   ```

3. Browse to `http://YOUR_SERVER_IP:8080` (or whatever `HTTP_PORT` you set).

Rerunning step 1 + `docker compose up -d --build` is the whole redeploy cycle —
compose only rebuilds layers that changed, so most redeploys are fast.

## `.env` on the server

Copy `.env.example` to `.env` next to `docker-compose.yml` and set real values:

- `ADMIN_PASSWORD` — required, no default. Used only to bootstrap the first
  admin account on first startup; change it from the Admin page after that.
- `COURSES_HOST_PATH` — the real path on the server where your course library
  lives (e.g. `/mnt/courses`). Mounted into the backend container read-only.
- `FRONTEND_ORIGIN` — set to how you'll actually reach it, e.g.
  `http://YOUR_SERVER_IP:8080`.
- `HTTP_PORT` — defaults to 8080.
- `COOKIE_SECURE` — leave `false` for the plain-HTTP setup this guide
  describes. Only set to `true` if you've put a reverse proxy in front of
  the stack that terminates real TLS (see below) — a browser silently drops
  a `Secure` session cookie over plain HTTP, so flipping this on without TLS
  in front breaks login with no obvious error.

## Putting TLS in front of it (optional)

This guide's default setup is plain HTTP on your LAN, which is fine if the
server is only reachable from a network you trust. If you're exposing it
beyond that, put a reverse proxy (Caddy, nginx, or Traefik) in front of the
`frontend` container to terminate TLS, point it at `http://127.0.0.1:${HTTP_PORT}`,
and set `COOKIE_SECURE=true` in `.env` so the session cookie is only ever
sent over that encrypted connection. Without a reverse proxy, leave it
`false` — there's nothing else in this stack that speaks TLS.

## Deploying via Portainer's Stacks UI instead

`portainer-stack.yml` is the same stack but references pre-built image tags
(`lecturn-backend:latest` / `lecturn-frontend:latest`) instead of a
`build:` context — this sidesteps Portainer's web-editor build-context
quirks entirely, since it works purely off images already sitting in the
Docker engine's local cache, regardless of Portainer version/topology.

1. Build and tag the images on the server once (or after each code change):

   ```bash
   cd /opt/lecturn
   docker build -f backend/Dockerfile -t lecturn-backend:latest .
   docker build -f frontend/Dockerfile -t lecturn-frontend:latest .
   ```

2. In Portainer: **Stacks → Add stack** → name it `lecturn` → **Web editor**
   → paste the contents of `portainer-stack.yml` → under **Environment
   variables**, add `ADMIN_PASSWORD`, `FRONTEND_ORIGIN`, `COURSES_HOST_PATH`,
   `HTTP_PORT` → **Deploy the stack**.

3. To redeploy after a code change: rebuild the two images (step 1), then in
   Portainer hit **Update the stack** (or just restart the stack's
   containers — same image tags, Docker picks up the new layers on restart).

Either path is fine — the CLI loop is faster while you're actively developing;
the Portainer stack is nicer once you want a UI to check health/logs/restart
without SSHing in each time. Nothing here has been pushed to a remote
repository — only ever a local commit, per your instruction to hold off on
that until the project name is finalized.
