import type { ActivityFeed, ActivityType } from "@lecturn/shared";
import { api } from "../apiClient";

export function getActivity(params: { cursor?: string; type?: ActivityType } = {}) {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.type) query.set("type", params.type);
  const qs = query.toString();
  return api.get<ActivityFeed>(`/activity${qs ? `?${qs}` : ""}`);
}
