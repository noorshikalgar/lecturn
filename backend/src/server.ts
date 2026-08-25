import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
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
