import type { CourseTreeNode } from "@lecturn/shared";
import clsx from "clsx";
import { Award, CheckCircle2, Circle, FileText, Link as LinkIcon, Lock, Play } from "lucide-react";
import { createContext, useContext, useEffect, useRef } from "react";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";

interface CourseTreeProps {
  nodes: CourseTreeNode[];
  activeNodeId: number | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<number, { completed: boolean }>;
  certificateUnlocked?: boolean;
  certificateActive?: boolean;
  onSelectCertificate?: () => void;
}

// Everything here stays constant across every depth of the tree — only
// `nodes`/`depth`/`node` actually change as SiblingList recurses into
// TreeNodeItem and back into SiblingList. Passing the rest through context
// instead of re-threading four identical props at every level.
interface CourseTreeContextValue {
  activeNodeId: number | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<number, { completed: boolean }>;
}

const CourseTreeContext = createContext<CourseTreeContextValue | null>(null);

function useCourseTreeContext(): CourseTreeContextValue {
  const ctx = useContext(CourseTreeContext);
  if (!ctx) throw new Error("CourseTree's internal components must be rendered within CourseTree");
  return ctx;
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

  useEffect(() => {
    if (activeNodeId == null) return;
    const raf = requestAnimationFrame(() => {
      navRef.current?.querySelector(`[data-node-id="${activeNodeId}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CourseTreeContext.Provider value={{ activeNodeId, onSelectVideo, onPreviewFile, progressByNode }}>
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
  const { activeNodeId, onSelectVideo, onPreviewFile, progressByNode } = useCourseTreeContext();
  const completed = progressByNode?.[node.id]?.completed;

  if (node.type === "group") {
    const children = node.children.length > 0 && <SiblingList nodes={node.children} depth={depth + 1} />;

    // A plain, always-expanded group header — no accordion, no collapse
    // toggle. Depth just controls indentation and visual weight, so nested
    // sub-groups read as a lighter sub-heading under their parent chapter.
    return (
      <div className={clsx(depth === 0 ? "mt-4 first:mt-0" : "mt-2.5 first:mt-0")}>
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          <span
            className={clsx(
              "min-w-0 flex-1 truncate font-semibold",
              depth === 0 ? "text-[13px] text-muted-foreground" : "text-xs text-muted-foreground/80",
            )}
          >
            {node.title}
          </span>
        </div>
        {/* Indented at every depth, top-level chapters included — without
            this, a chapter's own lessons rendered flush with its header,
            reading as one flat list instead of a nested tree. */}
        {children && <div className="pl-2.5">{children}</div>}
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
