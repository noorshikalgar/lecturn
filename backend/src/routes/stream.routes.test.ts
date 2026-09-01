import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { insertNode } from "../db/repositories/nodesRepo.js";

// stream.routes.ts serves the actual video bytes — the two gates worth
// pinning down directly are "no session, no access at all" and "signed in,
// but this course isn't yours", since a bug in either leaks video content a
// user was never granted.
describe("stream router authorization", () => {
  const app = buildTestApp();

  function makeCourseWithVideo(sectionId: number | null) {
    const dir = mkdtempSync(join(tmpdir(), "lecturn-stream-test-"));
    writeFileSync(join(dir, "lesson1.mp4"), "not a real video, just needs to exist");
    const course = createCourse({ folderPath: dir, sectionId, title: "Test course", description: null, topLevelFolder: null });
    const node = insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "Lesson 1",
      rawName: "lesson1.mp4",
      orderIndex: 0,
      relativePath: "lesson1.mp4",
      targetUrl: null,
    });
    return { course, node };
  }

  it("blocks an unauthenticated request with 401", async () => {
    const { node } = makeCourseWithVideo(null);
    const res = await request(app).get(`/api/stream/${node.id}`);
    expect(res.status).toBe(401);
  });

  it("404s a video whose course the signed-in user can't see, instead of leaking it", async () => {
    // A section only becomes restricted once it has at least one access
    // row — an empty list is public, not "admins only" (see
    // sectionAccessRepo.ts). So grant access to a different real user and
    // leave the requesting user off the allow-list entirely.
    const { userId: otherUserId } = createAndLoginUser("user");
    const section = createSection("Stream-restricted section");
    setSectionAccess(section.id, [otherUserId]);
    const { node } = makeCourseWithVideo(section.id);

    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get(`/api/stream/${node.id}`).set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("404s a nodeId that doesn't exist", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get("/api/stream/999999999").set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});
