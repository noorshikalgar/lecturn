import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { deleteExpiredSessions } from "./db/repositories/sessionsRepo.js";
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

// Expired sessions were previously only ever pruned lazily, one at a time,
// so a session nobody returned to just sat in the table forever — this
// keeps that from growing unbounded on a long-running server.
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  const deleted = deleteExpiredSessions();
  if (deleted > 0) logger.info({ deleted }, "Cleaned up expired sessions");
}, SESSION_CLEANUP_INTERVAL_MS).unref();
