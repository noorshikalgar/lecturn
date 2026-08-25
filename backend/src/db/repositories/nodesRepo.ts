import type { NodeType } from "@coursedeck/shared";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { courses, nodes } from "../schema.js";

export function getNodeByCoursePath(courseId: number, relativePath: string) {
  return db
    .select()
    .from(nodes)
    .where(and(eq(nodes.courseId, courseId), eq(nodes.relativePath, relativePath)))
    .get();
}

export function getNodeById(id: number) {
  return db.select().from(nodes).where(eq(nodes.id, id)).get();
}

export function insertNode(input: {
  courseId: number;
  parentId: number | null;
  type: NodeType;
  title: string;
  rawName: string;
  orderIndex: number;
  relativePath: string;
  targetUrl: string | null;
}) {
  return db.insert(nodes).values(input).returning().get();
}

export function refreshNodeOnRescan(id: number, orderIndex: number, orderLocked: boolean) {
  const patch: { missing: boolean; orderIndex?: number } = { missing: false };
  if (!orderLocked) patch.orderIndex = orderIndex;
  db.update(nodes).set(patch).where(eq(nodes.id, id)).run();
}

/** Flags nodes not seen in the latest scan as missing (never deleted, so an
 * admin can see what vanished). Returns how many rows were newly flagged. */
export function flagMissingNodes(courseId: number, keepRelativePaths: string[]): number {
  const where =
    keepRelativePaths.length === 0
      ? eq(nodes.courseId, courseId)
      : and(eq(nodes.courseId, courseId), notInArray(nodes.relativePath, keepRelativePaths));
  const result = db.update(nodes).set({ missing: true }).where(where).run();
  return result.changes;
}

export function listChildren(courseId: number, parentId: number | null) {
  const parentCond = parentId === null ? isNull(nodes.parentId) : eq(nodes.parentId, parentId);
  return db
    .select()
    .from(nodes)
    .where(and(eq(nodes.courseId, courseId), parentCond))
    .orderBy(nodes.orderIndex)
    .all();
}

export function listNodesForCourse(courseId: number) {
  return db.select().from(nodes).where(eq(nodes.courseId, courseId)).orderBy(nodes.orderIndex).all();
}

export function updateNodeTitle(id: number, title: string) {
  db.update(nodes).set({ title }).where(eq(nodes.id, id)).run();
}

export function updateNodeOrder(id: number, orderIndex: number, parentId?: number | null) {
  const patch: { orderIndex: number; orderLocked: boolean; parentId?: number | null } = {
    orderIndex,
    orderLocked: true,
  };
  if (parentId !== undefined) patch.parentId = parentId;
  db.update(nodes).set(patch).where(eq(nodes.id, id)).run();
}

/** Rewrites order_index 0..n-1 for a full sibling list after a drag-and-drop
 * reorder and locks it against future rescan-driven resorting. All ids must
 * already share the given (courseId, parentId) — the caller (route handler)
 * verifies that before calling. */
export const reorderSiblings = sqlite.transaction((courseId: number, parentId: number | null, orderedIds: number[]) => {
  orderedIds.forEach((id, index) => {
    db.update(nodes)
      .set({ orderIndex: index, orderLocked: true, parentId })
      .where(and(eq(nodes.id, id), eq(nodes.courseId, courseId)))
      .run();
  });
});

/** Every node currently flagged missing, with its course, restricted to
 * courses under the given library root. Courses have no direct libraryId
 * (a course can sit at the library root with no section), so this filters by
 * folder-path prefix in JS rather than a SQL LIKE — simple and safe at the
 * scale a self-hosted single-library deployment actually runs at. */
export function listMissingForLibrary(libraryRootPath: string) {
  return db
    .select({ node: nodes, course: courses })
    .from(nodes)
    .innerJoin(courses, eq(courses.id, nodes.courseId))
    .where(eq(nodes.missing, true))
    .all()
    .filter((row) => row.course.folderPath.startsWith(`${libraryRootPath}/`));
}
