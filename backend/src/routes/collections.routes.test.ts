import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCollection } from "../db/repositories/collectionsRepo.js";
import { createCourse, setCourseCollection } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { setSectionAccess } from "../db/repositories/sectionAccessRepo.js";

function uniqueFolder(prefix: string) {
  return `/test-collections/${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("collections router", () => {
  const app = buildTestApp();

  it("returns a collection with its child courses, filtered by visibility", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const { cookie: userCookie } = createAndLoginUser("user");
    const section = createSection("Collections visibility test section");

    const collection = createCollection({ folderPath: uniqueFolder("java"), title: "Java", topLevelFolder: null });
    const course = createCourse({ folderPath: uniqueFolder("part1"), sectionId: null, title: "Part 1", description: null, topLevelFolder: null });
    setCourseCollection(course.id, collection.id);

    // Admin sees it regardless of section — including this still-unassigned
    // collection (sectionId null until assigned below).
    const adminRes = await request(app).get(`/api/collections/${collection.id}`).set("Cookie", adminCookie);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.collection.courses).toHaveLength(1);

    // Unassigned (no section) is admin-only, same as a standalone course —
    // a non-admin correctly 404s until the collection is put in a section.
    const beforeAssign = await request(app).get(`/api/collections/${collection.id}`).set("Cookie", userCookie);
    expect(beforeAssign.status).toBe(404);

    await request(app).patch(`/api/collections/${collection.id}/section`).set("Cookie", adminCookie).send({ sectionId: section.id });

    // Now in a public section (no access rows) — any signed-in user sees it.
    const userRes = await request(app).get(`/api/collections/${collection.id}`).set("Cookie", userCookie);
    expect(userRes.status).toBe(200);
    expect(userRes.body.collection.courses).toHaveLength(1);
  });

  it("404s a hidden collection for a non-admin", async () => {
    const { cookie } = createAndLoginUser("user");
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const collection = createCollection({ folderPath: uniqueFolder("hidden"), title: "Hidden", topLevelFolder: null });

    await request(app).patch(`/api/collections/${collection.id}/hidden`).set("Cookie", adminCookie).send({ hidden: true });

    const res = await request(app).get(`/api/collections/${collection.id}`).set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("assigning a collection to a section shows up in that section's mixed courses+collections listing", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const section = createSection("Collections section listing test");
    const collection = createCollection({ folderPath: uniqueFolder("assign"), title: "Assign test", topLevelFolder: null });

    const patchRes = await request(app)
      .patch(`/api/collections/${collection.id}/section`)
      .set("Cookie", adminCookie)
      .send({ sectionId: section.id });
    expect(patchRes.status).toBe(200);

    const sectionRes = await request(app).get(`/api/sections/${section.id}/courses`).set("Cookie", adminCookie);
    expect(sectionRes.status).toBe(200);
    expect(sectionRes.body.collections.map((c: { id: string }) => c.id)).toContain(collection.id);
  });

  it("blocks assigning a grouped course's own section directly — must go through the collection", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const section = createSection("Grouped course guard test");
    const collection = createCollection({ folderPath: uniqueFolder("guard"), title: "Guard test", topLevelFolder: null });
    const course = createCourse({ folderPath: uniqueFolder("guardpart1"), sectionId: null, title: "Part 1", description: null, topLevelFolder: null });
    setCourseCollection(course.id, collection.id);

    const res = await request(app).patch(`/api/courses/${course.id}/section`).set("Cookie", adminCookie).send({ sectionId: section.id });
    expect(res.status).toBe(400);
  });

  it("manually adds and removes a course from a collection via PUT/DELETE", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const collection = createCollection({ folderPath: uniqueFolder("manual"), title: "Manual test", topLevelFolder: null });
    const course = createCourse({ folderPath: uniqueFolder("manualpart1"), sectionId: null, title: "Part 1", description: null, topLevelFolder: null });

    const putRes = await request(app).put(`/api/collections/${collection.id}/courses/${course.id}`).set("Cookie", adminCookie);
    expect(putRes.status).toBe(200);
    expect(putRes.body.course.collectionId).toBe(collection.id);

    const delRes = await request(app).delete(`/api/collections/${collection.id}/courses/${course.id}`).set("Cookie", adminCookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.course.collectionId).toBeNull();
  });

  it("search returns matching collections alongside courses", async () => {
    const { cookie } = createAndLoginUser("user");
    const section = createSection("Collections search test section");
    const title = `Searchable Collection ${Math.random().toString(36).slice(2, 8)}`;
    const collection = createCollection({ folderPath: uniqueFolder("search"), title, topLevelFolder: null });
    await request(app)
      .patch(`/api/collections/${collection.id}/section`)
      .set("Cookie", (await createAndLoginUser("admin")).cookie)
      .send({ sectionId: section.id });

    const res = await request(app).get(`/api/courses/search?q=${encodeURIComponent(title.split(" ")[0])}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.collections.some((c: { id: string }) => c.id === collection.id)).toBe(true);
  });
});
