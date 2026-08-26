import type { CourseTreeNode } from "@lecturn/shared";
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
  //
  // Created once and kept alive across video changes ([] deps, not
  // [node.id]) — the <video> element itself has no `key` below, so it's the
  // same DOM node for the life of the page, not a fresh one per video.
  // Destroying and recreating Plyr on every node change used to race React's
  // own unmount of the (then key'd) <video> element: Plyr's destroy() does
  // its own DOM surgery on the element, and if React is unmounting that same
  // subtree in the same tick (autoplay-next → node.id changes → key changes
  // → full remount), whichever runs second finds a node that's already been
  // moved out from under it — "Node.removeChild: The node to be removed is
  // not a child of this node". Keeping one stable element and one stable
  // Plyr instance removes the race entirely.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const player = new Plyr(el, {
      controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "fullscreen"],
      settings: ["captions", "speed"],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
    });
    return () => player.destroy();
  }, [videoRef]);

  // <source src> changing doesn't make the browser pick it up on its own —
  // needs an explicit load() to start fetching the new video, same as
  // switching sources on a plain <video> without any player library
  // involved. autoPlay is a static attribute so it only fires on the
  // element's first load; drive playback explicitly after each load instead.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.load();
    el.play().catch(() => {});
  }, [node.id, videoRef]);

  return (
    // playsInline (+ the raw webkit- attribute for older iOS) keeps playback
    // inline under Plyr's own controls on iPhone — without it, Safari always
    // hands video to its OS-level native fullscreen player instead, which
    // doesn't reliably pick up the load()+play() src swap below when
    // autoplay-next or a manual video-select changes the source.
    <video ref={videoRef} controls playsInline webkit-playsinline="true" className="aspect-video w-full rounded-lg bg-black">
      <source src={`/api/stream/${node.id}`} />
      {(node.subtitles ?? []).map((track) => (
        <track key={track.id} kind="subtitles" label={track.label} src={`/api/stream/subtitles/${track.id}`} />
      ))}
      Your browser doesn't support video playback.
    </video>
  );
}
