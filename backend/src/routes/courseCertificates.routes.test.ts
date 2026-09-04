import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { insertNode } from "../db/repositories/nodesRepo.js";
import { upsertProgress } from "../db/repositories/progressRepo.js";

describe("course-certificates router", () => {
  const app = buildTestApp();

  function makeCourseWithVideos(sectionId: string | null, videoCount: number) {
    const course = createCourse({
      folderPath: `/test-courses/cert-${Math.random().toString(36).slice(2, 8)}`,
      sectionId,
      title: "Signed Certificates 101",
      description: null,
      topLevelFolder: null,
    });
    const nodes = Array.from({ length: videoCount }, (_, i) =>
      insertNode({
        courseId: course.id,
        parentId: null,
        type: "video",
        title: `Lesson ${i + 1}`,
        rawName: `lesson${i + 1}.mp4`,
        orderIndex: i,
        relativePath: `lesson${i + 1}.mp4`,
        targetUrl: null,
      }),
    );
    return { course, nodes };
  }

  it("issues a certificate once every video is completed, and returns the same one again on a second request", async () => {
    const publicSection = createSection("Public section — cert issue");
    const { course, nodes } = makeCourseWithVideos(publicSection.id, 2);
    const { cookie, userId } = createAndLoginUser("user");
    for (const node of nodes) upsertProgress(userId, node.id, 100, true);

    const first = await request(app).get(`/api/course-certificates/${course.id}/mine`).set("Cookie", cookie);
    expect(first.status).toBe(200);
    expect(first.body.certificate.courseTitle).toBe("Signed Certificates 101");
    expect(first.body.certificate.code).toMatch(/^LECTURN-[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const second = await request(app).get(`/api/course-certificates/${course.id}/mine`).set("Cookie", cookie);
    expect(second.status).toBe(200);
    // Same completion, requested twice, must yield the exact same
    // certificate — not a fresh code/signature every time it's viewed.
    expect(second.body.certificate.code).toBe(first.body.certificate.code);
  });

  it("refuses to issue a certificate before the course is actually completed", async () => {
    const publicSection = createSection("Public section — cert incomplete");
    const { course, nodes } = makeCourseWithVideos(publicSection.id, 2);
    const { cookie, userId } = createAndLoginUser("user");
    // Only one of the two lessons watched.
    upsertProgress(userId, nodes[0].id, 100, true);

    const res = await request(app).get(`/api/course-certificates/${course.id}/mine`).set("Cookie", cookie);
    expect(res.status).toBe(409);
  });

  it("404s a course the requesting user can't see, instead of issuing anything", async () => {
    // A section only becomes restricted once it has at least one access
    // row (see sectionAccessRepo.listRestrictedSectionIds) — granting
    // access to a different user, rather than passing an empty list, is
    // what actually excludes the requesting user below.
    const { userId: otherUserId } = createAndLoginUser("user");
    const section = createSection("Restricted section — cert");
    setSectionAccess(section.id, [otherUserId]);
    const { course } = makeCourseWithVideos(section.id, 1);
    const { cookie } = createAndLoginUser("user");

    const res = await request(app).get(`/api/course-certificates/${course.id}/mine`).set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("404s an unknown courseId instead of erroring", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get("/api/course-certificates/no-such-course/mine").set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const publicSection = createSection("Public section — cert auth");
    const { course } = makeCourseWithVideos(publicSection.id, 1);
    const res = await request(app).get(`/api/course-certificates/${course.id}/mine`);
    expect(res.status).toBe(401);
  });
});
