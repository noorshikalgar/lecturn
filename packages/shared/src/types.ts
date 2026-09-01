export type Role = "admin" | "user";

export type NodeType = "group" | "video" | "file" | "link";

export interface User {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
}

export interface Library {
  id: number;
  rootPath: string;
  lastScannedAt: string | null;
  scanStatus: "idle" | "running" | "completed" | "failed";
  scanError: string | null;
  lastScanSummary: ScanSummary | null;
}

export interface Section {
  id: number;
  title: string;
  slug: string;
  orderIndex: number;
  hidden: boolean;
}

export interface Course {
  id: number;
  sectionId: number | null;
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

export interface VideoMeta {
  nodeId: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  probedAt: string | null;
}

export interface SubtitleTrack {
  id: number;
  nodeId: number;
  label: string;
  sourceFormat: "vtt" | "srt";
  sourcePath: string;
  cachedVttPath: string | null;
}

export interface Progress {
  userId: number;
  videoNodeId: number;
  positionSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface Note {
  id: number;
  userId: number;
  videoNodeId: number;
  timestampSeconds: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseNote extends Note {
  videoTitle: string;
  videoParentId: number | null;
  videoOrderIndex: number;
}

export interface Certificate {
  id: number;
  courseId: number;
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
  id: number;
  title: string;
  description: string | null;
  coverImage: string | null;
  orderIndex: number;
}

export interface PathCourse {
  pathId: number;
  courseId: number;
  orderIndex: number;
}

export interface CourseNode {
  id: number;
  courseId: number;
  parentId: number | null;
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
  libraryId: number;
  coursesFound: number;
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
  coursesOrphaned: number;
  scannedAt: string;
}

export interface SearchNodeMatch {
  nodeId: number;
  title: string;
  type: NodeType;
  courseId: number;
  courseTitle: string;
}

export interface SearchNoteMatch {
  noteId: number;
  body: string;
  timestampSeconds: number | null;
  videoNodeId: number;
  videoTitle: string;
  courseId: number;
  courseTitle: string;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  directories: string[];
}

export type ExploreEntry =
  | { name: string; path: string; isCourse: true; courseId: number }
  | { name: string; path: string; isCourse: false; courseId: null };

export interface ExploreResult {
  path: string;
  parent: string | null;
  entries: ExploreEntry[];
}
