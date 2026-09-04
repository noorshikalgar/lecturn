import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildTestApp, createAndLoginUser } from "../../test/testApp.js";
import { db } from "../client.js";
import { dailyActivity } from "../schema.js";
import { getCurrentStreak, recordDailyActivity } from "./dailyActivityRepo.js";

function daysAgoUtc(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describe("dailyActivityRepo", () => {
  buildTestApp();

  it("is zero for a user with no recorded activity", () => {
    const { userId } = createAndLoginUser("user");
    expect(getCurrentStreak(userId)).toBe(0);
  });

  it("counts today as a streak of 1, and calling twice the same day doesn't double-count", () => {
    const { userId } = createAndLoginUser("user");
    recordDailyActivity(userId);
    recordDailyActivity(userId);
    expect(getCurrentStreak(userId)).toBe(1);
  });

  it("counts consecutive days including yesterday, breaking on a gap", () => {
    const { userId } = createAndLoginUser("user");
    // Backfill 3 consecutive days ending yesterday, then a gap, then an
    // older isolated day that must not be counted.
    for (const n of [1, 2, 3]) {
      db.insert(dailyActivity).values({ userId, date: daysAgoUtc(n) }).run();
    }
    db.insert(dailyActivity).values({ userId, date: daysAgoUtc(6) }).run();

    expect(getCurrentStreak(userId)).toBe(3);
  });

  it("resets to zero once the most recent activity is more than a day old", () => {
    const { userId } = createAndLoginUser("user");
    db.insert(dailyActivity).values({ userId, date: daysAgoUtc(5) }).run();
    expect(getCurrentStreak(userId)).toBe(0);
  });

  it("scopes to the requesting user only", () => {
    const { userId: userA } = createAndLoginUser("user");
    const { userId: userB } = createAndLoginUser("user");
    recordDailyActivity(userA);
    expect(getCurrentStreak(userA)).toBe(1);
    expect(getCurrentStreak(userB)).toBe(0);
    // sanity: exactly one row exists for userA
    expect(db.select().from(dailyActivity).where(eq(dailyActivity.userId, userA)).all()).toHaveLength(1);
  });
});
