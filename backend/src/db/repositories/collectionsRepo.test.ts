import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../test/testApp.js";
import { createCourse, getCourseById, setCourseCollection } from "./coursesRepo.js";
import { createSection } from "./sectionsRepo.js";
import { createCollection, deleteCollection, getCollectionById } from "./collectionsRepo.js";

function uniqueFolder(prefix: string) {
  return `/test-collections/${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("collectionsRepo", () => {
  buildTestApp();

  it("retroactively groups an existing course whose folder sits inside the new collection's folder", () => {
    const parent = uniqueFolder("parent");
    const child = `${parent}/Part 1`;
    const course = createCourse({ folderPath: child, sectionId: null, title: "Part 1", description: null, topLevelFolder: null });

    const collection = createCollection({ folderPath: parent, title: "Java", topLevelFolder: null });

    expect(getCourseById(course.id)?.collectionId).toBe(collection.id);
  });

  it("does not group a course that merely shares a path prefix without being nested (no trailing separator match)", () => {
    const parent = uniqueFolder("java");
    const decoy = `${parent}-evil/Part 1`; // "java-evil", not "java/..."
    const course = createCourse({ folderPath: decoy, sectionId: null, title: "Decoy", description: null, topLevelFolder: null });

    createCollection({ folderPath: parent, title: "Java", topLevelFolder: null });

    expect(getCourseById(course.id)?.collectionId).toBeNull();
  });

  it("clears a course's own sectionId the moment it joins a collection", () => {
    const section = createSection("Collection join test section");
    const course = createCourse({
      folderPath: uniqueFolder("standalone"),
      sectionId: section.id,
      title: "Standalone",
      description: null,
      topLevelFolder: null,
    });
    expect(getCourseById(course.id)?.sectionId).toBe(section.id);

    const collection = createCollection({ folderPath: uniqueFolder("parent2"), title: "Group", topLevelFolder: null });
    setCourseCollection(course.id, collection.id);

    const updated = getCourseById(course.id)!;
    expect(updated.collectionId).toBe(collection.id);
    expect(updated.sectionId).toBeNull();
  });

  it("reverts a course to standalone, not restoring any prior section, when removed from its collection", () => {
    const collection = createCollection({ folderPath: uniqueFolder("parent3"), title: "Group2", topLevelFolder: null });
    const course = createCourse({ folderPath: uniqueFolder("child"), sectionId: null, title: "Child", description: null, topLevelFolder: null });
    setCourseCollection(course.id, collection.id);
    expect(getCourseById(course.id)?.collectionId).toBe(collection.id);

    setCourseCollection(course.id, null);
    const updated = getCourseById(course.id)!;
    expect(updated.collectionId).toBeNull();
    expect(updated.sectionId).toBeNull();
  });

  it("reverts child courses to standalone (never deletes them) when the collection itself is unmarked", () => {
    const collection = createCollection({ folderPath: uniqueFolder("parent4"), title: "To unmark", topLevelFolder: null });
    const course = createCourse({ folderPath: uniqueFolder("child2"), sectionId: null, title: "Part 1", description: null, topLevelFolder: null });
    setCourseCollection(course.id, collection.id);

    deleteCollection(collection.id);

    expect(getCollectionById(collection.id)).toBeUndefined();
    expect(getCourseById(course.id)).toBeDefined();
    expect(getCourseById(course.id)?.collectionId).toBeNull();
  });
});
