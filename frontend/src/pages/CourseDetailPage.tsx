import type { CourseNote, CourseTreeNode } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Award, PlayCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CertificatePage } from "../components/course/CertificatePage";
import { CourseTree } from "../components/course/CourseTree";
import { FilePreviewPane } from "../components/course/FilePreviewPane";
import { CoursePlaceholder } from "../components/CoursePlaceholder";
import { PageContainer } from "../components/layout/PageContainer";
import { getCourse } from "../lib/api/courses";
import { getNotesForCourse } from "../lib/api/notes";
import { getCourseProgress } from "../lib/api/progress";
import { formatDuration } from "../lib/formatDuration";
import { useAuth } from "../lib/AuthContext";

function flattenVideos(nodes: CourseTreeNode[]): CourseTreeNode[] {
  const result: CourseTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "video") result.push(node);
    if (node.children.length > 0) result.push(...flattenVideos(node.children));
  }
  return result;
}

/** id -> title/orderIndex for every node (groups included), used to resolve
 * a note's chapter name and to keep chapters in curriculum order. */
function flattenAll(nodes: CourseTreeNode[], map: Map<number, { title: string; orderIndex: number }>) {
  for (const node of nodes) {
    map.set(node.id, { title: node.title, orderIndex: node.orderIndex });
    if (node.children.length > 0) flattenAll(node.children, map);
  }
}

type TabKey = "curriculum" | "notes" | "certificate";

function NotesTab({ courseId, tree }: { courseId: number; tree: CourseTreeNode[] }) {
  const { data } = useQuery({ queryKey: ["course-notes", courseId], queryFn: () => getNotesForCourse(courseId) });

  const nodeMap = useMemo(() => {
    const map = new Map<number, { title: string; orderIndex: number }>();
    flattenAll(tree, map);
    return map;
  }, [tree]);

  const groups = useMemo(() => {
    const byChapter = new Map<string, { title: string; orderIndex: number; notes: CourseNote[] }>();
    for (const note of data?.notes ?? []) {
      const chapter = note.videoParentId !== null ? nodeMap.get(note.videoParentId) : undefined;
      const key = chapter ? `c-${note.videoParentId}` : "top-level";
      if (!byChapter.has(key)) byChapter.set(key, { title: chapter?.title ?? "General", orderIndex: chapter?.orderIndex ?? -1, notes: [] });
      byChapter.get(key)!.notes.push(note);
    }
    return [...byChapter.values()].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [data, nodeMap]);

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  if (groups.length === 0) return <p className="text-sm text-slate-500">No notes yet — jump into a lesson and add some.</p>;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-sm font-semibold text-slate-200">{group.title}</h3>
          <div className="space-y-2">
            {group.notes.map((note) => (
              <div key={note.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-slate-400">{note.videoTitle}</p>
                  {note.timestampSeconds !== null && (
                    <span className="shrink-0 text-xs text-slate-600">{formatDuration(note.timestampSeconds)}</span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("curriculum");
  const [previewFileNode, setPreviewFileNode] = useState<CourseTreeNode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => getCourse(courseId),
    enabled: Number.isFinite(courseId),
  });

  const { data: progressData } = useQuery({
    queryKey: ["course-progress", courseId],
    queryFn: () => getCourseProgress(courseId),
    enabled: Number.isFinite(courseId),
  });

  const tree = data?.tree ?? [];
  const allVideos = useMemo(() => flattenVideos(tree), [tree]);
  const progressByNode = useMemo(() => {
    const map: Record<number, { completed: boolean }> = {};
    for (const p of progressData?.items ?? []) map[p.videoNodeId] = { completed: p.completed };
    return map;
  }, [progressData]);

  const completedCount = allVideos.filter((v) => progressByNode[v.id]?.completed).length;
  const allCompleted = allVideos.length > 0 && completedCount >= allVideos.length;
  const hasStarted = (progressData?.items.length ?? 0) > 0;
  const nextVideo = allVideos.find((v) => !progressByNode[v.id]?.completed) ?? allVideos[0];

  function selectVideo(node: CourseTreeNode) {
    navigate(`/courses/${courseId}/watch?node=${node.id}`);
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading course…</div>;
  }
  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Course not found.</div>;
  }

  const course = data.course;

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-72">
            {course.coverImagePath ? (
              <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <CoursePlaceholder title={course.title} />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-2xl font-semibold text-slate-50">{course.title}</h1>
            {course.description && <p className="text-sm text-slate-400">{course.description}</p>}
            <p className="text-xs text-slate-500">
              {allVideos.length} lesson{allVideos.length === 1 ? "" : "s"} · {formatDuration(course.durationSeconds)}
            </p>

            {allVideos.length > 0 && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={clsx("h-full rounded-full", allCompleted ? "bg-emerald-500" : "bg-slate-400")}
                    style={{ width: `${Math.round((completedCount / allVideos.length) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {allCompleted ? "Completed" : `${completedCount} / ${allVideos.length} watched`}
                </p>
              </div>
            )}

            {nextVideo && (
              <button
                onClick={() => selectVideo(nextVideo)}
                className="mt-2 flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
              >
                <PlayCircle size={16} />
                {hasStarted ? "Continue" : "Start Course"}
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className="mb-4 flex gap-1 border-b border-slate-800">
            <button
              onClick={() => setTab("curriculum")}
              className={clsx(
                "px-3 py-2 text-sm font-medium transition",
                tab === "curriculum" ? "border-b-2 border-slate-100 text-slate-100" : "text-slate-500 hover:text-slate-300",
              )}
            >
              Curriculum
            </button>
            <button
              onClick={() => setTab("notes")}
              className={clsx(
                "px-3 py-2 text-sm font-medium transition",
                tab === "notes" ? "border-b-2 border-slate-100 text-slate-100" : "text-slate-500 hover:text-slate-300",
              )}
            >
              Notes
            </button>
            {allCompleted && (
              <button
                onClick={() => setTab("certificate")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition",
                  tab === "certificate" ? "border-b-2 border-slate-100 text-slate-100" : "text-slate-500 hover:text-slate-300",
                )}
              >
                <Award size={14} />
                Certificate
              </button>
            )}
          </div>

          {tab === "curriculum" &&
            (previewFileNode ? (
              <div className="h-[60vh] overflow-hidden rounded-lg border border-slate-800">
                <FilePreviewPane node={previewFileNode} onClose={() => setPreviewFileNode(null)} />
              </div>
            ) : (
              <CourseTree
                courseId={courseId}
                nodes={tree}
                activeNodeId={null}
                onSelectVideo={selectVideo}
                onPreviewFile={setPreviewFileNode}
                isAdmin={user?.role === "admin"}
                progressByNode={progressByNode}
              />
            ))}
          {tab === "notes" && <NotesTab courseId={courseId} tree={tree} />}
          {tab === "certificate" && allCompleted && <CertificatePage course={course} />}
        </div>
      </div>
    </PageContainer>
  );
}
