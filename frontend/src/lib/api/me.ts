import type { User } from "@lecturn/shared";
import { api } from "../apiClient";

export function updateOwnProfile(patch: { firstName?: string; lastName?: string; email?: string | null; avatarId?: number | null }) {
  return api.patch<{ user: User }>("/me", patch);
}

export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return api.patch<void>("/me/password", { currentPassword, newPassword });
}
