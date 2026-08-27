import { randomBytes } from "node:crypto";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createSession, deleteSession, deleteSessionsForUser, getSession } from "../db/repositories/sessionsRepo.js";
import {
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

function toPublicUser(row: { id: number; username: string; role: UserRole; createdAt: string }) {
  return { id: row.id, username: row.username, role: row.role, createdAt: row.createdAt };
}

function createUserRecord(username: string, password: string, role: UserRole) {
  if (getUserByUsername(username)) {
    throw new ApiHttpError(409, "username_taken", "That username is already in use");
  }
  if (password.length < 8) {
    throw new ApiHttpError(400, "weak_password", "Password must be at least 8 characters");
  }
  const { hash, salt } = hashPassword(password);
  return createUserRow({ username, passwordHash: hash, passwordSalt: salt, role });
}

export function createUser(username: string, password: string, role: UserRole) {
  return toPublicUser(createUserRecord(username, password, role));
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
  deleteSession(token);
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

export function resetPassword(userId: number, newPassword: string) {
  if (newPassword.length < 8) {
    throw new ApiHttpError(400, "weak_password", "Password must be at least 8 characters");
  }
  const { hash, salt } = hashPassword(newPassword);
  updateUserPassword(userId, hash, salt);
  deleteSessionsForUser(userId);
}

export function updateUserRole(userId: number, role: UserRole) {
  if (!getUserById(userId)) throw new ApiHttpError(404, "not_found", "User not found");
  updateUserRow(userId, { role });
  return toPublicUser(getUserById(userId)!);
}

export function deleteUser(userId: number, requestingUserId: number) {
  if (userId === requestingUserId) {
    throw new ApiHttpError(400, "cannot_delete_self", "You can't delete your own account");
  }
  if (!getUserById(userId)) throw new ApiHttpError(404, "not_found", "User not found");
  deleteUserRow(userId);
}
