import { createApp } from "../app.js";
import { runMigrations } from "../db/migrate.js";
import { createUser, login, SESSION_COOKIE_NAME } from "../services/authService.js";

let migrated = false;

/** Boots the real app against the shared in-memory test DB (see
 * env.setup.ts) — migrations only need to run once per test file, since the
 * DB connection is a module-level singleton for the life of the process. */
export function buildTestApp() {
  if (!migrated) {
    runMigrations();
    migrated = true;
  }
  return createApp();
}

/** Creates a fresh, uniquely-named user (so parallel tests in the same file
 * never collide on the users.username unique constraint) and logs in,
 * returning the session cookie to attach to supertest requests via
 * `.set("Cookie", cookie)`. */
export function createAndLoginUser(role: "admin" | "user" = "user") {
  const username = `${role}-${Math.random().toString(36).slice(2, 10)}`;
  const password = "test-password-123";
  const user = createUser(username, password, role);
  const { token } = login(username, password);
  return { username, userId: user.id, cookie: `${SESSION_COOKIE_NAME}=${token}` };
}
