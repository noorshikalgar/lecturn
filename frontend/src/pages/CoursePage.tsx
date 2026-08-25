import type { CourseTreeNode } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, PanelRightClose, PanelRightOpen, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CertificatePage } from "../components/course/CertificatePage";
import { CourseTree } from "../components/course/CourseTree";
import { FilePreviewPane } from "../components/course/FilePreviewPane";
import { NotesPanel } from "../components/course/NotesPanel";
import { ResourcesPanel } from "../components/course/ResourcesPanel";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { markCourseComplete } from "../lib/api/certificates";
import { getCourse } from "../lib/api/courses";
import { getCourseProgress } from "../lib/api/progress";
import { useAuth } from "../lib/AuthContext";

function findFirstVideo(nodes: CourseTreeNode[]): CourseTreeNode | undefined {
  for (const node of nodes) {
    if (node.type === "video") return node;
    if (node.children.length > 0) {
      const found = findFirstVideo(node.children);
      if (found) return found;
    }
  }
  return undefined;
}

function findNodeById(nodes: CourseTreeNode[], id: number): CourseTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function flattenVideos(nodes: CourseTreeNode[]): CourseTreeNode[] {
  const result: CourseTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "video") result.push(node);
    if (node.children.length > 0) result.push(...flattenVideos(node.children));
  }
  return result;
}

type TabKey = "notes" | "resources";
const TABS: { key: TabKey; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "resources", label: "Resources" },
];

const SIDEBAR_MIN_WIDTH = 288;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 320;

export function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  // Read once at mount — the Course Detail page's Curriculum tab links here
  // with ?node=<id> to jump straight to a specific lesson; after that,
  // in-page navigation (sidebar clicks) manages selection locally.
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const param = searchParams.get("node");
    return param ? Number(param) : null;
  });
  const [showCertificatePage, setShowCertificatePage] = useState(false);
  const [previewFileNode, setPreviewFileNode] = useState<CourseTreeNode | null>(null);
  const [tab, setTab] = useState<TabKey>("notes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => getCourse(courseId),
    enabled: Number.isFinite(courseId),
  });

  const progressQueryKey = ["course-progress", courseId];
  const { data: progressData } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => getCourseProgress(courseId),
    enabled: Number.isFinite(courseId),
  });

  const completeMutation = useMutation({
    mutationFn: () => markCourseComplete(courseId, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["course", courseId] }),
  });

  const tree = data?.tree ?? [];
  const activeNode = useMemo(() => {
    if (selectedId !== null) {
      const found = findNodeById(tree, selectedId);
      if (found) return found;
    }
    return findFirstVideo(tree);
  }, [tree, selectedId]);

  const allVideos = useMemo(() => flattenVideos(tree), [tree]);
  const progressByNode = useMemo(() => {
    const map: Record<number, { completed: boolean }> = {};
    for (const p of progressData?.items ?? []) map[p.videoNodeId] = { completed: p.completed };
    return map;
  }, [progressData]);
  const completedCount = progressData?.items.filter((p) => p.completed).length ?? 0;
  const allCompleted = allVideos.length > 0 && completedCount >= allVideos.length;

  // Auto-mark the course complete once every video has been watched — no
  // manual "mark complete" button; the certificate page unlocks itself.
  useEffect(() => {
    if (allCompleted && data && !data.course.completedAt) {
      completeMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted, data?.course.completedAt]);

  function selectVideo(node: CourseTreeNode) {
    setShowCertificatePage(false);
    setPreviewFileNode(null);
    setSelectedId(node.id);
  }

  function previewFile(node: CourseTreeNode) {
    setShowCertificatePage(false);
    setPreviewFileNode(node);
  }

  function handleVideoEnded() {
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
    if (!autoplayNext || !activeNode) return;
    const index = allVideos.findIndex((v) => v.id === activeNode.id);
    const next = index >= 0 ? allVideos[index + 1] : undefined;
    if (next) setSelectedId(next.id);
  }

  // Sidebar sits on the right, so dragging left grows it — track the pointer's
  // movement from where the drag started rather than its absolute position.
  function handleResizeStart(e: ReactPointerEvent) {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMove(ev: PointerEvent) {
      const delta = startX - ev.clientX;
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta)));
    }
    function onUp() {
      setIsResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading course…</div>;
  }

  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Course not found.</div>;
  }

  const previewing = previewFileNode && !showCertificatePage;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={`/courses/${courseId}`}
            title="Back to course details"
            className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <ChevronLeft size={18} />
          </Link>
          <h1 className="truncate text-sm font-semibold text-slate-100">{data.course.title}</h1>
        </div>
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          title={sidebarOpen ? "Hide course content" : "Show course content"}
          className="shrink-0 rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={clsx("min-w-0 flex-1", previewing ? "overflow-hidden" : "overflow-y-auto")}>
          {previewing ? (
            <FilePreviewPane node={previewFileNode} onClose={() => setPreviewFileNode(null)} />
          ) : (
            <div className="space-y-4 px-6 py-6">
              {showCertificatePage ? (
              <CertificatePage course={data.course} />
            ) : (
              <>
                {activeNode ? (
                  <VideoPlayer
                    node={activeNode}
                    videoRef={videoRef}
                    onEnded={handleVideoEnded}
                    onProgressSaved={() => queryClient.invalidateQueries({ queryKey: progressQueryKey })}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-900 text-sm text-slate-500">
                    This course has no videos yet.
                  </div>
                )}
                <div>
                  {activeNode?.type === "video" && <p className="text-sm text-slate-400">{activeNode.title}</p>}
                  {data.course.description && <p className="mt-3 text-sm text-slate-400">{data.course.description}</p>}
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <div className="mb-3 flex gap-1 border-b border-slate-800">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={clsx(
                          "px-3 py-2 text-sm font-medium transition",
                          tab === t.key
                            ? "border-b-2 border-slate-100 text-slate-100"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {tab === "notes" &&
                    (activeNode?.type === "video" ? (
                      <NotesPanel videoNodeId={activeNode.id} videoRef={videoRef} />
                    ) : (
                      <p className="text-sm text-slate-500">Select a video to take notes on it.</p>
                    ))}
                  {tab === "resources" && <ResourcesPanel nodes={tree} onPreviewFile={previewFile} />}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div
          onPointerDown={handleResizeStart}
          title="Drag to resize"
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-slate-700 active:bg-slate-600"
        />
      )}

      <aside
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        className={clsx(
          "flex shrink-0 flex-col overflow-hidden border-slate-800 bg-slate-900/50",
          !isResizing && "transition-[width,opacity] duration-300 ease-in-out",
          sidebarOpen ? "border-l opacity-100" : "border-l-0 opacity-0",
        )}
      >
        <div style={{ width: sidebarWidth }} className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Course Content</span>
          <button
            onClick={() => setAutoplayNext((a) => !a)}
            title={autoplayNext ? "Autoplay next: on" : "Autoplay next: off"}
            className={clsx(
              "flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs",
              autoplayNext
                ? "border-emerald-800 bg-emerald-950/50 text-emerald-400"
                : "border-slate-700 text-slate-500 hover:text-slate-300",
            )}
          >
            <SkipForward size={13} />
          </button>
        </div>
        <div style={{ width: sidebarWidth }} className="min-h-0 flex-1 shrink-0 overflow-y-auto">
          <CourseTree
            courseId={courseId}
            nodes={tree}
            activeNodeId={showCertificatePage ? null : (activeNode?.id ?? null)}
            onSelectVideo={selectVideo}
            isAdmin={user?.role === "admin"}
            progressByNode={progressByNode}
            certificateUnlocked={allCompleted}
            certificateActive={showCertificatePage}
            onSelectCertificate={() => {
              setPreviewFileNode(null);
              setShowCertificatePage(true);
            }}
            onPreviewFile={previewFile}
          />
        </div>
      </aside>
      </div>
    </div>
  );
}
