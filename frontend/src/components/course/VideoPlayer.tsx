import type { CourseTreeNode } from "@lecturn/shared";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { getProgress, postProgress } from "../../lib/api/progress";
import { ApiError } from "../../lib/apiClient";
import { toast } from "../../lib/toast";

let sessionExpiryWarned = false;

const BEACON_INTERVAL_MS = 8000;
const COMPLETE_THRESHOLD_SECONDS = 3;
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SPEED_STORAGE_KEY = "lecturn:playbackSpeed";

function loadStoredSpeed(): number {
  try {
    const stored = Number(localStorage.getItem(SPEED_STORAGE_KEY));
    return SPEED_OPTIONS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

interface VideoPlayerProps {
  node: CourseTreeNode;
  videoRef: RefObject<HTMLVideoElement>;
  onProgressSaved?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

export function VideoPlayer({ node, videoRef, onProgressSaved, onEnded, onError }: VideoPlayerProps) {
  const lastSavedRef = useRef(0);
  // Latest-callback refs so the effect below (keyed only on node.id) doesn't
  // need onEnded/onError in its deps — a new function identity every render
  // would otherwise force the whole listener setup to tear down and rebuild.
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Plyr wraps/unwraps the <video> element with its own container divs as
  // part of its normal setup/teardown (see the Plyr-creation effect below),
  // DOM surgery that React's own reconciliation never finds out about. In
  // this dev environment that's enough to leave the shared `videoRef` object
  // pointing at a node that's still a valid JS object but no longer attached
  // to the visible document — every effect below would then be driving a
  // detached phantom element: real network requests fire, real playback
  // happens, but on a `<video>` nobody can see or hear (and audio it's
  // playing keeps going since detaching from the DOM doesn't stop a media
  // element, it just stops rendering it). wrapperRef is a plain div that
  // React fully owns and Plyr never touches, so `getLiveVideo()` can always
  // re-find the actually-connected <video> through it and self-heal
  // `videoRef.current` (shared with CoursePage/NotesPanel/etc.) if it's
  // drifted stale, rather than trusting a reference that silently rotted.
  const wrapperRef = useRef<HTMLDivElement>(null);
  function getLiveVideo(): HTMLVideoElement | null {
    const live = wrapperRef.current?.querySelector("video") ?? null;
    if (live && videoRef.current !== live) {
      (videoRef as MutableRefObject<HTMLVideoElement | null>).current = live;
    }
    return live;
  }

  useEffect(() => {
    const el = getLiveVideo();
    if (!el) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function saveProgress(completed?: boolean) {
      const el = getLiveVideo();
      if (!el || !Number.isFinite(el.currentTime)) return;
      const position = el.currentTime;
      if (!completed && Math.abs(position - lastSavedRef.current) < 1) return;
      lastSavedRef.current = position;
      postProgress(node.id, position, completed)
        .then(() => {
          sessionExpiryWarned = false;
          onProgressSaved?.();
        })
        .catch((err) => {
          // The periodic beacon fires every few seconds — a transient network
          // blip shouldn't spam a toast per tick, but an expired session means
          // every save from here on is silently failing, which is worth saying
          // once rather than letting the viewer think their spot is being kept.
          if (err instanceof ApiError && err.status === 401 && !sessionExpiryWarned) {
            sessionExpiryWarned = true;
            toast.error("Your session expired — sign in again to keep your watch progress.");
          }
        });
    }

    async function resume() {
      try {
        const { progress } = await getProgress(node.id);
        const current = getLiveVideo();
        if (cancelled || !progress || !current) return;
        const duration = current.duration;
        const remaining = Number.isFinite(duration) ? duration - progress.positionSeconds : Infinity;
        if (!progress.completed && remaining > COMPLETE_THRESHOLD_SECONDS) {
          current.currentTime = progress.positionSeconds;
        }
      } catch {
        // Best-effort — if this fails the video just starts from the
        // beginning instead of resuming; the periodic save below still runs.
      }
    }

    function handleLoadedMetadata() {
      void resume();
      intervalId = setInterval(() => saveProgress(), BEACON_INTERVAL_MS);
    }

    function handlePause() {
      saveProgress();
    }

    function handleEnded() {
      // A native "ended" event, by spec, only ever fires once currentTime has
      // actually reached the browser's own understanding of duration — that's
      // a genuine finish. (An earlier version of this also cross-checked
      // against ffprobe's separately-measured duration to catch truncated
      // files, but ffprobe and a browser's own duration reading routinely
      // disagree by a wide margin for perfectly valid files — especially
      // anything remuxed — so that check was a false-positive machine: it
      // fired on ordinary videos and silently killed autoplay/completion for
      // them, which is a far worse outcome than the rare truncated file it
      // was meant to catch.)
      saveProgress(true);
      onEndedRef.current?.();
    }

    function handleError() {
      onErrorRef.current?.();
    }

    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnded);
    el.addEventListener("error", handleError);

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
      el.removeEventListener("error", handleError);
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
    const el = getLiveVideo();
    if (!el) return;
    const player = new Plyr(el, {
      controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "fullscreen"],
      settings: ["captions", "speed"],
      speed: { selected: loadStoredSpeed(), options: SPEED_OPTIONS },
      // Plyr's keyboard shortcuts default to "focused" — space only
      // toggles play/pause if the player itself already has DOM focus.
      // Nothing on this page ever focuses it (clicking a sidebar lesson,
      // the most common way playback starts, focuses that button instead),
      // so space fell through to the browser's native behavior: scroll the
      // page down. "global" listens on the whole document instead — Plyr
      // still ignores it while a real input/textarea is focused, so typing
      // a note or renaming a lesson is unaffected.
      keyboard: { global: true },
    });
    // Persisted across lessons — without this, speed silently resets to 1x
    // every time a new video loads, which is the opposite of what picking a
    // speed once should mean for someone binging a course.
    function handleRateChange() {
      try {
        localStorage.setItem(SPEED_STORAGE_KEY, String(getLiveVideo()?.playbackRate ?? 1));
      } catch {
        // ignore — private browsing or storage disabled
      }
    }
    el.addEventListener("ratechange", handleRateChange);
    return () => {
      el.removeEventListener("ratechange", handleRateChange);
      player.destroy();
    };
  }, [videoRef]);

  // Deliberately sets el.src directly (an imperative DOM write) rather than
  // rendering a <source> child through JSX: Plyr manages captions as well as
  // playback, which means it can relocate or remove <track>/<source>
  // elements as part of its own setup/teardown — DOM surgery React's
  // reconciliation never finds out about. If React ever also owns a child of
  // <video> (a <source>, a <track>), the two can end up disagreeing about
  // where that child actually lives, and the next time React tries to
  // update or remove it: "Failed to execute 'removeChild' on 'Node': The
  // node to be removed is not a child of this node" — a real, page-crashing
  // error, not just a cosmetic glitch. <video> below has zero JSX children
  // for exactly this reason: nothing inside it is ever React-managed, so
  // React never attempts to touch a node Plyr might have already moved.
  useEffect(() => {
    const el = getLiveVideo();
    if (!el) return;
    el.src = `/api/stream/${node.id}`;
    el.load();
    el.play().catch(() => {});
  }, [node.id, videoRef]);

  // Tracks are managed the same imperative way, for the same reason — see
  // the effect above. Rebuilt from scratch on every change rather than
  // diffed, since this only runs on an actual lesson change (not every
  // render) and the list is small.
  useEffect(() => {
    const el = getLiveVideo();
    if (!el) return;
    el.querySelectorAll("track").forEach((t) => t.remove());
    for (const sub of node.subtitles ?? []) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = sub.label;
      track.src = `/api/stream/subtitles/${sub.id}`;
      el.appendChild(track);
    }
  }, [node.id, node.subtitles, videoRef]);

  return (
    // wrapperRef never has JSX children of its own beyond this one <video> —
    // see getLiveVideo() above for why that matters: it lets us always find
    // the actually-connected video element regardless of what Plyr's done to
    // it or its immediate DOM neighbors.
    <div ref={wrapperRef}>
      {/* playsInline (+ the raw webkit- attribute for older iOS) keeps
          playback inline under Plyr's own controls on iPhone — without it,
          Safari always hands video to its OS-level native fullscreen player
          instead. No JSX children here — see the effects above. */}
      <video ref={videoRef} controls playsInline webkit-playsinline="true" className="aspect-video w-full rounded-lg bg-black">
        Your browser doesn't support video playback.
      </video>
    </div>
  );
}
