import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface UseSidebarPanelOptions {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  /** CSS width/height media query the panel defaults open above (e.g. "(min-width: 768px)"). */
  breakpoint: string;
}

/** A collapsible, drag-resizable side panel: open/closed state that tracks a
 * breakpoint live (until the visitor manually toggles it, after which their
 * choice sticks regardless of viewport size), plus a resize-by-dragging
 * handle. Used by CoursePage's course-content sidebar. */
export function useSidebarPanel({ minWidth, maxWidth, defaultWidth, breakpoint }: UseSidebarPanelOptions) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.matchMedia(breakpoint).matches);
  // Tracks the breakpoint live — without this, rotating a tablet or resizing
  // the window across it mid-session leaves `open` stuck at whatever it was
  // on load. Stops auto-following once the visitor toggles it themselves.
  const userToggled = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia(breakpoint);
    function handleChange(e: MediaQueryListEvent) {
      if (!userToggled.current) setOpen(e.matches);
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [breakpoint]);

  function toggle() {
    userToggled.current = true;
    setOpen((o) => !o);
  }

  function close() {
    userToggled.current = true;
    setOpen(false);
  }

  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  // The panel sits on the right, so dragging left grows it — track the
  // pointer's movement from where the drag started rather than its absolute position.
  function handleResizeStart(e: ReactPointerEvent) {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    function onMove(ev: PointerEvent) {
      const delta = startX - ev.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, startWidth + delta)));
    }
    function onUp() {
      setIsResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { open, toggle, close, width, isResizing, handleResizeStart };
}
