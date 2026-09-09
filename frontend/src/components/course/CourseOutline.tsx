import type { CourseTreeNode } from "@lecturn/shared";
import clsx from "clsx";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, FileText, Link as LinkIcon } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";

interface CourseOutlineProps {
  nodes: CourseTreeNode[];
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
}

// Read-only syllabus for the course detail page's Curriculum tab — a plain
// look at what's in the course, not the player. Deliberately its own
// component (see CourseTree for the player's sidebar): nothing here is
// "currently playing," so there's no active-row state, no autoscroll, and
// no certificate row — just chapters you can expand and lessons you can
// jump into (which navigates into the player rather than playing inline).
interface CourseOutlineContextValue {
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
  collapsedGroupIds: Set<string>;
  toggleGroup: (id: string) => void;
}

const CourseOutlineContext = createContext<CourseOutlineContextValue | null>(null);

function useCourseOutlineContext(): CourseOutlineContextValue {
  const ctx = useContext(CourseOutlineContext);
  if (!ctx) throw new Error("CourseOutline's internal components must be rendered within CourseOutline");
  return ctx;
}

export function CourseOutline({ nodes, onSelectVideo, onPreviewFile, progressByNode }: CourseOutlineProps) {
  // Every top-level chapter starts collapsed — a course with a dozen
  // chapters otherwise dumps its entire contents into the tab at once.
  // Nested sub-groups default open, so opening a chapter reveals its own
  // sub-sections immediately.
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set(nodes.filter((n) => n.type === "group").map((n) => n.id)),
  );

  function toggleGroup(id: string) {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <CourseOutlineContext.Provider value={{ onSelectVideo, onPreviewFile, progressByNode, collapsedGroupIds, toggleGroup }}>
      <div className="space-y-1 text-sm">
        <SiblingList nodes={nodes} depth={0} />
      </div>
    </CourseOutlineContext.Provider>
  );
}

function SiblingList({ nodes, depth }: { nodes: CourseTreeNode[]; depth: number }) {
  return <div className="space-y-0.5">{nodes.map((n) => <TreeNodeItem key={n.id} node={n} depth={depth} />)}</div>;
}

function TreeNodeItem({ node, depth }: { node: CourseTreeNode; depth: number }) {
  const { onSelectVideo, onPreviewFile, progressByNode, collapsedGroupIds, toggleGroup } = useCourseOutlineContext();
  const completed = progressByNode?.[node.id]?.completed;

  if (node.type === "group") {
    const collapsed = collapsedGroupIds.has(node.id);
    const Chevron = collapsed ? ChevronRight : ChevronDown;
    const children = node.children.length > 0 && <SiblingList nodes={node.children} depth={depth + 1} />;

    return (
      <div className={clsx(depth === 0 ? "mt-4 first:mt-0" : "mt-2.5 first:mt-0")}>
        <button
          onClick={() => toggleGroup(node.id)}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-accent"
        >
          <Chevron size={14} className="shrink-0 text-muted-foreground" />
          <span
            className={clsx(
              "min-w-0 flex-1 truncate font-semibold",
              depth === 0 ? "text-[13px] text-muted-foreground" : "text-xs text-muted-foreground/80",
            )}
          >
            {node.title}
          </span>
        </button>
        {/* Indented at every depth, top-level chapters included — without
            this, a chapter's own lessons rendered flush with its header,
            reading as one flat list instead of a nested tree. */}
        {children && !collapsed && <div className="pl-2.5">{children}</div>}
      </div>
    );
  }

  if (node.type === "video") {
    const StatusIcon = completed ? CheckCircle2 : Circle;
    return (
      <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
        <button onClick={() => onSelectVideo(node)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <StatusIcon size={14} className={clsx("shrink-0", completed ? "text-emerald-600" : "text-muted-foreground")} />
          <span className={clsx("min-w-0 flex-1 truncate", completed ? "text-muted-foreground" : "text-foreground")}>{node.title}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDuration(node.video?.durationSeconds)}</span>
        </button>
      </div>
    );
  }

  // file / link
  const Icon = node.type === "link" ? LinkIcon : FileText;
  const previewable = node.type === "file" && isPreviewableFile(node.rawName);

  if (previewable) {
    return (
      <button
        onClick={() => onPreviewFile(node)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <Icon size={14} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{node.title}</span>
      </button>
    );
  }

  const href = node.type === "link" ? (node.targetUrl ?? undefined) : `/api/nodes/${node.id}/download`;

  return (
    <a
      href={href}
      target={node.type === "link" ? "_blank" : undefined}
      rel={node.type === "link" ? "noreferrer" : undefined}
      className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <Icon size={14} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{node.title}</span>
    </a>
  );
}
