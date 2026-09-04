import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  // Nullable rather than NOT NULL: existing accounts created before this
  // column existed have nothing to backfill it with. Required going forward
  // at the validation layer (createUserSchema), not the DB layer.
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Optional per product decision — this app has no outbound email sending
  // (no SMTP anywhere), so this is contact info only, never used for
  // self-service password reset.
  email: text("email"),
  // One of the 5 preset avatar SVGs (see frontend/src/components/avatars),
  // or null to fall back to an initials circle. Deliberately not a free-form
  // upload — no file storage, no path-resolution footgun like the one
  // course covers just hit under the UUID migration.
  avatarId: integer("avatar_id"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
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
  // Logout now soft-ends a session (sets this) instead of deleting the row —
  // a durable login/logout history is exactly what "was logged in for 2
  // days" needs, and deleting the row on every logout threw that away
  // permanently. NULL means still live; requireAuth/getSession treat a row
  // with this set (or past expiresAt) as not authenticatable, same as
  // before. A forced end (admin password reset, self password change) uses
  // this too, so the history shows a session actually ending, not just
  // vanishing.
  endedAt: text("ended_at"),
});

export const libraries = sqliteTable("libraries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  rootPath: text("root_path").notNull().unique(),
  lastScannedAt: text("last_scanned_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  // A scan runs detached from the HTTP request that triggered it (see
  // scanLibrary route) — it can easily outlive a slow client or a proxy
  // timeout, so its progress has to live here rather than in that request's
  // response. The admin UI polls this row instead of waiting on one long
  // fetch, and a page reload mid-scan just resumes reading the same state.
  scanStatus: text("scan_status", { enum: ["idle", "running", "completed", "failed"] })
    .notNull()
    .default("idle"),
  scanStartedAt: text("scan_started_at"),
  scanError: text("scan_error"),
  lastScanSummary: text("last_scan_summary"),
});

// Sections are admin-created and independent of folder structure entirely —
// courses get assigned into them manually (see courses.sectionId), never by
// the scanner.
export const sections = sqliteTable("sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
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
    sectionId: text("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("section_access_unique").on(t.sectionId, t.userId), index("section_access_user_idx").on(t.userId)],
);

export const courses = sqliteTable(
  "courses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sectionId: text("section_id").references(() => sections.id, { onDelete: "set null" }),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    type: text("type", { enum: ["group", "video", "file", "link"] }).notNull(),
    title: text("title").notNull(),
    rawName: text("raw_name").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
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
  nodeId: text("node_id")
    .primaryKey()
    .references(() => nodes.id, { onDelete: "cascade" }),
  durationSeconds: real("duration_seconds"),
  width: integer("width"),
  height: integer("height"),
  codec: text("codec"),
  container: text("container"),
  probedAt: text("probed_at"),
});

export const subtitleTracks = sqliteTable(
  "subtitle_tracks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    nodeId: text("node_id")
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
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoNodeId: text("video_node_id")
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoNodeId: text("video_node_id")
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
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  courseId: text("course_id")
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
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
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
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
    pathId: text("path_id")
      .notNull()
      .references(() => paths.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [uniqueIndex("path_courses_unique").on(t.pathId, t.courseId)],
);

// A durable, admin-visible audit trail — nothing was logged anywhere before
// this. actorUserId is nullable (onDelete set null) since some events are
// system-triggered (a scan completing) rather than a specific user's action,
// and a logged event should survive the actor's own account being deleted
// later rather than disappearing or blocking the delete. targetId is
// deliberately not a real foreign key — it points at whichever table `type`
// implies (a course, a section, a user...), and no single column can carry
// a DB-level FK to more than one table.
export const activityLog = sqliteTable(
  "activity_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    type: text("type", {
      enum: [
        "library_added",
        "library_removed",
        "scan_started",
        "scan_completed",
        "scan_failed",
        "course_marked",
        "course_unmarked",
        "course_orphaned",
        "user_created",
        "user_deleted",
        "user_role_changed",
        "user_password_reset",
        "user_profile_edited",
        "section_created",
        "section_deleted",
        "section_hidden_changed",
        "course_hidden_changed",
        "course_section_assigned",
        "section_access_changed",
        "certificate_issued",
        "certificate_uploaded",
      ],
    }).notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type"),
    targetId: text("target_id"),
    message: text("message").notNull(),
    // JSON-stringified extra detail specific to the event type (e.g. a scan
    // summary's counts, an old/new role pair) — kept free-form rather than
    // one column per possible field, since every event type needs different
    // shapes and most events need none at all.
    metadata: text("metadata"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("activity_log_created_at_idx").on(t.createdAt), index("activity_log_actor_user_id_idx").on(t.actorUserId)],
);

// One row per (user, calendar day) they touched any video's progress —
// existence alone is what matters for a streak, so this is written with an
// idempotent "insert if not already there today" rather than tracking
// anything about what was watched (that's what `progress` is for). `date`
// is a plain "YYYY-MM-DD" string in server-local time, not a timestamp —
// streak math is calendar-day arithmetic, not duration arithmetic.
export const dailyActivity = sqliteTable(
  "daily_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
  },
  (t) => [uniqueIndex("daily_activity_user_date_unique").on(t.userId, t.date)],
);
