export type Role = "admin" | "user";

export type NodeType = "group" | "video" | "file" | "link";

export interface User {
  id: string;
  username: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarId: number | null;
  createdAt: string;
  /** Whether this account's one-time admin-initiated username change is
   * still available (never used yet) — see users.usernameChangedAt's
   * schema comment. */
  usernameChangeAvailable: boolean;
}

export interface Library {
  id: string;
  rootPath: string;
  lastScannedAt: string | null;
  scanStatus: "idle" | "running" | "completed" | "failed";
  scanError: string | null;
  lastScanSummary: ScanSummary | null;
}

export interface Section {
  id: string;
  title: string;
  slug: string;
  orderIndex: number;
  hidden: boolean;
}

export interface Course {
  id: string;
  sectionId: string | null;
  collectionId: string | null;
  title: string;
  description: string | null;
  folderPath: string;
  topLevelFolder: string | null;
  coverImagePath: string | null;
  durationSeconds: number;
  // Whether *any* user has ever completed this course — not what a course
  // card should show, since that would mark it "Completed" for someone who
  // hasn't watched a single lesson of it. Kept for the certificate-upload
  // flow; see completedByUser for what's actually true for the viewer.
  completedAt: string | null;
  createdAt: string;
  hidden: boolean;
  /** Only populated by list endpoints backing course cards (listCourses,
   * listRecentCourses, etc.) — undefined elsewhere (getCourseById, paths). */
  videoCount?: number;
  /** Whether the requesting user specifically has completed every video in
   * this course — computed per-request from their own progress, unlike
   * completedAt above. Populated by the same list endpoints as videoCount. */
  completedByUser?: boolean;
}

// Groups several marked-course subfolders under one shared parent folder
// into a single browsable card — see backend/src/db/schema.ts's collections
// table comment. Has no node tree, no progress, no certificate of its own;
// it's a pure organizational layer over its child courses.
export interface Collection {
  id: string;
  title: string;
  folderPath: string;
  topLevelFolder: string | null;
  sectionId: string | null;
  hidden: boolean;
  createdAt: string;
  /** Populated only by GET /api/collections/:id — its child courses. */
  courses?: Course[];
}

export interface VideoMeta {
  nodeId: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  probedAt: string | null;
}

export interface SubtitleTrack {
  id: string;
  nodeId: string;
  label: string;
  sourceFormat: "vtt" | "srt";
  sourcePath: string;
  cachedVttPath: string | null;
}

export interface Progress {
  userId: string;
  videoNodeId: string;
  positionSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface Note {
  id: string;
  userId: string;
  videoNodeId: string;
  timestampSeconds: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseNote extends Note {
  videoTitle: string;
  videoParentId: string | null;
  videoOrderIndex: number;
}

export interface Certificate {
  id: string;
  courseId: string;
  filePath: string;
  uploadedAt: string;
}

// A per-user, digitally signed record that a specific course was completed —
// distinct from Certificate above (an admin-uploaded file attached to a
// course as a whole). recipientName/courseTitle are snapshots taken at
// issuance time, not live lookups, so a later rename never rewrites a
// certificate that already went out.
export interface CourseCertificate {
  code: string;
  recipientName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
}

export interface CertificateVerification {
  valid: boolean;
  certificate: {
    code: string;
    recipientName: string;
    courseTitle: string;
    completedAt: string;
    issuedAt: string;
    issuer: string;
  } | null;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  orderIndex: number;
}

export interface PathCourse {
  pathId: string;
  courseId: string;
  orderIndex: number;
}

export interface CourseNode {
  id: string;
  courseId: string;
  parentId: string | null;
  type: NodeType;
  title: string;
  rawName: string;
  orderIndex: number;
  relativePath: string;
  missing: boolean;
  targetUrl: string | null;
}

export interface CourseTreeNode extends CourseNode {
  children: CourseTreeNode[];
  video?: VideoMeta;
  subtitles?: SubtitleTrack[];
}

export interface ScanSummary {
  libraryId: string;
  coursesFound: number;
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
  coursesOrphaned: number;
  scannedAt: string;
}

export interface SearchNodeMatch {
  nodeId: string;
  title: string;
  type: NodeType;
  courseId: string;
  courseTitle: string;
}

export interface SearchNoteMatch {
  noteId: string;
  body: string;
  timestampSeconds: number | null;
  videoNodeId: string;
  videoTitle: string;
  courseId: string;
  courseTitle: string;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  directories: string[];
}

export type ExploreEntry =
  | { name: string; path: string; isCourse: true; courseId: string; isCollection: false; collectionId: null }
  | { name: string; path: string; isCourse: false; courseId: null; isCollection: true; collectionId: string }
  | { name: string; path: string; isCourse: false; courseId: null; isCollection: false; collectionId: null };

export interface ExploreResult {
  path: string;
  parent: string | null;
  entries: ExploreEntry[];
}

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

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorUserId: string | null;
  actorUsername: string | null;
  targetType: string | null;
  targetId: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityFeed {
  events: ActivityEvent[];
  nextCursor: string | null;
}

export interface UserSessionSummary {
  token: string;
  createdAt: string;
  endedAt: string | null;
  lastSeenAt: string | null;
}

export interface UserActivitySummary {
  coursesCompleted: number;
  coursesInProgress: number;
  totalWatchSeconds: number;
  currentStreak: number;
  currentlyWatching: { courseId: string; courseTitle: string; videoTitle: string; collectionTitle: string | null } | null;
  sessions: UserSessionSummary[];
}
