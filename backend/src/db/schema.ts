import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  expiresAt: text("expires_at").notNull(),
});

// Lets an admin override the scanner's section-vs-course heuristic for a
// specific folder when it guesses wrong; the scanner checks this before
// applying its own logic, so a rescan respects the override going forward.
export const classificationOverrides = sqliteTable("classification_overrides", {
  folderPath: text("folder_path").primaryKey(),
  kind: text("kind", { enum: ["section", "course"] }).notNull(),
});

export const libraries = sqliteTable("libraries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rootPath: text("root_path").notNull().unique(),
  lastScannedAt: text("last_scanned_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const sections = sqliteTable("sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  libraryId: integer("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  folderPath: text("folder_path"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sectionId: integer("section_id").references(() => sections.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  folderPath: text("folder_path").notNull().unique(),
  coverImagePath: text("cover_image_path"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// courseId is nullable so a folder can be provisionally scanned before the
// section/course classification pass assigns it; NULL rows are pruned at the
// end of a scan run.
export const nodes = sqliteTable(
  "nodes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    type: text("type", { enum: ["group", "video", "file", "link"] }).notNull(),
    title: text("title").notNull(),
    rawName: text("raw_name").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    // Set once an admin explicitly reorders this node; the scanner then skips
    // recomputing its order_index on future rescans so manual arrangement sticks.
    orderLocked: integer("order_locked", { mode: "boolean" }).notNull().default(false),
    relativePath: text("relative_path").notNull(),
    missing: integer("missing", { mode: "boolean" }).notNull().default(false),
    // Only populated for type "link" (parsed from a .url file's target).
    targetUrl: text("target_url"),
  },
  (t) => [uniqueIndex("nodes_course_relpath_unique").on(t.courseId, t.relativePath)],
);

export const videoMeta = sqliteTable("video_meta", {
  nodeId: integer("node_id")
    .primaryKey()
    .references(() => nodes.id, { onDelete: "cascade" }),
  durationSeconds: real("duration_seconds"),
  width: integer("width"),
  height: integer("height"),
  codec: text("codec"),
  container: text("container"),
  needsRemux: integer("needs_remux", { mode: "boolean" }).notNull().default(false),
  probedAt: text("probed_at"),
});

export const subtitleTracks = sqliteTable("subtitle_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nodeId: integer("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  sourceFormat: text("source_format", { enum: ["vtt", "srt"] }).notNull(),
  sourcePath: text("source_path").notNull(),
  cachedVttPath: text("cached_vtt_path"),
});

export const progress = sqliteTable(
  "progress",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoNodeId: integer("video_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    positionSeconds: real("position_seconds").notNull().default(0),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    lastWatchedAt: text("last_watched_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("progress_user_video_unique").on(t.userId, t.videoNodeId)],
);

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoNodeId: integer("video_node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  timestampSeconds: real("timestamp_seconds"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const certificates = sqliteTable("certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  uploadedAt: text("uploaded_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const paths = sqliteTable("paths", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const pathCourses = sqliteTable(
  "path_courses",
  {
    pathId: integer("path_id")
      .notNull()
      .references(() => paths.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [uniqueIndex("path_courses_unique").on(t.pathId, t.courseId)],
);
