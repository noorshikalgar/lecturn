import type { NodeType } from "@lecturn/shared";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db, sqlite } from "../client.js";
import { courses, nodes } from "../schema.js";

// SQLite's own bound-parameter limit (SQLITE_MAX_VARIABLE_NUMBER) can be as
// low as 999 depending on how it was built — chunking keeps any single
// query well under that regardless.
const SQL_BATCH_SIZE = 500;

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
  contentFingerprint?: string;
}) {
  return db
    .insert(nodes)
    .values({ ...input, contentFingerprint: input.contentFingerprint ?? null })
    .returning()
    .get();
}

export function refreshNodeOnRescan(id: number, orderIndex: number, orderLocked: boolean) {
  const patch: { missing: boolean; orderIndex?: number } = { missing: false };
  if (!orderLocked) patch.orderIndex = orderIndex;
  db.update(nodes).set(patch).where(eq(nodes.id, id)).run();
}

/** Updates the content fingerprint stored for a node whose path matched
 * exactly but whose underlying file turned out to have changed (a
 * replacement, not a rename — see scanLibrary.ts). Separate from
 * refreshNodeOnRescan since that runs on every ordinary rescan match and
 * this only matters on the rarer occasions the content itself moved. */
export function updateNodeFingerprint(id: number, contentFingerprint: string | undefined) {
  db.update(nodes)
    .set({ contentFingerprint: contentFingerprint ?? null })
    .where(eq(nodes.id, id))
    .run();
}

/** Finds an existing node this scan hasn't already matched by exact path,
 * whose content is identical to an incoming file — i.e. "this is that file,
 * just renamed and/or moved to a different folder": same course, same
 * type, same content fingerprint. Deliberately NOT scoped to the same
 * parent — moving a lecture into a different chapter/folder is exactly the
 * kind of reorganization this needs to survive too. `excludeIds` keeps a
 * single scan run from matching two different incoming files to the same
 * old node (each match should only ever be used once per scan). Only
 * called when the incoming file's exact relativePath didn't already match
 * a row (see scanLibrary.ts's persistTree) and it has a known fingerprint
 * (groups/links never do, so they're never rename-matched — only
 * video/file nodes are). */
export function findRenameCandidate(courseId: number, type: NodeType, contentFingerprint: string, excludeIds: number[]) {
  const conditions = [eq(nodes.courseId, courseId), eq(nodes.type, type), eq(nodes.contentFingerprint, contentFingerprint)];
  if (excludeIds.length > 0) conditions.push(notInArray(nodes.id, excludeIds));
  return db
    .select()
    .from(nodes)
    .where(and(...conditions))
    .get();
}

/** Re-points an existing node at a renamed/moved file: new relativePath/
 * parentId/rawName, missing cleared, order refreshed the same way a normal
 * rescan match would be (skipped if the admin has locked this node's
 * order). `title` is passed only when it's safe to auto-update (the caller
 * has already checked the current title wasn't manually customized) —
 * omitted, it's left exactly as-is. Node id — and everything keyed on it,
 * chiefly progress — is untouched, which is the entire point: the viewer's
 * watch history follows the file across the rename instead of starting
 * over on a fresh node. */
export function renameNode(
  id: number,
  input: { relativePath: string; parentId: number | null; title?: string; rawName: string; orderIndex: number; orderLocked: boolean },
) {
  const patch: {
    missing: boolean;
    relativePath: string;
    parentId: number | null;
    rawName: string;
    title?: string;
    orderIndex?: number;
  } = {
    missing: false,
    relativePath: input.relativePath,
    parentId: input.parentId,
    rawName: input.rawName,
  };
  if (input.title !== undefined) patch.title = input.title;
  if (!input.orderLocked) patch.orderIndex = input.orderIndex;
  db.update(nodes).set(patch).where(eq(nodes.id, id)).run();
}

/** Flags nodes not seen in the latest scan as missing (never deleted, so an
 * admin can see what vanished). Returns how many rows were newly flagged —
 * computed as a set difference in JS rather than one `NOT IN (keep-list)`
 * query, for two reasons: it only counts rows actually transitioning to
 * missing (a raw UPDATE...WHERE's `changes` count includes rows that
 * already matched, silently inflating the "flagged" total on every repeat
 * scan), and it keeps bound-parameter counts small — the removed-files list
 * is normally far smaller than the kept-files list, and it's batched
 * regardless in case a rescan ever does remove almost everything. */
export function flagMissingNodes(courseId: number, keepRelativePaths: string[]): number {
  const keepSet = new Set(keepRelativePaths);
  const existing = db
    .select({ relativePath: nodes.relativePath })
    .from(nodes)
    .where(and(eq(nodes.courseId, courseId), eq(nodes.missing, false)))
    .all();
  const toFlag = existing.map((n) => n.relativePath).filter((p) => !keepSet.has(p));
  let flagged = 0;
  for (let i = 0; i < toFlag.length; i += SQL_BATCH_SIZE) {
    const batch = toFlag.slice(i, i + SQL_BATCH_SIZE);
    const result = db
      .update(nodes)
      .set({ missing: true })
      .where(and(eq(nodes.courseId, courseId), inArray(nodes.relativePath, batch)))
      .run();
    flagged += result.changes;
  }
  return flagged;
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

/** True if parentId is a usable parent for a node in this course — null
 * (root), or an existing "group" node in the same course that isn't the
 * node itself. There's no DB-level FK enforcing this (see the schema
 * comment on nodes_parent_id_idx), so route handlers that let a client set
 * parentId must check this first. */
export function isValidParent(courseId: number, parentId: number | null, excludeNodeId?: number): boolean {
  if (parentId === null) return true;
  if (parentId === excludeNodeId) return false;
  const parent = getNodeById(parentId);
  return !!parent && parent.courseId === courseId && parent.type === "group";
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
