import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { dailyActivity } from "../schema.js";

// UTC calendar day, not the viewer's local timezone — this app has no
// per-user timezone setting anywhere else either, and a streak that's off
// by a few hours around midnight is a minor cosmetic edge case, not worth
// the complexity of threading a timezone through every write.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Idempotent "this user did something today" — existence alone is what a
 * streak needs, so a second call the same day is just a no-op insert
 * conflict, not an error. */
export function recordDailyActivity(userId: string) {
  db.insert(dailyActivity)
    .values({ userId, date: todayUtc() })
    .onConflictDoNothing()
    .run();
}

/** Consecutive-day count ending today or yesterday — "yesterday" still
 * counts so a streak doesn't reset the instant it's past midnight and the
 * user just hasn't watched anything *yet* today. Two calendar days apart
 * (or more) breaks it. */
export function getCurrentStreak(userId: string): number {
  const rows = db
    .select({ date: dailyActivity.date })
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, userId))
    .orderBy(desc(dailyActivity.date))
    .all();
  if (rows.length === 0) return 0;

  const oneDayMs = 24 * 60 * 60 * 1000;
  const todayMs = Date.parse(`${todayUtc()}T00:00:00Z`);
  const mostRecentMs = Date.parse(`${rows[0].date}T00:00:00Z`);
  if (todayMs - mostRecentMs > oneDayMs) return 0;

  let streak = 1;
  let cursor = mostRecentMs;
  for (let i = 1; i < rows.length; i++) {
    const rowMs = Date.parse(`${rows[i].date}T00:00:00Z`);
    if (cursor - rowMs === oneDayMs) {
      streak += 1;
      cursor = rowMs;
    } else if (cursor - rowMs === 0) {
      continue; // defensive — the unique index already prevents this
    } else {
      break;
    }
  }
  return streak;
}
