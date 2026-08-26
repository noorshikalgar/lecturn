import type { CourseTreeNode } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CertificatePage } from "../components/course/CertificatePage";
import { CourseTree } from "../components/course/CourseTree";
import { FilePreviewPane } from "../components/course/FilePreviewPane";
import { NotesPanel } from "../components/course/NotesPanel";
import { ResourcesPanel } from "../components/course/ResourcesPanel";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { markCourseComplete } from "../lib/api/certificates";
import { getCourse } from "../lib/api/courses";
import { getCourseProgress } from "../lib/api/progress";
import { useAuth } from "../lib/AuthContext";
import { formatDuration } from "../lib/formatDuration";

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

function containsId(node: CourseTreeNode, id: number): boolean {
  if (node.id === id) return true;
  return node.children.some((c) => containsId(c, id));
}

function findChapter(tree: CourseTreeNode[], activeId: number): CourseTreeNode | undefined {
  return tree.find((n) => n.type === "group" && containsId(n, activeId));
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
  // Closed by default on a narrow screen — the mobile drawer is a fullscreen
  // overlay, so defaulting it open would immediately cover the video on
  // first load instead of showing what the visitor actually came to watch.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
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
    // Mobile Safari only allows a media element to keep playing without a
    // fresh tap if `play()` runs inside the tap's own call stack. The actual
    // src swap happens later in VideoPlayer's effect (after this state
    // update re-renders), which by then is outside that window — priming
    // play() here, synchronously, on the tap itself keeps the element
    // "unlocked" so the effect's subsequent load()+play() isn't silently
    // blocked once it does run.
    videoRef.current?.play().catch(() => {});
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
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading course…</div>;
  }

  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Course not found.</div>;
  }

  const previewing = previewFileNode && !showCertificatePage;
  const treeActiveNodeId = showCertificatePage ? null : previewing ? previewFileNode.id : (activeNode?.id ?? null);

  const activeVideoIndex = activeNode ? allVideos.findIndex((v) => v.id === activeNode.id) : -1;
  const lessonNumber = activeVideoIndex >= 0 ? activeVideoIndex + 1 : null;
  const prevVideo = activeVideoIndex > 0 ? allVideos[activeVideoIndex - 1] : undefined;
  const nextVideo = activeVideoIndex >= 0 ? allVideos[activeVideoIndex + 1] : undefined;
  const chapter = activeNode ? findChapter(tree, activeNode.id) : undefined;
  const progressPct = allVideos.length > 0 ? Math.round((completedCount / allVideos.length) * 100) : 0;
  const chapterCount = tree.filter((n) => n.type === "group").length;
  const totalDurationSeconds = allVideos.reduce((sum, v) => sum + (v.video?.durationSeconds ?? 0), 0);
  const contentSummary =
    allVideos.length > 0
      ? `${chapterCount > 0 ? `${chapterCount} chapters · ` : ""}${allVideos.length} lessons · ${formatDuration(totalDurationSeconds)}`
      : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/90 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={`/courses/${courseId}`}
            title="Back to course details"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">{data.course.title}</h1>
            {data.course.description && (
              <p className="truncate text-xs text-muted-foreground">{data.course.description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {allVideos.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex" title={`${completedCount} of ${allVideos.length} lessons watched`}>
              <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {completedCount} / {allVideos.length}
              </span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            title={sidebarOpen ? "Hide course content" : "Show course content"}
            className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={clsx("min-w-0 flex-1", previewing ? "overflow-hidden" : "overflow-y-auto")}>
          {previewing ? (
            <FilePreviewPane node={previewFileNode} onClose={() => setPreviewFileNode(null)} />
          ) : (
            <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
              {showCertificatePage ? (
              <CertificatePage course={data.course} />
            ) : (
              <>
                {activeNode ? (
                  <div className="relative">
                    {lessonNumber !== null && (
                      <span className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Lesson {String(lessonNumber).padStart(2, "0")}
                      </span>
                    )}
                    <VideoPlayer
                      node={activeNode}
                      videoRef={videoRef}
                      onEnded={handleVideoEnded}
                      onProgressSaved={() => queryClient.invalidateQueries({ queryKey: progressQueryKey })}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-card text-sm text-muted-foreground">
                    This course has no videos yet.
                  </div>
                )}
                <div>
                  {activeNode?.type === "video" && (
                    <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
                      {chapter ? `${chapter.title} · ` : ""}Lesson {lessonNumber}
                    </p>
                  )}
                  {activeNode?.type === "video" && (
                    <p className="mt-1 text-lg font-semibold text-foreground">{activeNode.title}</p>
                  )}
                  {data.course.description && <p className="mt-2 text-sm text-muted-foreground">{data.course.description}</p>}
                </div>

                {activeNode?.type === "video" && (prevVideo || nextVideo) && (
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <button
                      onClick={() => prevVideo && selectVideo(prevVideo)}
                      disabled={!prevVideo}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-card disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft size={15} /> Previous
                    </button>
                    <button
                      onClick={() => nextVideo && selectVideo(nextVideo)}
                      disabled={!nextVideo}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-card disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Next lesson <ChevronRight size={15} />
                    </button>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <div className="mb-3 flex gap-1 border-b border-border">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={clsx(
                          "px-3 py-2 text-sm font-medium transition",
                          tab === t.key
                            ? "border-b-2 border-foreground text-foreground"
                            : "text-muted-foreground hover:text-muted-foreground",
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
                      <p className="text-sm text-muted-foreground">Select a video to take notes on it.</p>
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
          className="hidden w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-muted active:bg-muted-foreground md:block"
        />
      )}

      {/* Desktop: resizable inline panel, hidden entirely on mobile — the
          drag-resize interaction and fixed-px width make no sense on a
          narrow screen, so mobile gets its own fullscreen drawer below
          instead of a squeezed-down version of this. */}
      <aside
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        className={clsx(
          "hidden shrink-0 flex-col overflow-hidden border-border bg-card/50 md:flex",
          !isResizing && "transition-[width,opacity] duration-300 ease-in-out",
          sidebarOpen ? "border-l opacity-100" : "border-l-0 opacity-0",
        )}
      >
        <div style={{ width: sidebarWidth }} className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground">Course Content</span>
            {contentSummary && <p className="mt-0.5 text-xs text-muted-foreground">{contentSummary}</p>}
          </div>
          <Label className="gap-1.5 text-xs text-muted-foreground">
            Autoplay
            <Switch size="sm" checked={autoplayNext} onCheckedChange={setAutoplayNext} />
          </Label>
        </div>
        <div style={{ width: sidebarWidth }} className="min-h-0 flex-1 shrink-0 overflow-y-auto">
          <CourseTree
            courseId={courseId}
            nodes={tree}
            activeNodeId={treeActiveNodeId}
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

      {/* Mobile: fullscreen drawer instead of a squeezed side panel. */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background md:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground">Course Content</span>
              {contentSummary && <p className="mt-0.5 text-xs text-muted-foreground">{contentSummary}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Label className="gap-1.5 text-xs text-muted-foreground">
                Autoplay
                <Switch size="sm" checked={autoplayNext} onCheckedChange={setAutoplayNext} />
              </Label>
              <button
                onClick={() => setSidebarOpen(false)}
                title="Close"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CourseTree
              courseId={courseId}
              nodes={tree}
              activeNodeId={treeActiveNodeId}
              onSelectVideo={(n) => {
                selectVideo(n);
                setSidebarOpen(false);
              }}
              isAdmin={user?.role === "admin"}
              progressByNode={progressByNode}
              certificateUnlocked={allCompleted}
              certificateActive={showCertificatePage}
              onSelectCertificate={() => {
                setPreviewFileNode(null);
                setShowCertificatePage(true);
                setSidebarOpen(false);
              }}
              onPreviewFile={(n) => {
                previewFile(n);
                setSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
