import type { CourseTreeNode } from "@coursedeck/shared";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { useEffect, useRef, type RefObject } from "react";
import { getProgress, postProgress } from "../../lib/api/progress";

const BEACON_INTERVAL_MS = 8000;
const COMPLETE_THRESHOLD_SECONDS = 3;

interface VideoPlayerProps {
  node: CourseTreeNode;
  videoRef: RefObject<HTMLVideoElement>;
  onProgressSaved?: () => void;
  onEnded?: () => void;
}

export function VideoPlayer({ node, videoRef, onProgressSaved, onEnded }: VideoPlayerProps) {
  const lastSavedRef = useRef(0);
  // Latest-callback ref so the effect below (keyed only on node.id) doesn't
  // need onEnded in its deps — a new function identity every render would
  // otherwise force the whole listener setup to tear down and rebuild.
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function saveProgress(completed?: boolean) {
      const el = videoRef.current;
      if (!el || !Number.isFinite(el.currentTime)) return;
      const position = el.currentTime;
      if (!completed && Math.abs(position - lastSavedRef.current) < 1) return;
      lastSavedRef.current = position;
      postProgress(node.id, position, completed).then(() => onProgressSaved?.());
    }

    async function resume() {
      const { progress } = await getProgress(node.id);
      const current = videoRef.current;
      if (cancelled || !progress || !current) return;
      const duration = current.duration;
      const remaining = Number.isFinite(duration) ? duration - progress.positionSeconds : Infinity;
      if (!progress.completed && remaining > COMPLETE_THRESHOLD_SECONDS) {
        current.currentTime = progress.positionSeconds;
      }
    }

    function handleLoadedMetadata() {
      resume();
      intervalId = setInterval(() => saveProgress(), BEACON_INTERVAL_MS);
    }

    function handlePause() {
      saveProgress();
    }

    function handleEnded() {
      saveProgress(true);
      onEndedRef.current?.();
    }

    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnded);

    // 'loadedmetadata' only fires once per load — for small/cached files it can
    // fire before this listener even attaches (worse under StrictMode's mount/
    // cleanup/remount cycle in dev), silently skipping resume. Handle that by
    // checking whether metadata is already available right now too.
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleLoadedMetadata();
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("ended", handleEnded);
      saveProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // Plyr re-skins the native <video>'s controls (speed menu, captions toggle,
  // fullscreen) without replacing the element itself, so the resume/progress/
  // notes logic above — all of which reads and writes the native
  // videoRef.current.currentTime directly — keeps working unmodified.
  //
  // Deliberately excludes "pip"/"airplay": Plyr's internal control-bar build
  // silently aborts (no error, no UI at all) in environments where those
  // features' capability checks misbehave — cheaper to drop two optional
  // buttons than chase that upstream.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const player = new Plyr(el, {
      controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "fullscreen"],
      settings: ["captions", "speed"],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
    });
    return () => player.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  return (
    <video ref={videoRef} key={node.id} controls autoPlay className="aspect-video w-full rounded-lg bg-black">
      <source src={`/api/stream/${node.id}`} />
      {(node.subtitles ?? []).map((track) => (
        <track key={track.id} kind="subtitles" label={track.label} src={`/api/stream/subtitles/${track.id}`} />
      ))}
      Your browser doesn't support video playback.
    </video>
  );
}
