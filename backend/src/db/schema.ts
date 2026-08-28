import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  // Bumped on every authenticated request (see sessionsRepo.touchSession) so
  // a session can be expired for inactivity independent of its absolute TTL.
  // Nullable rather than NOT NULL + default: SQLite's ALTER TABLE ADD COLUMN
  // rejects a non-constant default like CURRENT_TIMESTAMP outright, and
  // adding a NOT NULL constraint afterward would need the same
  // recreate-the-table migration this column exists to help retire — a
  // session with no value here just hasn't been touched since login, so
  // falling back to createdAt is a fine and obvious default at read time.
  lastSeenAt: text("last_seen_at"),
});

export const libraries = sqliteTable("libraries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rootPath: text("root_path").notNull().unique(),
  lastScannedAt: text("last_scanned_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// Sections are admin-created and independent of folder structure entirely —
// courses get assigned into them manually (see courses.sectionId), never by
// the scanner.
export const sections = sqliteTable("sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  // Admin-only kill switch — beats section_access entirely. A hidden section
  // is invisible to every non-admin regardless of any access grant.
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
});

// Allow-list of which users can see a section. A section with zero rows here
// is public (visible to every authenticated user); admins always see every
// section regardless of this table.
export const sectionAccess = sqliteTable(
  "section_access",
  {
    sectionId: integer("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("section_access_unique").on(t.sectionId, t.userId), index("section_access_user_idx").on(t.userId)],
);

export const courses = sqliteTable(
  "courses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sectionId: integer("section_id").references(() => sections.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    folderPath: text("folder_path").notNull().unique(),
    // The scanned folder's immediate parent under the library root (e.g. "AI",
    // "Backend") — purely a display label to help the admin group courses when
    // assigning them to sections; never used to derive a section automatically.
    topLevelFolder: text("top_level_folder"),
    coverImagePath: text("cover_image_path"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    // Admin-only kill switch, independent of the section's own hidden flag —
    // lets an admin hide one course without hiding the whole section it's in.
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("courses_section_id_idx").on(t.sectionId)],
);

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
    // "<byteSize>:<sha1 of first+last 64KB>" of the underlying file at last
    // scan — null for "group"/"link" (no single backing file). Renaming or
    // moving a file on disk changes relativePath/parentId but not this, so
    // it's what lets a rescan recognize "same file, moved/renamed" and keep
    // updating the existing node (preserving progress, notes, and any
    // admin-set title) instead of flagging the old path missing and
    // inserting a brand-new, unwatched node under the new one. Size alone
    // was considered and rejected: two unrelated lecture videos landing on
    // the exact same byte count is a real, not just theoretical, way to
    // misattribute someone else's watch history. Sampling instead of
    // hashing the whole file keeps this cheap regardless of video size. See
    // scanLibrary.ts's rename-detection fallback.
    contentFingerprint: text("content_fingerprint"),
  },
  (t) => [
    uniqueIndex("nodes_course_relpath_unique").on(t.courseId, t.relativePath),
    // No DB-level foreign key on parentId: SQLite can't add a FK to an
    // existing column without recreating the table, and this table already
    // paid for that mistake once (see the migrate.ts comment on
    // foreign_keys=OFF). Validated at the application layer instead — see
    // isValidParent in nodesRepo.ts. Still indexed, since it's queried
    // as heavily as courseId.
    index("nodes_parent_id_idx").on(t.parentId),
  ],
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

export const subtitleTracks = sqliteTable(
  "subtitle_tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nodeId: integer("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sourceFormat: text("source_format", { enum: ["vtt", "srt"] }).notNull(),
    sourcePath: text("source_path").notNull(),
    cachedVttPath: text("cached_vtt_path"),
  },
  (t) => [index("subtitle_tracks_node_id_idx").on(t.nodeId)],
);

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

export const notes = sqliteTable(
  "notes",
  {
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
  },
  (t) => [index("notes_user_id_idx").on(t.userId), index("notes_video_node_id_idx").on(t.videoNodeId)],
);

export const certificates = sqliteTable("certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  uploadedAt: text("uploaded_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// A per-user, cryptographically signed record that a course was completed —
// distinct from `certificates` above, which is an admin-uploaded file
// attached to a course as a whole, not tied to any one learner. `signature`
// covers a canonical payload built from every other column here (see
// certificateSigning.ts); recipientName/courseTitle are snapshotted at
// issuance time on purpose — a later username or course rename must not
// silently rewrite a certificate that already went out under the old name.
export const certificateIssuances = sqliteTable(
  "certificate_issuances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    courseTitle: text("course_title").notNull(),
    completedAt: text("completed_at").notNull(),
    issuedAt: text("issued_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    signature: text("signature").notNull(),
  },
  (t) => [uniqueIndex("certificate_issuances_user_course_unique").on(t.userId, t.courseId)],
);

export const paths = sqliteTable("paths", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  // Admin-set display order for the top-level paths list — mirrors
  // sections.orderIndex. New paths append (max + 1); nothing recomputes
  // this automatically otherwise.
  orderIndex: integer("order_index").notNull().default(0),
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
