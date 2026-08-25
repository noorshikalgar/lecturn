import type { ReactNode } from "react";

/** Standard centered, scrollable page body — everything except CoursePage,
 * which needs the full-bleed fixed-height shell instead. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </div>
  );
}
