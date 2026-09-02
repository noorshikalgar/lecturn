import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { resolveNodeAbsolutePath } from "./resolvePath.js";

// This is the containment boundary between a course's own folder and
// everything else on disk — a bug here is a path-traversal vulnerability the
// moment any future endpoint accepts a relativePath from outside the
// scanner (see the doc comment on resolveNodeAbsolutePath itself). Worth
// pinning down explicitly rather than relying on that staying true by
// convention.
describe("resolveNodeAbsolutePath", () => {
  runMigrations();

  function makeCourse() {
    return createCourse({
      folderPath: `/test-courses/resolve-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: null,
      title: "Test course",
      description: null,
      topLevelFolder: null,
    });
  }

  it("resolves a normal relative path under the course root", () => {
    const course = makeCourse();
    const result = resolveNodeAbsolutePath(course.id, "lesson1/video.mp4");
    expect(result).toBe(`${course.folderPath}/lesson1/video.mp4`);
  });

  it("rejects a relativePath that escapes the course root with ../", () => {
    const course = makeCourse();
    expect(resolveNodeAbsolutePath(course.id, "../../../etc/passwd")).toBeUndefined();
  });

  it("rejects a relativePath that escapes via a path that only looks contained", () => {
    const course = makeCourse();
    // e.g. course root "/test-courses/foo" vs a sibling "/test-courses/foo-evil"
    // — a naive prefix check (startsWith) would wrongly allow this.
    expect(resolveNodeAbsolutePath(course.id, `../${course.folderPath.split("/").pop()}-evil/secret`)).toBeUndefined();
  });

  it("rejects a relativePath that resolves to the course root itself", () => {
    const course = makeCourse();
    expect(resolveNodeAbsolutePath(course.id, ".")).toBeUndefined();
    expect(resolveNodeAbsolutePath(course.id, "")).toBeUndefined();
  });

  it("returns undefined for a course that doesn't exist", () => {
    expect(resolveNodeAbsolutePath("nonexistent-course-id", "video.mp4")).toBeUndefined();
  });
});
