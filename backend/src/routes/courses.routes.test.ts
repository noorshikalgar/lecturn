import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { insertNode } from "../db/repositories/nodesRepo.js";
import { createNote } from "../db/repositories/notesRepo.js";

// /courses/search originally only matched course titles — extended to also
// search video/file names and the requesting user's own notes (see the
// audit that prompted this). These pin down the two new result kinds and,
// critically, that notes stay private to their author and everything still
// respects section visibility.
describe("courses router search", () => {
  const app = buildTestApp();

  function suffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  function makeVisibleCourse(title: string) {
    const section = createSection(`Search test section ${suffix()}`);
    return createCourse({
      folderPath: `/test-courses/search-${suffix()}`,
      sectionId: section.id,
      title,
      description: null,
      topLevelFolder: null,
    });
  }

  it("matches a video/file node by title, alongside course-title matches", async () => {
    const course = makeVisibleCourse("Rust programming basics");
    insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "Deep dive into ownership and borrowing",
      rawName: "05_ownership.mp4",
      orderIndex: 0,
      relativePath: "05_ownership.mp4",
      targetUrl: null,
    });

    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get("/api/courses/search?q=ownership").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(1);
    expect(res.body.nodes[0].title).toBe("Deep dive into ownership and borrowing");
    expect(res.body.nodes[0].courseId).toBe(course.id);
  });

  it("matches the requesting user's own notes, but never another user's", async () => {
    const course = makeVisibleCourse("Note search course");
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

    const { cookie, userId } = createAndLoginUser("user");
    createNote(userId, node.id, 42, "remember to review the borrow checker rules here");

    const { userId: otherUserId } = createAndLoginUser("user");
    createNote(otherUserId, node.id, 10, "borrow checker note from someone else entirely");

    const res = await request(app).get("/api/courses/search?q=borrow%20checker").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].body).toContain("review the borrow checker rules");
  });

  it("excludes node and note matches from a course the requesting user can't see", async () => {
    const restrictedSection = createSection(`Restricted search section ${suffix()}`);
    const { userId: otherUserId } = createAndLoginUser("user");
    setSectionAccess(restrictedSection.id, [otherUserId]);
    const restrictedCourse = createCourse({
      folderPath: `/test-courses/search-restricted-${suffix()}`,
      sectionId: restrictedSection.id,
      title: "Restricted search course",
      description: null,
      topLevelFolder: null,
    });
    const node = insertNode({
      courseId: restrictedCourse.id,
      parentId: null,
      type: "video",
      title: "Unreachable secret lesson",
      rawName: "secret.mp4",
      orderIndex: 0,
      relativePath: "secret.mp4",
      targetUrl: null,
    });

    const { cookie, userId } = createAndLoginUser("user");
    createNote(userId, node.id, null, "a note on unreachable content");

    const res = await request(app).get("/api/courses/search?q=unreachable").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(0);
    expect(res.body.notes).toHaveLength(0);
  });

  it("returns empty arrays for a blank query instead of erroring", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get("/api/courses/search?q=").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ courses: [], nodes: [], notes: [] });
  });
});
