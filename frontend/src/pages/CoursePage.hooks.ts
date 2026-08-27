import type { CourseTreeNode } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { markCourseComplete } from "../lib/api/certificates";
import { getCourse } from "../lib/api/courses";
import { getCourseProgress } from "../lib/api/progress";
import { findChapter, findFirstVideo, findNodeById, flattenVideos } from "../lib/courseTree";
import { formatDuration } from "../lib/formatDuration";
import { toast } from "../lib/toast";

export type TabKey = "notes" | "resources";

// If several autoplayed videos in a row fail to load, the library almost
// certainly has a real problem (a bad path, a batch of corrupted files) —
// better to stop and say so than to silently burn through the whole course.
const MAX_CONSECUTIVE_AUTO_SKIPS = 3;

/** All data-fetching, derived state, and player actions for CoursePage,
 * pulled out of the component so its own body can stay focused on layout. */
export function useCoursePlayer(courseId: number) {
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
  const [autoplayNext, setAutoplayNext] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Counts autoplay-triggered advances that happened because the previous
  // video failed to load, not because it actually finished — reset to 0 by
  // any manual pick or any video that genuinely plays through.
  const autoSkipAttemptsRef = useRef(0);

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
  // Counting progress rows directly (rather than intersecting with allVideos)
  // would include rows for nodes a rescan has since removed, letting stale
  // progress data prematurely mark the course complete and unlock the
  // certificate.
  const completedCount = allVideos.filter((v) => progressByNode[v.id]?.completed).length;
  const allCompleted = allVideos.length > 0 && completedCount >= allVideos.length;
  // The most recent completed watch — a reasonable stand-in for "when this
  // learner personally finished the course," since there's no single
  // per-user completion timestamp stored anywhere.
  const completedAtForUser =
    progressData?.items.filter((p) => p.completed).sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))[0]
      ?.lastWatchedAt ?? null;

  // Auto-mark the course complete once every video has been watched — no
  // manual "mark complete" button; the certificate page unlocks itself.
  useEffect(() => {
    if (allCompleted && data && !data.course.completedAt) {
      completeMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted, data?.course.completedAt]);

  // Shared by every path that actually loads a video into the player —
  // manual sidebar clicks, autoplay-to-next, and error-triggered auto-skip.
  function playNode(node: CourseTreeNode) {
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

  function selectVideo(node: CourseTreeNode) {
    // A deliberate pick always clears the auto-skip guard — the visitor is
    // back in control, so a fresh run of load failures should get its own
    // full budget of silent skips rather than inheriting a used-up one.
    autoSkipAttemptsRef.current = 0;
    playNode(node);
  }

  function previewFile(node: CourseTreeNode) {
    setShowCertificatePage(false);
    setPreviewFileNode(node);
  }

  function openCertificate() {
    setPreviewFileNode(null);
    setShowCertificatePage(true);
  }

  function closePreview() {
    setPreviewFileNode(null);
  }

  // Skips over any videos flagged missing on disk — autoplaying, or a manual
  // Previous/Next click, into one would just hand the player a 404.
  function findNextPlayable(afterNodeId: number): CourseTreeNode | undefined {
    const index = allVideos.findIndex((v) => v.id === afterNodeId);
    if (index === -1) return undefined;
    for (let i = index + 1; i < allVideos.length; i++) {
      if (!allVideos[i].missing) return allVideos[i];
    }
    return undefined;
  }

  function findPrevPlayable(beforeNodeId: number): CourseTreeNode | undefined {
    const index = allVideos.findIndex((v) => v.id === beforeNodeId);
    if (index === -1) return undefined;
    for (let i = index - 1; i >= 0; i--) {
      if (!allVideos[i].missing) return allVideos[i];
    }
    return undefined;
  }

  // Called only for a genuine finish — VideoPlayer itself filters out a
  // native "ended" event that fired suspiciously early (a truncated or
  // corrupted file), so getting here means the video actually played through.
  function handleVideoEnded() {
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
    autoSkipAttemptsRef.current = 0;
    if (!autoplayNext || !activeNode) return;
    const next = findNextPlayable(activeNode.id);
    if (next) playNode(next);
  }

  // The current video failed to load or play at all (missing file, decode
  // error, bad stream). Say so either way; only autoplay past it — and only
  // up to MAX_CONSECUTIVE_AUTO_SKIPS in a row — if autoplay is actually on.
  // Without this cap, a library with several bad files back to back would
  // otherwise silently blow through the rest of the course in an instant.
  function handleVideoError() {
    if (!activeNode) return;
    toast.error(`Couldn't play "${activeNode.title}" — the file may be missing or corrupted.`);
    if (!autoplayNext) return;
    if (autoSkipAttemptsRef.current >= MAX_CONSECUTIVE_AUTO_SKIPS) {
      toast.error("Several videos in a row failed to play — stopping autoplay so you can check the library.");
      return;
    }
    const next = findNextPlayable(activeNode.id);
    if (next) {
      autoSkipAttemptsRef.current += 1;
      playNode(next);
    }
  }

  function refreshProgress() {
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
  }

  const previewing = previewFileNode && !showCertificatePage;
  // Distinct from `activeNode` (the video actually loaded in the player):
  // this is whichever row the sidebar should highlight — the previewed
  // file, the playing video, or nothing while the certificate page is up.
  const treeActiveNodeId = showCertificatePage ? null : previewing ? previewFileNode.id : (activeNode?.id ?? null);

  const activeVideoIndex = activeNode ? allVideos.findIndex((v) => v.id === activeNode.id) : -1;
  const lessonNumber = activeVideoIndex >= 0 ? activeVideoIndex + 1 : null;
  const prevVideo = activeNode ? findPrevPlayable(activeNode.id) : undefined;
  const nextVideo = activeNode ? findNextPlayable(activeNode.id) : undefined;
  const chapter = activeNode ? findChapter(tree, activeNode.id) : undefined;
  const progressPct = allVideos.length > 0 ? Math.round((completedCount / allVideos.length) * 100) : 0;
  const chapterCount = tree.filter((n) => n.type === "group").length;
  const totalDurationSeconds = allVideos.reduce((sum, v) => sum + (v.video?.durationSeconds ?? 0), 0);
  const contentSummary =
    allVideos.length > 0
      ? `${chapterCount > 0 ? `${chapterCount} chapters · ` : ""}${allVideos.length} lessons · ${formatDuration(totalDurationSeconds)}`
      : null;

  return {
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
  };
}
