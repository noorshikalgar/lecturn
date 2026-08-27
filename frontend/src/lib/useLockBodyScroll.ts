import { useEffect } from "react";

/** Prevents the page behind a modal from scrolling while it's open — without
 * this, touch-dragging inside a fixed-position overlay on mobile scrolls the
 * page underneath instead. */
export function useLockBodyScroll() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}
