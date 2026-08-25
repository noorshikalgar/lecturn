import type { CourseTreeNode } from "@lecturn/shared";
import { listNodesForCourse } from "../db/repositories/nodesRepo.js";
import { getVideoMeta } from "../db/repositories/videoMetaRepo.js";
import { listSubtitleTracks } from "../db/repositories/subtitleTracksRepo.js";

export function getCourseTree(courseId: number): CourseTreeNode[] {
  const flat = listNodesForCourse(courseId);
  const byId = new Map<number, CourseTreeNode>();
  for (const node of flat) {
    const treeNode: CourseTreeNode = { ...node, children: [] };
    if (node.type === "video") {
      treeNode.video = getVideoMeta(node.id);
      treeNode.subtitles = listSubtitleTracks(node.id);
    }
    byId.set(node.id, treeNode);
  }

  const roots: CourseTreeNode[] = [];
  for (const node of flat) {
    const treeNode = byId.get(node.id)!;
    if (node.parentId === null) {
      roots.push(treeNode);
    } else {
      byId.get(node.parentId)?.children.push(treeNode);
    }
  }
  return roots;
}
