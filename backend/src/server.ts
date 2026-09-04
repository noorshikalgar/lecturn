import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { endExpiredSessions } from "./db/repositories/sessionsRepo.js";
import { logger } from "./utils/logger.js";

runMigrations();

if (env.ADMIN_PASSWORD === "changeme123") {
  logger.warn(
    "ADMIN_PASSWORD is still the default value — set a real one in your .env and reset the admin password before exposing this server beyond localhost.",
  );
}

const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  logger.info(`Lecturn backend listening on http://${env.HOST}:${env.PORT}`);
});

// Expired/idle sessions were previously only ever pruned lazily, one at a
// time, when that exact token happened to be presented again — a session
// nobody returned to just sat "live" forever otherwise. This soft-ends them
// on a schedule instead (the row itself stays, for login/logout history —
// see sessionsRepo.ts's endExpiredSessions).
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  const ended = endExpiredSessions();
  if (ended > 0) logger.info({ ended }, "Ended expired/idle sessions");
}, SESSION_CLEANUP_INTERVAL_MS).unref();
