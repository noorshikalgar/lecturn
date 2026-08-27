import type { CourseTreeNode } from "@lecturn/shared";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Award, CheckCircle2, Circle, FileText, GripVertical, Link as LinkIcon, Lock, Pencil, Play } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { reorderNodes, updateNode } from "../../lib/api/nodes";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";

interface CourseTreeProps {
  courseId: number;
  nodes: CourseTreeNode[];
  activeNodeId: number | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  isAdmin: boolean;
  progressByNode?: Record<number, { completed: boolean }>;
  certificateUnlocked?: boolean;
  certificateActive?: boolean;
  onSelectCertificate?: () => void;
}

// Everything here stays constant across every depth of the tree — only
// `nodes`/`parentId`/`depth`/`node` actually change as SiblingList recurses
// into TreeNodeItem and back into SiblingList. Passing the rest through
// context instead of re-threading six identical props at every level.
interface CourseTreeContextValue {
  courseId: number;
  activeNodeId: number | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  isAdmin: boolean;
  progressByNode?: Record<number, { completed: boolean }>;
}

const CourseTreeContext = createContext<CourseTreeContextValue | null>(null);

function useCourseTreeContext(): CourseTreeContextValue {
  const ctx = useContext(CourseTreeContext);
  if (!ctx) throw new Error("CourseTree's internal components must be rendered within CourseTree");
  return ctx;
}

export function CourseTree({
  courseId,
  nodes,
  activeNodeId,
  onSelectVideo,
  onPreviewFile,
  isAdmin,
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
    <CourseTreeContext.Provider value={{ courseId, activeNodeId, onSelectVideo, onPreviewFile, isAdmin, progressByNode }}>
      <nav ref={navRef} className="space-y-1 text-sm">
        <SiblingList nodes={nodes} parentId={null} depth={0} />
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
  parentId: number | null;
  depth: number;
}

function SiblingList({ nodes, parentId, depth }: SiblingListProps) {
  const { courseId, isAdmin } = useCourseTreeContext();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => reorderNodes(courseId, parentId, orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["course", courseId] }),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = nodes.findIndex((n) => n.id === active.id);
    const newIndex = nodes.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(nodes, oldIndex, newIndex).map((n) => n.id);
    reorderMutation.mutate(reordered);
  }

  const items = nodes.map((n) => <TreeNodeItem key={n.id} node={n} depth={depth} />);

  const wrapper = <div className="space-y-0.5">{items}</div>;

  if (!isAdmin) return wrapper;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {wrapper}
      </SortableContext>
    </DndContext>
  );
}

interface TreeNodeItemProps {
  node: CourseTreeNode;
  depth: number;
}

function useRenameField(courseId: number, node: CourseTreeNode, isAdmin: boolean) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: (title: string) => updateNode(node.id, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["course", courseId] }),
  });

  function commitRename() {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== node.title) renameMutation.mutate(trimmed);
    else setDraftTitle(node.title);
  }

  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setDraftTitle(node.title);
      setEditing(false);
    }
  }

  function startEditing(e: { stopPropagation: () => void; preventDefault?: () => void }) {
    if (!isAdmin) return;
    e.preventDefault?.();
    e.stopPropagation();
    setEditing(true);
  }

  const field = editing ? (
    <input
      autoFocus
      value={draftTitle}
      onChange={(e) => setDraftTitle(e.target.value)}
      onBlur={commitRename}
      onKeyDown={handleTitleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 rounded border border-border bg-background px-1 text-xs text-foreground outline-none"
    />
  ) : null;

  // A keyboard-reachable equivalent to the double-click-to-rename shortcut —
  // the title itself often lives inside another element's own button/anchor
  // (selecting a video, opening a file), so it can't be made focusable on
  // its own without invalid nested-interactive-element markup.
  const renameButton = isAdmin ? (
    <button
      type="button"
      onClick={startEditing}
      title="Rename"
      aria-label={`Rename ${node.title}`}
      className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
    >
      <Pencil size={12} />
    </button>
  ) : null;

  return { editing, field, startEditing, renameButton };
}

function TreeNodeItem({ node, depth }: TreeNodeItemProps) {
  const { courseId, activeNodeId, onSelectVideo, onPreviewFile, isAdmin, progressByNode } = useCourseTreeContext();
  const { editing, field, startEditing, renameButton } = useRenameField(courseId, node, isAdmin);
  const sortable = useSortable({ id: node.id, disabled: !isAdmin });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const completed = progressByNode?.[node.id]?.completed;

  if (node.type === "group") {
    const children = node.children.length > 0 && <SiblingList nodes={node.children} parentId={node.id} depth={depth + 1} />;

    // A plain, always-expanded group header — no accordion, no collapse
    // toggle. Depth just controls indentation and visual weight, so nested
    // sub-groups read as a lighter sub-heading under their parent chapter.
    return (
      <div className={clsx(depth === 0 ? "mt-4 first:mt-0" : "mt-2.5 first:mt-0")}>
        <div className="group flex items-center gap-1.5 px-1.5 py-1">
          {isAdmin && (
            <span className="cursor-grab touch-none text-muted-foreground" {...sortable.attributes} {...sortable.listeners}>
              <GripVertical size={14} />
            </span>
          )}
          {editing ? (
            field
          ) : (
            <span
              className={clsx(
                "min-w-0 flex-1 truncate font-semibold",
                depth === 0 ? "text-[13px] text-muted-foreground" : "text-xs text-muted-foreground/80",
              )}
              onDoubleClick={startEditing}
            >
              {node.title}
            </span>
          )}
          {!editing && renameButton}
        </div>
        {children && <div className={depth === 0 ? "" : "pl-2.5"}>{children}</div>}
      </div>
    );
  }

  if (node.type === "video") {
    const active = node.id === activeNodeId;
    const StatusIcon = completed ? CheckCircle2 : active ? Play : Circle;
    return (
      <div
        ref={sortable.setNodeRef}
        style={style}
        data-node-id={node.id}
        className={clsx(
          "group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
          active && "bg-accent",
        )}
      >
        {isAdmin && (
          <button className="cursor-grab touch-none text-muted-foreground" {...sortable.attributes} {...sortable.listeners}>
            <GripVertical size={14} />
          </button>
        )}
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
          {editing ? (
            field
          ) : (
            <span
              className={clsx("min-w-0 flex-1 truncate", active && !completed ? "font-medium text-foreground" : "text-muted-foreground")}
              onDoubleClick={startEditing}
            >
              {node.title}
            </span>
          )}
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDuration(node.video?.durationSeconds)}</span>
        </button>
        {!editing && renameButton}
      </div>
    );
  }

  // file / link
  const Icon = node.type === "link" ? LinkIcon : FileText;
  const previewable = node.type === "file" && isPreviewableFile(node.rawName);

  // The grip/rename controls used to live *inside* this row's own button/anchor,
  // which meant a pointer-down on the grip to start a drag also fired the
  // row's click (opening the preview or following the href). Keeping them as
  // siblings outside the clickable element — same as the video row — avoids
  // that, and avoids nesting an interactive element inside another one.
  const grip = isAdmin ? (
    <span
      className="cursor-grab touch-none text-muted-foreground"
      aria-label={`Reorder ${node.title}`}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GripVertical size={14} />
    </span>
  ) : null;

  if (previewable) {
    const active = node.id === activeNodeId;
    return (
      <div ref={sortable.setNodeRef} style={style} className="group flex items-center gap-1.5">
        {grip}
        <button
          onClick={() => onPreviewFile(node)}
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
            active && "bg-accent text-accent-foreground",
          )}
        >
          <Icon size={14} className="shrink-0 text-muted-foreground" />
          {editing ? field : <span className="min-w-0 flex-1 truncate" onDoubleClick={startEditing}>{node.title}</span>}
        </button>
        {!editing && renameButton}
      </div>
    );
  }

  const href = node.type === "link" ? (node.targetUrl ?? undefined) : `/api/nodes/${node.id}/download`;

  return (
    <div ref={sortable.setNodeRef} style={style} className="group flex items-center gap-1.5">
      {grip}
      <a
        href={href}
        target={node.type === "link" ? "_blank" : undefined}
        rel={node.type === "link" ? "noreferrer" : undefined}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <Icon size={14} className="shrink-0 text-muted-foreground" />
        {editing ? field : <span className="min-w-0 flex-1 truncate" onDoubleClick={startEditing}>{node.title}</span>}
      </a>
      {!editing && renameButton}
    </div>
  );
}
