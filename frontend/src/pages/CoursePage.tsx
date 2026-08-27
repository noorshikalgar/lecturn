import clsx from "clsx";
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CertificatePage } from "../components/course/CertificatePage";
import { CourseTree } from "../components/course/CourseTree";
import { FilePreviewPane } from "../components/course/FilePreviewPane";
import { NotesPanel } from "../components/course/NotesPanel";
import { ResourcesPanel } from "../components/course/ResourcesPanel";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { useSidebarPanel } from "../lib/useSidebarPanel";
import { useCoursePlayer, type TabKey } from "./CoursePage.hooks";

const TABS: { key: TabKey; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "resources", label: "Resources" },
];

const SIDEBAR_MIN_WIDTH = 288;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 320;

function CourseContentHeader({
  contentSummary,
  autoplayNext,
  onAutoplayChange,
  onClose,
}: {
  contentSummary: string | null;
  autoplayNext: boolean;
  onAutoplayChange: (v: boolean) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
      <div className="min-w-0">
        <span className="text-sm font-semibold text-foreground">Course Content</span>
        {contentSummary && <p className="mt-0.5 text-xs text-muted-foreground">{contentSummary}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Label className="gap-1.5 text-xs text-muted-foreground">
          Autoplay
          <Switch size="sm" checked={autoplayNext} onCheckedChange={onAutoplayChange} />
        </Label>
        {onClose && (
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close course content"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);

  const sidebar = useSidebarPanel({
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    breakpoint: "(min-width: 768px)",
  });

  const player = useCoursePlayer(courseId);
  const {
    data,
    isLoading,
    tree,
    activeNode,
    allVideos,
    progressByNode,
    completedCount,
    allCompleted,
    completedAtForUser,
    videoRef,
    tab,
    setTab,
    autoplayNext,
    setAutoplayNext,
    showCertificatePage,
    previewFileNode,
    previewing,
    treeActiveNodeId,
    lessonNumber,
    prevVideo,
    nextVideo,
    chapter,
    progressPct,
    contentSummary,
    selectVideo,
    previewFile,
    openCertificate,
    closePreview,
    handleVideoEnded,
    handleVideoError,
    refreshProgress,
  } = player;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading course…</div>;
  }

  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Course not found.</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
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
            {data.course.description && <p className="truncate text-xs text-muted-foreground">{data.course.description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {allVideos.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex" title={`${completedCount} of ${allVideos.length} lessons watched`}>
              <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className={clsx("h-full rounded-full transition-all", allCompleted ? "bg-emerald-600" : "bg-primary")}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {completedCount} / {allVideos.length}
              </span>
            </div>
          )}
          <button
            onClick={sidebar.toggle}
            title={sidebar.open ? "Hide course content" : "Show course content"}
            aria-label={sidebar.open ? "Hide course content" : "Show course content"}
            className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {sidebar.open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={clsx("min-w-0 flex-1", previewing ? "overflow-hidden" : "overflow-y-auto")}>
          {previewFileNode && !showCertificatePage ? (
            <FilePreviewPane node={previewFileNode} onClose={closePreview} />
          ) : (
            <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
              {showCertificatePage ? (
                <CertificatePage course={data.course} completedAt={completedAtForUser} />
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
                        onError={handleVideoError}
                        onProgressSaved={refreshProgress}
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-lg bg-card text-sm text-muted-foreground">
                      This course has no videos yet.
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {activeNode?.type === "video" && (
                        <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
                          {chapter ? `${chapter.title} · ` : ""}Lesson {lessonNumber}
                        </p>
                      )}
                      {activeNode?.type === "video" && (
                        <p className="mt-1 truncate text-lg font-semibold text-foreground">{activeNode.title}</p>
                      )}
                    </div>
                    {activeNode?.type === "video" && (prevVideo || nextVideo) && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            if (prevVideo) selectVideo(prevVideo);
                            // A focused <button> activates on Space by native
                            // browser behavior — and Plyr's own keyboard
                            // handler deliberately leaves space alone when a
                            // button has focus, so it doesn't fight that.
                            // Without this blur, space (meant to pause the
                            // video you're now watching) instead re-clicks
                            // whichever nav button you last used.
                            e.currentTarget.blur();
                          }}
                          disabled={!prevVideo}
                          title="Previous lesson"
                          aria-label="Previous lesson"
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-card disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            if (nextVideo) selectVideo(nextVideo);
                            e.currentTarget.blur();
                          }}
                          disabled={!nextVideo}
                          title="Next lesson"
                          aria-label="Next lesson"
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-card disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {data.course.description && <p className="text-sm text-muted-foreground">{data.course.description}</p>}

                  <div className="border-t border-border pt-4">
                    <div className="mb-3 flex gap-1 border-b border-border">
                      {TABS.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setTab(t.key)}
                          className={clsx(
                            "px-3 py-2 text-sm font-medium transition",
                            tab === t.key ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground hover:text-muted-foreground",
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

        {sidebar.open && (
          <div
            onPointerDown={sidebar.handleResizeStart}
            title="Drag to resize"
            className="hidden w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-muted active:bg-muted-foreground md:block"
          />
        )}

        {/* Desktop: resizable inline panel, hidden entirely on mobile — the
            drag-resize interaction and fixed-px width make no sense on a
            narrow screen, so mobile gets its own fullscreen drawer below
            instead of a squeezed-down version of this. */}
        <aside
          style={{ width: sidebar.open ? sidebar.width : 0 }}
          className={clsx(
            "hidden shrink-0 flex-col overflow-hidden border-border bg-card/50 md:flex",
            !sidebar.isResizing && "transition-[width,opacity] duration-300 ease-in-out",
            sidebar.open ? "border-l opacity-100" : "border-l-0 opacity-0",
          )}
        >
          <div style={{ width: sidebar.width }}>
            <CourseContentHeader contentSummary={contentSummary} autoplayNext={autoplayNext} onAutoplayChange={setAutoplayNext} />
          </div>
          <div style={{ width: sidebar.width }} className="min-h-0 flex-1 shrink-0 overflow-y-auto">
            <CourseTree
              nodes={tree}
              activeNodeId={treeActiveNodeId}
              onSelectVideo={selectVideo}
              progressByNode={progressByNode}
              certificateUnlocked={allCompleted}
              certificateActive={showCertificatePage}
              onSelectCertificate={openCertificate}
              onPreviewFile={previewFile}
            />
          </div>
        </aside>
      </div>

      {/* Mobile: fullscreen drawer instead of a squeezed side panel. */}
      {sidebar.open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background md:hidden">
          <CourseContentHeader
            contentSummary={contentSummary}
            autoplayNext={autoplayNext}
            onAutoplayChange={setAutoplayNext}
            onClose={sidebar.close}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CourseTree
              nodes={tree}
              activeNodeId={treeActiveNodeId}
              onSelectVideo={(n) => {
                selectVideo(n);
                sidebar.close();
              }}
              progressByNode={progressByNode}
              certificateUnlocked={allCompleted}
              certificateActive={showCertificatePage}
              onSelectCertificate={() => {
                openCertificate();
                sidebar.close();
              }}
              onPreviewFile={(n) => {
                previewFile(n);
                sidebar.close();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
