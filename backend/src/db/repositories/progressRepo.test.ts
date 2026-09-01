import { describe, expect, it } from "vitest";
import { buildTestApp, createAndLoginUser } from "../../test/testApp.js";
import { createCourse } from "./coursesRepo.js";
import { insertNode } from "./nodesRepo.js";
import { listContinueWatching, upsertProgress } from "./progressRepo.js";

buildTestApp();

describe("listContinueWatching", () => {
  it("returns one row per course — the most recently watched unfinished lesson — not one per unfinished lesson", async () => {
    const { userId } = createAndLoginUser("user");
    const course = createCourse({
      folderPath: `/test-courses/continue-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: "Multi-lesson course",
      description: null,
      topLevelFolder: null,
    });
    const lesson1 = insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "Lesson 1",
      rawName: "lesson1.mp4",
      orderIndex: 0,
      relativePath: "lesson1.mp4",
      targetUrl: null,
    });
    const lesson2 = insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "Lesson 2",
      rawName: "lesson2.mp4",
      orderIndex: 1,
      relativePath: "lesson2.mp4",
      targetUrl: null,
    });

    // Left off both lesson 1 and lesson 2 partway through — lesson 2 later.
    // The gap guarantees distinct lastWatchedAt values (both otherwise land
    // in the same millisecond back-to-back), which is what determines
    // "most recent" here.
    upsertProgress(userId, lesson1.id, 30, false);
    await new Promise((r) => setTimeout(r, 10));
    upsertProgress(userId, lesson2.id, 60, false);

    const items = listContinueWatching(userId);
    const forThisCourse = items.filter((i) => i.course.id === course.id);
    expect(forThisCourse).toHaveLength(1);
    expect(forThisCourse[0].nodeTitle).toBe("Lesson 2");
  });

  it("never surfaces a course once every lesson on it is marked completed", () => {
    const { userId } = createAndLoginUser("user");
    const course = createCourse({
      folderPath: `/test-courses/done-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: "Finished course",
      description: null,
      topLevelFolder: null,
    });
    const lesson = insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "Only lesson",
      rawName: "only.mp4",
      orderIndex: 0,
      relativePath: "only.mp4",
      targetUrl: null,
    });
    upsertProgress(userId, lesson.id, 100, true);

    const items = listContinueWatching(userId);
    expect(items.some((i) => i.course.id === course.id)).toBe(false);
  });
});
