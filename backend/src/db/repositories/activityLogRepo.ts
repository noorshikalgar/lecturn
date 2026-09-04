import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client.js";
import { activityLog, users } from "../schema.js";

export type ActivityType =
  | "library_added"
  | "library_removed"
  | "scan_started"
  | "scan_completed"
  | "scan_failed"
  | "course_marked"
  | "course_unmarked"
  | "course_orphaned"
  | "user_created"
  | "user_deleted"
  | "user_role_changed"
  | "user_password_reset"
  | "user_profile_edited"
  | "user_username_changed"
  | "section_created"
  | "section_deleted"
  | "section_hidden_changed"
  | "course_hidden_changed"
  | "course_section_assigned"
  | "section_access_changed"
  | "certificate_issued"
  | "certificate_uploaded";

export function logActivity(input: {
  type: ActivityType;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  message: string;
  metadata?: object;
}) {
  db.insert(activityLog)
    .values({
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      message: input.message,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .run();
}

const PAGE_SIZE = 50;

/** Newest-first, keyset-paginated (createdAt < cursor) rather than
 * offset-paginated — an admin scrolling this feed while new events keep
 * landing shouldn't see rows shift or repeat, which offset pagination would
 * do the moment a row gets inserted ahead of the current page. */
export function listActivity(input: { cursor?: string; type?: ActivityType; actorUserId?: string } = {}) {
  const conditions = [
    input.cursor ? lt(activityLog.createdAt, input.cursor) : undefined,
    input.type ? eq(activityLog.type, input.type) : undefined,
    input.actorUserId ? eq(activityLog.actorUserId, input.actorUserId) : undefined,
  ].filter((c) => c !== undefined);

  const rows = db
    .select({
      id: activityLog.id,
      type: activityLog.type,
      actorUserId: activityLog.actorUserId,
      actorUsername: users.username,
      targetType: activityLog.targetType,
      targetId: activityLog.targetId,
      message: activityLog.message,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(PAGE_SIZE + 1)
    .all();

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return {
    events: page.map((r) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null })),
    nextCursor: hasMore ? page[page.length - 1].createdAt : null,
  };
}
