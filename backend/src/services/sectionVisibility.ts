import { getCourseById } from "../db/repositories/coursesRepo.js";
import { getCollectionById } from "../db/repositories/collectionsRepo.js";
import { getNodeById } from "../db/repositories/nodesRepo.js";
import { listAllowedSectionIdsForUser, listRestrictedSectionIds } from "../db/repositories/sectionAccessRepo.js";
import { listHiddenSectionIds } from "../db/repositories/sectionsRepo.js";

export interface RequestUser {
  id: string;
  role: "admin" | "user";
}

export interface SectionVisibility {
  canSeeSection(sectionId: string): boolean;
  canSeeCourse(course: { sectionId: string | null; hidden: boolean }): boolean;
  // A collection carries the exact same {sectionId, hidden} shape a course
  // does, and the same rule applies — this just names the call site
  // accurately rather than duplicating canSeeCourse's logic.
  canSeeCollection(collection: { sectionId: string | null; hidden: boolean }): boolean;
}

export function getSectionVisibility(user: RequestUser): SectionVisibility {
  const hiddenSectionIds = listHiddenSectionIds();
  const restricted = listRestrictedSectionIds();
  const allowed = listAllowedSectionIdsForUser(user.id);

  // Admins bypass both hidden and the access allow-list entirely — they can
  // manage every section from the admin panel regardless, so a restricted
  // section that excluded its own admin would just be confusing (e.g. the
  // admin who created it, then restricted it to a handful of users, forgot
  // to grant themselves access, and can no longer see their own section).
  function canSeeSection(sectionId: string): boolean {
    if (user.role === "admin") return true;
    if (hiddenSectionIds.has(sectionId)) return false;
    if (!restricted.has(sectionId)) return true;
    return allowed.has(sectionId);
  }

  // Unassigned courses (sectionId null) are only visible to admins — they
  // haven't been organized into a section yet.
  function canSeeCourse(course: { sectionId: string | null; hidden: boolean }): boolean {
    if (user.role === "admin") return true;
    if (course.hidden) return false;
    if (course.sectionId === null) return false;
    return canSeeSection(course.sectionId);
  }

  return { canSeeSection, canSeeCourse, canSeeCollection: canSeeCourse };
}

export function canUserAccessCourse(user: RequestUser, courseId: string): boolean {
  const course = getCourseById(courseId);
  if (!course) return false;
  return getSectionVisibility(user).canSeeCourse(course);
}

export function canUserAccessCollection(user: RequestUser, collectionId: string): boolean {
  const collection = getCollectionById(collectionId);
  if (!collection) return false;
  return getSectionVisibility(user).canSeeCollection(collection);
}

export function canUserAccessNode(user: RequestUser, nodeId: string): boolean {
  const node = getNodeById(nodeId);
  if (!node) return false;
  return canUserAccessCourse(user, node.courseId);
}
