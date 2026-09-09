import type { CourseTreeNode } from "@lecturn/shared";
import { Link as LinkIcon, Video } from "lucide-react";
import { formatDuration } from "../../lib/formatDuration";
import { isPreviewableFile } from "../../lib/previewableFile";
import { ChapterHeader, LeafRow, pickFileIcon, summarizeChapter } from "./courseTreeRows";

interface CourseOutlineProps {
  nodes: CourseTreeNode[];
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
}

/** Read-only syllabus for the course detail page's Curriculum tab — a plain
 * look at what's in the course, not the player. Nothing here is "currently
 * playing," so unlike CourseTree there's no active-row state to track and
 * nothing to autoscroll to; picking a video just navigates into the player,
 * it doesn't play inline. */
export function CourseOutline({ nodes, onSelectVideo, onPreviewFile, progressByNode }: CourseOutlineProps) {
  return (
    <div className="text-sm">
      <OutlineSiblingList nodes={nodes} depth={0} onSelectVideo={onSelectVideo} onPreviewFile={onPreviewFile} progressByNode={progressByNode} />
    </div>
  );
}

interface OutlineSiblingListProps {
  nodes: CourseTreeNode[];
  depth: number;
  onSelectVideo: (node: CourseTreeNode) => void;
  onPreviewFile: (node: CourseTreeNode) => void;
  progressByNode?: Record<string, { completed: boolean }>;
}

function OutlineSiblingList({ nodes, depth, onSelectVideo, onPreviewFile, progressByNode }: OutlineSiblingListProps) {
  return (
    <div>
      {nodes.map((node) => {
        const completed = progressByNode?.[node.id]?.completed;

        if (node.type === "group") {
          const { count, seconds } = summarizeChapter(node);
          return (
            <div key={node.id}>
              <ChapterHeader title={node.title} depth={depth} count={count} seconds={seconds} />
              {node.children.length > 0 && (
                <div className={depth === 0 ? "" : "pl-2.5"}>
                  <OutlineSiblingList
                    nodes={node.children}
                    depth={depth + 1}
                    onSelectVideo={onSelectVideo}
                    onPreviewFile={onPreviewFile}
                    progressByNode={progressByNode}
                  />
                </div>
              )}
            </div>
          );
        }

        if (node.type === "video") {
          return (
            <LeafRow
              key={node.id}
              nodeId={node.id}
              icon={Video}
              title={node.title}
              completed={completed}
              duration={formatDuration(node.video?.durationSeconds)}
              onClick={() => onSelectVideo(node)}
            />
          );
        }

        if (node.type === "link") {
          return <LeafRow key={node.id} nodeId={node.id} icon={LinkIcon} title={node.title} href={node.targetUrl ?? undefined} target="_blank" completed={completed} />;
        }

        // file
        const icon = pickFileIcon(node.rawName);
        if (isPreviewableFile(node.rawName)) {
          return <LeafRow key={node.id} nodeId={node.id} icon={icon} title={node.title} completed={completed} onClick={() => onPreviewFile(node)} />;
        }
        return <LeafRow key={node.id} nodeId={node.id} icon={icon} title={node.title} href={`/api/nodes/${node.id}/download`} completed={completed} />;
      })}
    </div>
  );
}
