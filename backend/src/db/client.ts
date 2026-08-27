import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// ":memory:" is a literal sentinel better-sqlite3 checks for exact-string
// equality — path.resolve()-ing it (as every real path needs) turns it into
// "<cwd>/:memory:", which is no longer that sentinel, just an ordinary path
// that happens to contain a colon. Without this guard, tests (which set
// DB_PATH=":memory:") were silently writing a real "*:memory:" DB file (plus
// its -shm/-wal siblings) to disk on every run instead of using true
// in-memory SQLite.
const dbPath = env.DB_PATH === ":memory:" ? ":memory:" : resolve(process.cwd(), env.DB_PATH);
if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
