import type { CourseTreeNode } from "@lecturn/shared";
import clsx from "clsx";
import { Award, Link as LinkIcon, Lock, Video } from "lucide-react";
import { createContext, useContext, useEffect, useRef } from "react";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";
import { ChapterHeader, LeafRow, pickFileIcon, summarizeChapter } from "./courseTreeRows";

// The player's sidebar — unlike CourseOutline (the read-only curriculum tab
// on the course detail page), this one tracks which lesson is currently
// playing, autoscrolls to it, and offers a certificate row.
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
// instead of re-threading four identical props at every level.
interface CourseTreeContextValue {
  activeNodeId: string | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
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
      <nav ref={navRef} className="text-sm">
        <SiblingList nodes={nodes} depth={0} />
        {onSelectCertificate && (
          <button
            onClick={certificateUnlocked ? onSelectCertificate : undefined}
            disabled={!certificateUnlocked}
            title={certificateUnlocked ? "Certificate" : "Watch every video to unlock the certificate"}
            className={clsx(
              "mt-3 flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
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

function SiblingList({ nodes, depth }: { nodes: CourseTreeNode[]; depth: number }) {
  return <div>{nodes.map((n) => <TreeNodeItem key={n.id} node={n} depth={depth} />)}</div>;
}

function TreeNodeItem({ node, depth }: { node: CourseTreeNode; depth: number }) {
  const { activeNodeId, onSelectVideo, onPreviewFile, progressByNode } = useCourseTreeContext();
  const completed = progressByNode?.[node.id]?.completed;

  if (node.type === "group") {
    const { count, seconds } = summarizeChapter(node);
    const children = node.children.length > 0 && <SiblingList nodes={node.children} depth={depth + 1} />;
    return (
      <div>
        {/* A static section header, not a toggle — every chapter stays fully
            expanded. Collapsing chapters saved vertical space but cost a
            click to see what's inside, which is worse for a player sidebar
            people scan constantly while watching. */}
        <ChapterHeader title={node.title} depth={depth} count={count} seconds={seconds} />
        {children && <div className={depth === 0 ? "" : "pl-2.5"}>{children}</div>}
      </div>
    );
  }

  if (node.type === "video") {
    return (
      <LeafRow
        nodeId={node.id}
        icon={Video}
        title={node.title}
        active={node.id === activeNodeId}
        completed={completed}
        duration={formatDuration(node.video?.durationSeconds)}
        onClick={(e) => {
          onSelectVideo(node);
          // See the same blur() on CoursePage's Previous/Next buttons —
          // a focused <button> activates on Space, and Plyr leaves space
          // alone when a button has focus, so without this, pressing
          // space to pause the video you just picked instead re-clicks
          // this row and restarts it.
          e.currentTarget.blur();
        }}
      />
    );
  }

  if (node.type === "link") {
    return <LeafRow nodeId={node.id} icon={LinkIcon} title={node.title} href={node.targetUrl ?? undefined} target="_blank" completed={completed} />;
  }

  // file
  const icon = pickFileIcon(node.rawName);
  if (isPreviewableFile(node.rawName)) {
    return (
      <LeafRow
        nodeId={node.id}
        icon={icon}
        title={node.title}
        active={node.id === activeNodeId}
        completed={completed}
        onClick={() => onPreviewFile(node)}
      />
    );
  }

  return <LeafRow nodeId={node.id} icon={icon} title={node.title} href={`/api/nodes/${node.id}/download`} completed={completed} />;
}
