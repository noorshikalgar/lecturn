import { api } from "../apiClient";

export function getNodeContent(id: string) {
  return api.get<{ content: string }>(`/nodes/${id}/content`);
}
