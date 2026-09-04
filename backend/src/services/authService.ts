import { randomBytes } from "node:crypto";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createSession, endSession, endSessionsForUser, getSession } from "../db/repositories/sessionsRepo.js";
import {
  countAdmins,
  countUsers,
  createUser as createUserRow,
  deleteUser as deleteUserRow,
  getUserByUsername,
  getUserById,
  listUsers,
  updateUser as updateUserRow,
  updateUserPassword,
  type UserRole,
} from "../db/repositories/usersRepo.js";
import { hashPassword, needsRehash, verifyPassword } from "../utils/password.js";

export const SESSION_COOKIE_NAME = "lecturn_session";

interface UserRow {
  id: string;
  username: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarId: number | null;
  createdAt: string;
}

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    avatarId: row.avatarId,
    createdAt: row.createdAt,
  };
}

function createUserRecord(
  username: string,
  password: string,
  role: UserRole,
  profile?: { firstName?: string | null; lastName?: string | null; email?: string | null; avatarId?: number | null },
) {
  if (getUserByUsername(username)) {
    throw new ApiHttpError(409, "username_taken", "That username is already in use");
  }
  if (password.length < 8) {
    throw new ApiHttpError(400, "weak_password", "Password must be at least 8 characters");
  }
  const { hash, salt } = hashPassword(password);
  return createUserRow({
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    email: profile?.email ?? null,
    avatarId: profile?.avatarId ?? null,
  });
}

export function createUser(
  username: string,
  password: string,
  role: UserRole,
  profile?: { firstName?: string | null; lastName?: string | null; email?: string | null; avatarId?: number | null },
) {
  return toPublicUser(createUserRecord(username, password, role, profile));
}

export function bootstrapAdminUser(defaultUsername: string, defaultPassword: string) {
  if (countUsers() > 0) return undefined;
  return createUserRecord(defaultUsername, defaultPassword, "admin");
}

export function login(username: string, password: string) {
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new ApiHttpError(401, "invalid_credentials", "Incorrect username or password");
  }
  // Opportunistic upgrade — a user's hash only ever gets stronger by
  // actually logging in with the correct password, never by a background
  // job touching hashes it can't verify.
  if (needsRehash(user.passwordHash)) {
    const { hash, salt } = hashPassword(password);
    updateUserPassword(user.id, hash, salt);
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = createSession(token, user.id);
  return { token, expiresAt, user: toPublicUser(user) };
}

export function logout(token: string) {
  endSession(token);
}

export function getUserForToken(token: string) {
  const session = getSession(token);
  if (!session) return undefined;
  const user = getUserById(session.userId);
  if (!user) return undefined;
  return toPublicUser(user);
}

export function listAllUsers() {
  return listUsers().map(toPublicUser);
}

// For call sites that just need a target's username for an activity-log
// message before mutating/deleting the row — not meant as a general lookup.
export function getUsername(userId: string): string | undefined {
  return getUserById(userId)?.username;
}

export function resetPassword(userId: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new ApiHttpError(400, "weak_password", "Password must be at least 8 characters");
  }
  const { hash, salt } = hashPassword(newPassword);
  updateUserPassword(userId, hash, salt);
  endSessionsForUser(userId);
}

export function updateUserRole(userId: string, role: UserRole) {
  const user = getUserById(userId);
  if (!user) throw new ApiHttpError(404, "not_found", "User not found");
  // A site with zero admins can't be administered back into a working state
  // by anyone — the last admin can only be demoted once a second admin
  // exists to do it, same as the last admin can only be deleted by another.
  if (user.role === "admin" && role !== "admin" && countAdmins() <= 1) {
    throw new ApiHttpError(400, "last_admin", "At least one admin account is required — promote another user first");
  }
  updateUserRow(userId, { role });
  return toPublicUser(getUserById(userId)!);
}

// Shared by both the self-service profile route and the admin edit-another-
// user route — username is never in this patch (it's the one field the
// product decision keeps immutable) and role changes go through
// updateUserRole instead, so admin-only authorization stays enforced by
// which route calls this, not by anything checked in here.
export function updateProfile(
  userId: string,
  patch: { firstName?: string | null; lastName?: string | null; email?: string | null; avatarId?: number | null },
) {
  if (!getUserById(userId)) throw new ApiHttpError(404, "not_found", "User not found");
  updateUserRow(userId, patch);
  return toPublicUser(getUserById(userId)!);
}

// Self-service password change — unlike admin's resetPassword, this
// requires proving you already know the current password, since it's
// reachable by anyone with a live session rather than gated behind
// requireAdmin.
export function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = getUserById(userId);
  if (!user) throw new ApiHttpError(404, "not_found", "User not found");
  if (!verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)) {
    throw new ApiHttpError(401, "invalid_credentials", "Current password is incorrect");
  }
  if (newPassword.length < 8) {
    throw new ApiHttpError(400, "weak_password", "Password must be at least 8 characters");
  }
  const { hash, salt } = hashPassword(newPassword);
  updateUserPassword(userId, hash, salt);
  endSessionsForUser(userId);
}

export function deleteUser(userId: string, requestingUserId: string) {
  if (userId === requestingUserId) {
    throw new ApiHttpError(400, "cannot_delete_self", "You can't delete your own account");
  }
  const user = getUserById(userId);
  if (!user) throw new ApiHttpError(404, "not_found", "User not found");
  // Deleting the last admin would leave the site with no one able to
  // administer it back into a working state — a second admin has to exist
  // to remove the first, same restriction updateUserRole applies to demotion.
  if (user.role === "admin" && countAdmins() <= 1) {
    throw new ApiHttpError(400, "last_admin", "At least one admin account is required — promote another user first");
  }
  deleteUserRow(userId);
}
