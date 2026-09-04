import type { CourseTreeNode } from "@lecturn/shared";
import clsx from "clsx";
import { Award, CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, Link as LinkIcon, Lock, Play } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";

interface CourseTreeProps {
  nodes: CourseTreeNode[];
  activeNodeId: string | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
  certificateUnlocked?: boolean;
  certificateActive?: boolean;
  onSelectCertificate?: () => void;
}

// Everything here stays constant across every depth of the tree — only
// `nodes`/`depth`/`node` actually change as SiblingList recurses into
// TreeNodeItem and back into SiblingList. Passing the rest through context
// instead of re-threading five identical props at every level.
interface CourseTreeContextValue {
  activeNodeId: string | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
  collapsedGroupIds: Set<string>;
  toggleGroup: (id: string) => void;
}

const CourseTreeContext = createContext<CourseTreeContextValue | null>(null);

function useCourseTreeContext(): CourseTreeContextValue {
  const ctx = useContext(CourseTreeContext);
  if (!ctx) throw new Error("CourseTree's internal components must be rendered within CourseTree");
  return ctx;
}

// The chain of ancestor group ids leading to `targetId` (root-first), or
// null if it isn't in this tree at all. Used both to decide which chapter
// should start open (whichever contains the lesson the viewer landed on)
// and to re-open a chapter autoplay/navigation lands on later.
function findAncestorGroupIds(nodes: CourseTreeNode[], targetId: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return path;
    if (n.type === "group") {
      const found = findAncestorGroupIds(n.children, targetId, [...path, n.id]);
      if (found) return found;
    }
  }
  return null;
}

export function CourseTree({
  nodes,
  activeNodeId,
  onSelectVideo,
  onPreviewFile,
  progressByNode,
  certificateUnlocked,
  certificateActive,
  onSelectCertificate,
}: CourseTreeProps) {
  const navRef = useRef<HTMLElement>(null);

  // Starts with every top-level chapter collapsed except whichever one
  // contains the active lesson — a course with a dozen chapters and notes
  // under every lesson otherwise dumps its entire contents into the sidebar
  // at once. Nested sub-groups default open (not seeded into this set), so
  // opening a chapter reveals its own sub-sections immediately.
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => {
    const activePath = activeNodeId != null ? (findAncestorGroupIds(nodes, activeNodeId) ?? []) : [];
    const activeSet = new Set(activePath);
    const collapsed = new Set<string>();
    for (const n of nodes) {
      if (n.type === "group" && !activeSet.has(n.id)) collapsed.add(n.id);
    }
    return collapsed;
  });

  // Whenever the active lesson moves into a chapter the viewer hasn't
  // opened (autoplay crossing a chapter boundary, or picking a lesson from
  // search) that chapter opens itself — but nothing else changes, so a
  // chapter the viewer opened by hand stays open.
  useEffect(() => {
    if (activeNodeId == null) return;
    const path = findAncestorGroupIds(nodes, activeNodeId);
    if (!path || path.length === 0) return;
    setCollapsedGroupIds((prev) => {
      if (!path.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      path.forEach((id) => next.delete(id));
      return next;
    });
  }, [activeNodeId, nodes]);

  function toggleGroup(id: string) {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (activeNodeId == null) return;
    const raf = requestAnimationFrame(() => {
      navRef.current?.querySelector(`[data-node-id="${activeNodeId}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CourseTreeContext.Provider value={{ activeNodeId, onSelectVideo, onPreviewFile, progressByNode, collapsedGroupIds, toggleGroup }}>
      <nav ref={navRef} className="space-y-1 text-sm">
        <SiblingList nodes={nodes} depth={0} />
        {onSelectCertificate && (
          <button
            onClick={certificateUnlocked ? onSelectCertificate : undefined}
            disabled={!certificateUnlocked}
            title={certificateUnlocked ? "Certificate" : "Watch every video to unlock the certificate"}
            className={clsx(
              "mt-3 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
              certificateActive && "bg-accent text-accent-foreground",
            )}
          >
            {certificateUnlocked ? <Award size={14} className="shrink-0" /> : <Lock size={14} className="shrink-0" />}
            <span className="min-w-0 flex-1 truncate">Certificate</span>
          </button>
        )}
      </nav>
    </CourseTreeContext.Provider>
  );
}

interface SiblingListProps {
  nodes: CourseTreeNode[];
  depth: number;
}

function SiblingList({ nodes, depth }: SiblingListProps) {
  return <div className="space-y-0.5">{nodes.map((n) => <TreeNodeItem key={n.id} node={n} depth={depth} />)}</div>;
}

interface TreeNodeItemProps {
  node: CourseTreeNode;
  depth: number;
}

function TreeNodeItem({ node, depth }: TreeNodeItemProps) {
  const { activeNodeId, onSelectVideo, onPreviewFile, progressByNode, collapsedGroupIds, toggleGroup } = useCourseTreeContext();
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
    const active = node.id === activeNodeId;
    const StatusIcon = completed ? CheckCircle2 : active ? Play : Circle;
    return (
      <div
        data-node-id={node.id}
        className={clsx(
          "flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
          active && "bg-accent",
        )}
      >
        <button
          onClick={(e) => {
            onSelectVideo(node);
            // See the same blur() on CoursePage's Previous/Next buttons —
            // a focused <button> activates on Space, and Plyr leaves space
            // alone when a button has focus, so without this, pressing
            // space to pause the video you just picked instead re-clicks
            // this row and restarts it.
            e.currentTarget.blur();
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <StatusIcon
            size={14}
            fill={active && !completed ? "currentColor" : "none"}
            className={clsx("shrink-0", completed ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground")}
          />
          <span className={clsx("min-w-0 flex-1 truncate", active && !completed ? "font-medium text-foreground" : "text-muted-foreground")}>
            {node.title}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDuration(node.video?.durationSeconds)}</span>
        </button>
      </div>
    );
  }

  // file / link
  const Icon = node.type === "link" ? LinkIcon : FileText;
  const previewable = node.type === "file" && isPreviewableFile(node.rawName);

  if (previewable) {
    const active = node.id === activeNodeId;
    return (
      <button
        onClick={() => onPreviewFile(node)}
        className={clsx(
          "flex min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
          active && "bg-accent text-accent-foreground",
        )}
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
