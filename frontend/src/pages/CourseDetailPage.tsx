import type { CourseNote, CourseTreeNode } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Award, Clock, FileText, ListChecks, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CertificatePage } from "../components/course/CertificatePage";
import { CourseTree } from "../components/course/CourseTree";
import { FilePreviewPane } from "../components/course/FilePreviewPane";
import { CoursePlaceholder } from "../components/CoursePlaceholder";
import { PageContainer } from "../components/layout/PageContainer";
import { getCourse, getSections } from "../lib/api/courses";
import { getNotesForCourse } from "../lib/api/notes";
import { getCourseProgress } from "../lib/api/progress";
import { flattenAll, flattenVideos } from "../lib/courseTree";
import { formatDuration } from "../lib/formatDuration";

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

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">No notes yet — jump into a lesson and add some.</p>;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{group.title}</h3>
          <div className="space-y-2">
            {group.notes.map((note) => (
              <div key={note.id} className="rounded-md border border-border bg-card/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{note.videoTitle}</p>
                  {note.timestampSeconds !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(note.timestampSeconds)}</span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
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

  const { data: sectionsData } = useQuery({ queryKey: ["sections"], queryFn: getSections });

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
  // The most recent completed watch — a reasonable stand-in for "when this
  // learner personally finished the course," since there's no single
  // per-user completion timestamp stored anywhere.
  const completedAtForUser =
    progressData?.items.filter((p) => p.completed).sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))[0]
      ?.lastWatchedAt ?? null;

  function selectVideo(node: CourseTreeNode) {
    navigate(`/courses/${courseId}/watch?node=${node.id}`);
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading course…</div>;
  }
  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Course not found.</div>;
  }

  const course = data.course;
  const sectionTitle = course.sectionId ? sectionsData?.sections.find((s) => s.id === course.sectionId)?.title : "Unsectioned";

  return (
    <PageContainer>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
        <div>
          <div className="aspect-video w-full overflow-hidden rounded-[10px] border border-border">
            {course.coverImagePath ? (
              <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <CoursePlaceholder />
            )}
          </div>

          {sectionTitle && (
            <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">{sectionTitle}</p>
          )}
          <h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground">{course.title}</h1>
          {course.description && (
            <p className="mt-2.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{course.description}</p>
          )}

          {nextVideo && (
            <button
              onClick={() => selectVideo(nextVideo)}
              className="mt-4 flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Play size={14} fill="currentColor" />
              {allCompleted ? "Watch Again" : hasStarted ? "Continue" : "Start Course"}
            </button>
          )}
        </div>

        <div className="rounded-[10px] border border-border bg-card p-[18px]">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">Section</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{sectionTitle}</p>

          <div className="my-3.5 h-px bg-border" />

          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">Duration</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock size={13} className="shrink-0 text-muted-foreground" />
            {formatDuration(course.durationSeconds)} · {allVideos.length} lesson{allVideos.length === 1 ? "" : "s"}
          </p>

          {allVideos.length > 0 && (
            <>
              <div className="my-3.5 h-px bg-border" />
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">Progress</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={clsx("h-full rounded-full", allCompleted ? "bg-emerald-600" : "bg-primary")}
                  style={{ width: `${Math.round((completedCount / allVideos.length) * 100)}%` }}
                />
              </div>
              <p className={clsx("mt-1.5 font-mono text-xs", allCompleted ? "font-medium text-emerald-600" : "text-muted-foreground")}>
                {allCompleted ? "Completed" : `${completedCount} / ${allVideos.length} watched`}
              </p>
            </>
          )}
        </div>

        <div className="lg:col-span-2 border-t border-border pt-4">
          <div className="mb-4 flex gap-1 border-b border-border">
            <button
              onClick={() => setTab("curriculum")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition",
                tab === "curriculum" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListChecks size={14} />
              Curriculum
            </button>
            <button
              onClick={() => setTab("notes")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition",
                tab === "notes" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText size={14} />
              Notes
            </button>
            {allCompleted && (
              <button
                onClick={() => setTab("certificate")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition",
                  tab === "certificate" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Award size={14} />
                Certificate
              </button>
            )}
          </div>

          {tab === "curriculum" &&
            (previewFileNode ? (
              <div className="h-[60vh] overflow-hidden rounded-lg border border-border">
                <FilePreviewPane node={previewFileNode} onClose={() => setPreviewFileNode(null)} />
              </div>
            ) : (
              <CourseTree
                nodes={tree}
                activeNodeId={null}
                onSelectVideo={selectVideo}
                onPreviewFile={setPreviewFileNode}
                progressByNode={progressByNode}
              />
            ))}
          {tab === "notes" && <NotesTab courseId={courseId} tree={tree} />}
          {tab === "certificate" && allCompleted && <CertificatePage course={course} completedAt={completedAtForUser} />}
        </div>
      </div>
    </PageContainer>
  );
}
