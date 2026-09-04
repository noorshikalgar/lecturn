import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { insertNode } from "../db/repositories/nodesRepo.js";

describe("GET /api/users/:id/activity", () => {
  const app = buildTestApp();

  it("blocks a non-admin", async () => {
    const { cookie } = createAndLoginUser("user");
    const { userId: otherId } = createAndLoginUser("user");
    const res = await request(app).get(`/api/users/${otherId}/activity`).set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("404s an unknown user", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const res = await request(app).get("/api/users/no-such-user/activity").set("Cookie", adminCookie);
    expect(res.status).toBe(404);
  });

  it("reflects real watch progress: currently watching, streak, and total watch seconds", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const { cookie, userId } = createAndLoginUser("user");

    const section = createSection("Activity summary test section");
    const course = createCourse({
      folderPath: `/test-courses/activity-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: section.id,
      title: "Activity summary course",
      description: null,
      topLevelFolder: null,
    });
    const node = insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "lesson1",
      rawName: "lesson1.mp4",
      orderIndex: 0,
      relativePath: "lesson1.mp4",
      targetUrl: null,
    });

    await request(app)
      .post("/api/progress")
      .set("Cookie", cookie)
      .send({ videoNodeId: node.id, positionSeconds: 42, completed: false });

    const res = await request(app).get(`/api/users/${userId}/activity`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(1);
    expect(res.body.totalWatchSeconds).toBe(42);
    expect(res.body.coursesInProgress).toBe(1);
    expect(res.body.coursesCompleted).toBe(0);
    expect(res.body.currentlyWatching).toMatchObject({ courseId: course.id, videoTitle: "lesson1" });
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);
  });
});
