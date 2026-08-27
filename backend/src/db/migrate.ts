import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../config/env.js";
import { db, sqlite } from "./client.js";
import { bootstrapAdminUser } from "../services/authService.js";
import { logger } from "../utils/logger.js";

export function runMigrations() {
  // SQLite ignores `PRAGMA foreign_keys=OFF` while a transaction is open,
  // and drizzle's migrator wraps every migration file in one transaction —
  // so a migration that recreates a table (drizzle-kit's own codegen
  // pattern for altering a column) can fire ON DELETE/SET NULL cascades on
  // its own DROP TABLE mid-migration, even though the migration itself
  // asked for foreign_keys=OFF. Toggling it off on the raw connection here,
  // before that transaction ever opens, is the only point where it's
  // actually possible to disable — and it protects every future migration,
  // not just the one that first ran into this.
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder: "./src/db/migrations" });
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
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
