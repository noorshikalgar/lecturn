import { api } from "../apiClient";

export function getNodeContent(id: number) {
  return api.get<{ content: string }>(`/nodes/${id}/content`);
}
