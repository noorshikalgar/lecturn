import type { CourseNode } from "@coursedeck/shared";
import { api } from "../apiClient";

export function updateNode(id: number, patch: { title?: string; orderIndex?: number; parentId?: number | null }) {
  return api.patch<{ node: CourseNode }>(`/nodes/${id}`, patch);
}

export function reorderNodes(courseId: number, parentId: number | null, orderedNodeIds: number[]) {
  return api.post<{ nodes: CourseNode[] }>("/nodes/reorder", { courseId, parentId, orderedNodeIds });
}

export function getNodeContent(id: number) {
  return api.get<{ content: string }>(`/nodes/${id}/content`);
}
