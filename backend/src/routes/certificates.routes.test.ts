import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { setSectionAccess } from "../db/repositories/sectionAccessRepo.js";

// This suite exists because the certificates router originally shipped with
// no authorization at all: any signed-in user could mark any course
// complete for every user, or upload/delete any course's certificate file.
// A single test like the ones below would have caught that before it
// shipped — see the audit finding this fixes.
describe("certificates router authorization", () => {
  const app = buildTestApp();

  function makeCourse(suffix: string) {
    return createCourse({
      folderPath: `/test-courses/${suffix}-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: `Test course ${suffix}`,
      description: null,
      topLevelFolder: null,
    });
  }

  it("blocks a non-admin from uploading a certificate", async () => {
    const course = makeCourse("upload");
    const { cookie } = createAndLoginUser("user");
    const res = await request(app)
      .post(`/api/certificates/${course.id}`)
      .set("Cookie", cookie)
      .attach("certificate", Buffer.from("%PDF-1.4 fake"), { filename: "cert.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });

  it("blocks a non-admin from deleting a certificate", async () => {
    const course = makeCourse("delete");
    const { cookie } = createAndLoginUser("user");
    const res = await request(app).delete(`/api/certificates/${course.id}`).set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("rejects a path-traversal courseId before it ever reaches the upload handler", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const res = await request(app)
      .post("/api/certificates/../../etc")
      .set("Cookie", adminCookie)
      .attach("certificate", Buffer.from("%PDF-1.4 fake"), { filename: "cert.pdf", contentType: "application/pdf" });
    // Express normalizes the ".." segments out of the URL itself before
    // routing ever sees them, so this either 404s (no matching route) or
    // 400s — either is fine, so long as it never reaches multer's filename
    // callback with an unresolved course id.
    expect([400, 404]).toContain(res.status);
  });

  it("404s a course the requesting user can't see, instead of leaking its certificate", async () => {
    // A section only becomes restricted once it has at least one access
    // row — an empty list is public, not "admins only" (see
    // sectionAccessRepo.ts's listRestrictedSectionIds). Grant access to a
    // different real user so this section is genuinely restricted, and
    // leave the requesting user off the allow-list.
    const { userId: otherUserId } = createAndLoginUser("user");
    const section = createSection("Restricted section");
    setSectionAccess(section.id, [otherUserId]);
    const restrictedCourse = createCourse({
      folderPath: `/test-courses/restricted-target-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: section.id,
      title: "Restricted course",
      description: null,
      topLevelFolder: null,
    });

    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get(`/api/certificates/${restrictedCourse.id}`).set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("lets a user with course access mark it complete, but not a user without access", async () => {
    // An unassigned course (sectionId: null, what makeCourse produces) is
    // admin-only visibility by design — a plain user needs a real, public
    // (unrestricted) section to have any access to mark complete at all.
    const publicSection = createSection("Public section");
    const course = createCourse({
      folderPath: `/test-courses/complete-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: publicSection.id,
      title: "Test course complete",
      description: null,
      topLevelFolder: null,
    });
    const { cookie: allowedCookie } = createAndLoginUser("user");
    const ok = await request(app).patch(`/api/certificates/${course.id}/complete`).set("Cookie", allowedCookie).send({ completed: true });
    expect(ok.status).toBe(200);

    // A section is only "restricted" once it has at least one access row —
    // an empty list is public (see sectionAccessRepo). So grant access to
    // some other user and leave blockedCookie's user off the allow-list.
    const { userId: otherUserId } = createAndLoginUser("user");
    const section = createSection("Another restricted section");
    setSectionAccess(section.id, [otherUserId]);
    const restrictedCourse = createCourse({
      folderPath: `/test-courses/complete-restricted-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: section.id,
      title: "Restricted for completion",
      description: null,
      topLevelFolder: null,
    });
    const { cookie: blockedCookie } = createAndLoginUser("user");
    const blocked = await request(app)
      .patch(`/api/certificates/${restrictedCourse.id}/complete`)
      .set("Cookie", blockedCookie)
      .send({ completed: true });
    expect(blocked.status).toBe(404);
  });
});
