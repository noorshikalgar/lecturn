import type { CourseTreeNode } from "@lecturn/shared";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  GripVertical,
  Link as LinkIcon,
  Lock,
  PlayCircle,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { reorderNodes, updateNode } from "../../lib/api/nodes";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";

function countVideos(node: CourseTreeNode): number {
  if (node.type === "video") return 1;
  return node.children.reduce((sum, child) => sum + countVideos(child), 0);
}

function countCompletedVideos(node: CourseTreeNode, progressByNode?: Record<number, { completed: boolean }>): number {
  if (node.type === "video") return progressByNode?.[node.id]?.completed ? 1 : 0;
  return node.children.reduce((sum, child) => sum + countCompletedVideos(child, progressByNode), 0);
}

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
  return (
    <nav className="space-y-2 p-2 text-sm">
      <SiblingList
        courseId={courseId}
        nodes={nodes}
        parentId={null}
        depth={0}
        activeNodeId={activeNodeId}
        onSelectVideo={onSelectVideo}
        onPreviewFile={onPreviewFile}
        isAdmin={isAdmin}
        progressByNode={progressByNode}
      />
      {onSelectCertificate && (
        <button
          onClick={certificateUnlocked ? onSelectCertificate : undefined}
          disabled={!certificateUnlocked}
          title={certificateUnlocked ? "Certificate" : "Watch every video to unlock the certificate"}
          className={clsx(
            "flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left",
            !certificateUnlocked
              ? "cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-600"
              : certificateActive
                ? "border-accent-700 bg-accent-950/40 text-accent-300"
                : "border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-700",
          )}
        >
          {certificateUnlocked ? <Award size={14} className="shrink-0" /> : <Lock size={14} className="shrink-0" />}
          <span className="min-w-0 flex-1 truncate font-medium">Certificate</span>
        </button>
      )}
    </nav>
  );
}

interface SiblingListProps {
  courseId: number;
  nodes: CourseTreeNode[];
  parentId: number | null;
  depth: number;
  activeNodeId: number | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  isAdmin: boolean;
  progressByNode?: Record<number, { completed: boolean }>;
}

function SiblingList({ courseId, nodes, parentId, depth, activeNodeId, onSelectVideo, onPreviewFile, isAdmin, progressByNode }: SiblingListProps) {
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

  // Only top-level groups get a "CHAPTER 01" eyebrow — nested sub-groups keep
  // the plainer inline "N videos" treatment, so numbering doesn't reset or
  // duplicate at deeper nesting.
  let chapterCounter = 0;
  const items = nodes.map((n) => {
    const chapterNumber = depth === 0 && n.type === "group" ? ++chapterCounter : undefined;
    return (
      <TreeNodeItem
        key={n.id}
        courseId={courseId}
        node={n}
        depth={depth}
        chapterNumber={chapterNumber}
        activeNodeId={activeNodeId}
        onSelectVideo={onSelectVideo}
        onPreviewFile={onPreviewFile}
        isAdmin={isAdmin}
        progressByNode={progressByNode}
      />
    );
  });

  const wrapperClass = depth === 0 ? "space-y-2" : "divide-y divide-slate-800/70";

  if (!isAdmin) return <div className={wrapperClass}>{items}</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className={wrapperClass}>{items}</div>
      </SortableContext>
    </DndContext>
  );
}

interface TreeNodeItemProps {
  courseId: number;
  node: CourseTreeNode;
  depth: number;
  chapterNumber?: number;
  activeNodeId: number | null;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  isAdmin: boolean;
  progressByNode?: Record<number, { completed: boolean }>;
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

  function startEditing(e: { stopPropagation: () => void }) {
    if (!isAdmin) return;
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
      className="flex-1 rounded border border-slate-600 bg-slate-950 px-1 text-xs text-slate-100 outline-none"
    />
  ) : null;

  return { editing, field, startEditing };
}

function TreeNodeItem({
  courseId,
  node,
  depth,
  chapterNumber,
  activeNodeId,
  onSelectVideo,
  onPreviewFile,
  isAdmin,
  progressByNode,
}: TreeNodeItemProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { editing, field, startEditing } = useRenameField(courseId, node, isAdmin);
  const sortable = useSortable({ id: node.id, disabled: !isAdmin });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const completed = progressByNode?.[node.id]?.completed;

  if (node.type === "group") {
    const videoCount = countVideos(node);
    const isChapter = chapterNumber !== undefined;
    const completedInGroup = isChapter ? countCompletedVideos(node, progressByNode) : 0;
    return (
      <div
        ref={sortable.setNodeRef}
        style={style}
        className={clsx("overflow-hidden rounded-md border border-slate-800", depth === 0 ? "bg-slate-900/80" : "bg-slate-950/40")}
      >
        <div className="flex items-center gap-1.5 border-b border-slate-800 px-2.5 py-2">
          {isAdmin && (
            <button className="cursor-grab touch-none text-slate-600 hover:text-slate-400" {...sortable.attributes} {...sortable.listeners}>
              <GripVertical size={14} />
            </button>
          )}
          <button onClick={() => setCollapsed((c) => !c)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            {collapsed ? <ChevronRight size={14} className="shrink-0 text-slate-500" /> : <ChevronDown size={14} className="shrink-0 text-slate-500" />}
            <div className="min-w-0 flex-1">
              {isChapter && (
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    Chapter {String(chapterNumber).padStart(2, "0")}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-slate-500">
                    {completedInGroup} / {videoCount}
                  </span>
                </div>
              )}
              {editing ? (
                field
              ) : (
                <span
                  className={clsx("block min-w-0 truncate", isChapter ? "font-semibold text-slate-100" : "font-medium text-slate-100")}
                  onDoubleClick={startEditing}
                >
                  {node.title}
                </span>
              )}
            </div>
            {!isChapter && (
              <span className="shrink-0 text-xs text-slate-500">
                {videoCount} video{videoCount === 1 ? "" : "s"}
              </span>
            )}
          </button>
        </div>
        {!collapsed && node.children.length > 0 && (
          <div className="px-2.5">
            <SiblingList
              courseId={courseId}
              nodes={node.children}
              parentId={node.id}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              onSelectVideo={onSelectVideo}
              onPreviewFile={onPreviewFile}
              isAdmin={isAdmin}
              progressByNode={progressByNode}
            />
          </div>
        )}
      </div>
    );
  }

  if (node.type === "video") {
    const active = node.id === activeNodeId;
    const StatusIcon = completed ? CheckCircle2 : active ? PlayCircle : Circle;
    return (
      <div ref={sortable.setNodeRef} style={style} className="relative">
        {active && <span className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-accent-400" />}
        <div
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5",
            active ? "bg-accent-500/10 text-slate-50" : completed ? "text-slate-400 hover:bg-slate-900/60" : "text-slate-300 hover:bg-slate-900",
          )}
        >
          {isAdmin && (
            <button className="cursor-grab touch-none text-slate-600 hover:text-slate-400" {...sortable.attributes} {...sortable.listeners}>
              <GripVertical size={14} />
            </button>
          )}
          <button onClick={() => onSelectVideo(node)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            <StatusIcon size={14} className={clsx("shrink-0", completed ? "text-emerald-500" : active ? "text-accent-400" : "text-slate-600")} />
            {editing ? (
              field
            ) : (
              <span className="min-w-0 flex-1 truncate" onDoubleClick={startEditing}>
                {node.title}
              </span>
            )}
            <span className="shrink-0 font-mono text-[10px] text-slate-500">{formatDuration(node.video?.durationSeconds)}</span>
          </button>
        </div>
      </div>
    );
  }

  // file / link
  const Icon = node.type === "link" ? LinkIcon : FileText;
  const previewable = node.type === "file" && isPreviewableFile(node.rawName);

  const grip = isAdmin ? (
    <span className="cursor-grab touch-none text-slate-700" {...sortable.attributes} {...sortable.listeners}>
      <GripVertical size={14} />
    </span>
  ) : null;

  if (previewable) {
    const active = node.id === activeNodeId;
    return (
      <div ref={sortable.setNodeRef} style={style}>
        <button
          onClick={() => onPreviewFile(node)}
          className={clsx(
            "flex w-full items-center gap-1.5 px-3 py-1.5 text-left",
            active ? "bg-accent-500/10 text-slate-50" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
          )}
        >
          {grip}
          <Icon size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{node.title}</span>
        </button>
      </div>
    );
  }

  const href = node.type === "link" ? (node.targetUrl ?? undefined) : `/api/nodes/${node.id}/download`;

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <a
        href={href}
        target={node.type === "link" ? "_blank" : undefined}
        rel={node.type === "link" ? "noreferrer" : undefined}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
      >
        {grip}
        <Icon size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{node.title}</span>
      </a>
    </div>
  );
}
