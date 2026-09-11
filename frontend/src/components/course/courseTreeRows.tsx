import type { CourseTreeNode } from "@lecturn/shared";
import clsx from "clsx";
import { CheckCircle2, FileCode, FileText, type LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { formatDuration } from "../../lib/formatDuration";
import { getPreviewKind } from "../../lib/previewableFile";

// Shared visual building blocks for a course's tree of chapters/lessons —
// used by both CourseTree (the player's sidebar: has an active lesson,
// autoscrolls to it, offers a certificate row) and CourseOutline (the
// read-only curriculum tab on the course detail page: none of that, it's
// just a syllabus to look at and click into). Splitting the two keeps a
// player-only concern like "which row is currently playing" from leaking
// into a page that never plays anything inline.

/** Total video count + runtime under a chapter, including whatever's nested
 * inside its own sub-groups — a section header reports the whole chapter's
 * size, not just what's directly one level down. */
export function summarizeChapter(node: CourseTreeNode): { count: number; seconds: number } {
  let count = 0;
  let seconds = 0;
  for (const child of node.children) {
    if (child.type === "video") {
      count += 1;
      seconds += child.video?.durationSeconds ?? 0;
    } else if (child.type === "group") {
      const nested = summarizeChapter(child);
      count += nested.count;
      seconds += nested.seconds;
    }
  }
  return { count, seconds };
}

/** A non-video file's icon by what it actually is, not just "a file". */
export function pickFileIcon(rawName: string): LucideIcon {
  return getPreviewKind(rawName) === "html" ? FileCode : FileText;
}

export function ChapterHeader({ title, depth, count, seconds }: { title: string; depth: number; count: number; seconds: number }) {
  return (
    <div className={clsx("border-b border-border bg-muted px-3 py-2", depth === 0 ? "mt-3 first:mt-0" : "mt-1.5 first:mt-0")}>
      <p className={clsx("truncate font-semibold text-foreground", depth === 0 ? "text-[13px]" : "text-xs")}>{title}</p>
      {count > 0 && (
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {count} lecture{count === 1 ? "" : "s"} · {formatDuration(seconds)}
        </p>
      )}
    </div>
  );
}

interface LeafRowProps {
  nodeId: string;
  icon: LucideIcon;
  title: string;
  active?: boolean;
  completed?: boolean;
  duration?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  target?: string;
}

// Every lesson/file/link renders through this one shape: a type icon, the
// title (truncated with a native tooltip on overflow), a green check when
// watched — no icon at all otherwise, rather than an empty placeholder —
// and a second row for duration when the item actually has one.
export function LeafRow({ nodeId, icon: Icon, title, active, completed, duration, onClick, href, target }: LeafRowProps) {
  const content = (
    <>
      <span className="flex items-center gap-2">
        <Icon size={14} className={clsx("shrink-0", active ? "text-primary" : "text-muted-foreground")} />
        <span title={title} className={clsx("min-w-0 flex-1 truncate", active ? "font-medium text-foreground" : "text-foreground/90")}>
          {title}
        </span>
        {completed && <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />}
      </span>
      {duration && <span className="mt-0.5 block pl-[22px] font-mono text-[11px] text-muted-foreground">{duration}</span>}
    </>
  );

  const className = clsx("block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground", active && "bg-accent");

  if (href) {
    return (
      <a data-node-id={nodeId} href={href} target={target} rel={target ? "noreferrer" : undefined} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button data-node-id={nodeId} onClick={onClick} className={className}>
      {content}
    </button>
  );
}
