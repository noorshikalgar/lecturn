import { describe, expect, it } from "vitest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { insertNode } from "../db/repositories/nodesRepo.js";
import { createSection, setSectionHidden } from "../db/repositories/sectionsRepo.js";
import { setSectionAccess } from "../db/repositories/sectionAccessRepo.js";
import { canUserAccessCourse, canUserAccessNode, getSectionVisibility } from "./sectionVisibility.js";

// buildTestApp() isn't used for its Express app here — this suite calls the
// service directly, no HTTP layer — only for its side effect of running
// migrations once against the shared in-memory test DB (see testApp.ts).
buildTestApp();

function makeCourse(sectionId: string | null, suffix: string) {
  return createCourse({
    folderPath: `/test-courses/visibility-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
    sectionId,
    title: `Visibility test ${suffix}`,
    description: null,
    topLevelFolder: null,
  });
}

describe("sectionVisibility", () => {
  it("treats a section with no access rows as public — visible to any signed-in user", () => {
    const section = createSection("Public");
    const { userId } = createAndLoginUser("user");
    const visibility = getSectionVisibility({ id: userId, role: "user" });
    expect(visibility.canSeeSection(section.id)).toBe(true);
  });

  it("restricts a section with access rows to only the users granted access", () => {
    const { userId: allowedId } = createAndLoginUser("user");
    const { userId: blockedId } = createAndLoginUser("user");
    const section = createSection("Restricted");
    setSectionAccess(section.id, [allowedId]);

    expect(getSectionVisibility({ id: allowedId, role: "user" }).canSeeSection(section.id)).toBe(true);
    expect(getSectionVisibility({ id: blockedId, role: "user" }).canSeeSection(section.id)).toBe(false);
  });

  it("lets admin role bypass a restricted section's allow-list", () => {
    const { userId: allowedId } = createAndLoginUser("user");
    const { userId: adminId } = createAndLoginUser("admin");
    const section = createSection("Restricted, but admin still gets in");
    setSectionAccess(section.id, [allowedId]);

    expect(getSectionVisibility({ id: adminId, role: "admin" }).canSeeSection(section.id)).toBe(true);
  });

  it("hides a hidden section from everyone except admins, regardless of access rows", () => {
    const { userId: allowedId } = createAndLoginUser("user");
    const { userId: adminId } = createAndLoginUser("admin");
    const section = createSection("Hidden but publicly accessible otherwise");
    setSectionHidden(section.id, true);

    expect(getSectionVisibility({ id: allowedId, role: "user" }).canSeeSection(section.id)).toBe(false);
    expect(getSectionVisibility({ id: adminId, role: "admin" }).canSeeSection(section.id)).toBe(true);
  });

  it("only shows an unassigned course (sectionId null) to admins", () => {
    const { userId } = createAndLoginUser("user");
    const { userId: adminId } = createAndLoginUser("admin");
    const unassigned = { sectionId: null, hidden: false };

    expect(getSectionVisibility({ id: userId, role: "user" }).canSeeCourse(unassigned)).toBe(false);
    expect(getSectionVisibility({ id: adminId, role: "admin" }).canSeeCourse(unassigned)).toBe(true);
  });

  it("hides a course flagged hidden from non-admins even in a public section", () => {
    const { userId } = createAndLoginUser("user");
    const { userId: adminId } = createAndLoginUser("admin");
    const section = createSection("Public section with a hidden course");
    const hiddenCourse = { sectionId: section.id, hidden: true };

    expect(getSectionVisibility({ id: userId, role: "user" }).canSeeCourse(hiddenCourse)).toBe(false);
    expect(getSectionVisibility({ id: adminId, role: "admin" }).canSeeCourse(hiddenCourse)).toBe(true);
  });

  it("canUserAccessCourse and canUserAccessNode delegate to the same rules for real rows", () => {
    const { userId: allowedId } = createAndLoginUser("user");
    const { userId: blockedId } = createAndLoginUser("user");
    const section = createSection("Delegation check");
    setSectionAccess(section.id, [allowedId]);
    const course = makeCourse(section.id, "delegation");
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

    expect(canUserAccessCourse({ id: allowedId, role: "user" }, course.id)).toBe(true);
    expect(canUserAccessCourse({ id: blockedId, role: "user" }, course.id)).toBe(false);
    expect(canUserAccessCourse({ id: allowedId, role: "user" }, "nonexistent-course-id")).toBe(false);

    expect(canUserAccessNode({ id: allowedId, role: "user" }, node.id)).toBe(true);
    expect(canUserAccessNode({ id: blockedId, role: "user" }, node.id)).toBe(false);
    expect(canUserAccessNode({ id: allowedId, role: "user" }, "nonexistent-node-id")).toBe(false);
  });
});
