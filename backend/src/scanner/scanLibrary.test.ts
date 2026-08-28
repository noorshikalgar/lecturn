import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { getNodeByCoursePath, insertNode } from "../db/repositories/nodesRepo.js";
import { cleanupFixtureTree, makeFixtureTree } from "./testFixtures.js";
import { ingestCourseFolder } from "./scanLibrary.js";

// Only for its side effect of running migrations once against the shared
// in-memory test DB (see testApp.ts) — no HTTP layer needed here.
buildTestApp();

let root: string | undefined;
afterEach(async () => {
  if (root) await cleanupFixtureTree(root);
  root = undefined;
});

describe("scanLibrary — retroactive flatten migration", () => {
  it("re-parents an existing video and deletes its now-orphaned wrapper group when a folder-per-lecture layout gets flattened", async () => {
    root = await makeFixtureTree({
      "1 - Introduction/Introduction.mp4": "",
    });

    // Hand-seed the DB as an older scanner version (before buildCourseTree
    // started flattening "folder wraps one identically-titled item") would
    // have left it: a real "1 - Introduction" group wrapping the video,
    // rather than the video sitting at the course root.
    const course = createCourse({ folderPath: root, sectionId: null, title: "Test", description: null, topLevelFolder: null });
    const group = insertNode({
      courseId: course.id,
      parentId: null,
      type: "group",
      title: "Introduction",
      rawName: "1 - Introduction",
      orderIndex: 0,
      relativePath: "1 - Introduction",
      targetUrl: null,
    });
    const video = insertNode({
      courseId: course.id,
      parentId: group.id,
      type: "video",
      title: "Introduction",
      rawName: "Introduction.mp4",
      orderIndex: 0,
      relativePath: "1 - Introduction/Introduction.mp4",
      targetUrl: null,
    });

    await ingestCourseFolder(root, null);

    const refreshedVideo = getNodeByCoursePath(course.id, "1 - Introduction/Introduction.mp4");
    expect(refreshedVideo?.id).toBe(video.id);
    expect(refreshedVideo?.parentId).toBeNull();
    expect(refreshedVideo?.missing).toBe(false);

    const staleGroup = getNodeByCoursePath(course.id, "1 - Introduction");
    expect(staleGroup).toBeUndefined();
  });

  it("does not delete a missing group whose children are also missing (a genuinely deleted folder, not a flatten)", async () => {
    root = await makeFixtureTree({
      "keep-this-video.mp4": "",
    });

    const course = createCourse({ folderPath: root, sectionId: null, title: "Test", description: null, topLevelFolder: null });
    const group = insertNode({
      courseId: course.id,
      parentId: null,
      type: "group",
      title: "Deleted Chapter",
      rawName: "Deleted Chapter",
      orderIndex: 0,
      relativePath: "Deleted Chapter",
      targetUrl: null,
    });
    insertNode({
      courseId: course.id,
      parentId: group.id,
      type: "video",
      title: "Gone Lecture",
      rawName: "Gone Lecture.mp4",
      orderIndex: 0,
      relativePath: "Deleted Chapter/Gone Lecture.mp4",
      targetUrl: null,
    });

    await ingestCourseFolder(root, null);

    const staleGroup = getNodeByCoursePath(course.id, "Deleted Chapter");
    expect(staleGroup?.missing).toBe(true);
    const staleVideo = getNodeByCoursePath(course.id, "Deleted Chapter/Gone Lecture.mp4");
    expect(staleVideo?.missing).toBe(true);
    expect(staleVideo?.parentId).toBe(staleGroup?.id);
  });

  it("self-heals a stored title that was wrong under an older cleanFilename/cleanFolderName bug", async () => {
    root = await makeFixtureTree({
      "02. Next.js Fundamentals (36m)/1- Setup.mp4": "",
    });

    // Seed the DB as the old fileStem-treats-any-dot-as-an-extension bug
    // would have left it: "02. Next.js Fundamentals (36m)" chopped down to
    // just "02" (path.extname finds the dot right after the ordinal and
    // discards everything after it).
    const course = createCourse({ folderPath: root, sectionId: null, title: "Test", description: null, topLevelFolder: null });
    insertNode({
      courseId: course.id,
      parentId: null,
      type: "group",
      title: "02",
      rawName: "02. Next.js Fundamentals (36m)",
      orderIndex: 0,
      relativePath: "02. Next.js Fundamentals (36m)",
      targetUrl: null,
    });

    await ingestCourseFolder(root, null);

    const refreshedGroup = getNodeByCoursePath(course.id, "02. Next.js Fundamentals (36m)");
    expect(refreshedGroup?.title).toBe("Next.js Fundamentals (36m)");
  });
});
