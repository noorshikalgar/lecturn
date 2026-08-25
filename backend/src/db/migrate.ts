import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../config/env.js";
import { db, sqlite } from "./client.js";
import { bootstrapAdminUser } from "../services/authService.js";
import { logger } from "../utils/logger.js";

export function runMigrations() {
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  bootstrapAdmin();
}

const bootstrapAdmin = sqlite.transaction(() => {
  const admin = bootstrapAdminUser(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  if (!admin) return;
  logger.info(
    { username: admin.username },
    "Bootstrap admin created. If this is a fresh install, sign in with ADMIN_USERNAME/ADMIN_PASSWORD from your .env.",
  );
});

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  console.log("Migrations applied.");
  sqlite.close();
}
