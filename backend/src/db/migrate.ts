import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../config/env.js";
import { db, sqlite } from "./client.js";
import { bootstrapAdminUser } from "../services/authService.js";
import { logger } from "../utils/logger.js";
import { listAllCertificateIssuances, updateCertificateSignature } from "./repositories/certificateIssuancesRepo.js";
import { signCertificate, verifyCertificateSignature } from "../utils/certificateSigning.js";

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
  resignCertificatesIfIdsChanged();
  bootstrapAdmin();
}

// A signed certificate's signature covers its userId/courseId among other
// fields (see certificateSigning.ts's canonicalPayload) — so any migration
// that reassigns those ids (e.g. the integer -> UUID primary-key migration)
// silently breaks verification for every certificate issued before it ran,
// even though nothing about the certificate's legitimacy changed. Ed25519
// signing is deterministic (same key + same message -> identical bytes
// every time), so this just re-signs whatever doesn't currently verify —
// safe to run on every startup: a certificate whose ids never changed
// re-verifies fine and this is a no-op for it.
export function resignCertificatesIfIdsChanged() {
  const rows = listAllCertificateIssuances();
  let resigned = 0;
  for (const row of rows) {
    if (verifyCertificateSignature(row, row.signature)) continue;
    const signature = signCertificate(row);
    updateCertificateSignature(row.id, signature);
    resigned += 1;
  }
  if (resigned > 0) {
    logger.info({ resigned, total: rows.length }, "Re-signed certificate issuances whose ids changed under a migration");
  }
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
