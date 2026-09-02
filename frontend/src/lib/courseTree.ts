import type { CourseTreeNode } from "@lecturn/shared";

function flattenByType(nodes: CourseTreeNode[], types: ReadonlySet<CourseTreeNode["type"]>): CourseTreeNode[] {
  const result: CourseTreeNode[] = [];
  for (const node of nodes) {
    if (types.has(node.type)) result.push(node);
    if (node.children.length > 0) result.push(...flattenByType(node.children, types));
  }
  return result;
}

const VIDEO_TYPES = new Set<CourseTreeNode["type"]>(["video"]);
const RESOURCE_TYPES = new Set<CourseTreeNode["type"]>(["file", "link"]);

export function flattenVideos(nodes: CourseTreeNode[]): CourseTreeNode[] {
  return flattenByType(nodes, VIDEO_TYPES);
}

export function flattenResources(nodes: CourseTreeNode[]): CourseTreeNode[] {
  return flattenByType(nodes, RESOURCE_TYPES);
}

export function findNodeById(nodes: CourseTreeNode[], id: string): CourseTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findFirstVideo(nodes: CourseTreeNode[]): CourseTreeNode | undefined {
  for (const node of nodes) {
    if (node.type === "video") return node;
    if (node.children.length > 0) {
      const found = findFirstVideo(node.children);
      if (found) return found;
    }
  }
  return undefined;
}

function containsId(node: CourseTreeNode, id: string): boolean {
  if (node.id === id) return true;
  return node.children.some((c) => containsId(c, id));
}

/** The top-level chapter (group node) containing the given node id, if any. */
export function findChapter(tree: CourseTreeNode[], activeId: string): CourseTreeNode | undefined {
  return tree.find((n) => n.type === "group" && containsId(n, activeId));
}

/** id -> title/orderIndex for every node (groups included), used to resolve
 * a note's chapter name and to keep chapters in curriculum order. */
export function flattenAll(nodes: CourseTreeNode[], map: Map<string, { title: string; orderIndex: number }>) {
  for (const node of nodes) {
    map.set(node.id, { title: node.title, orderIndex: node.orderIndex });
    if (node.children.length > 0) flattenAll(node.children, map);
  }
}
