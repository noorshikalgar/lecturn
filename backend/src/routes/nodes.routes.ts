import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { reorderNodesSchema, updateNodeSchema } from "@lecturn/shared";
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { getNodeById, isValidParent, listChildren, reorderSiblings, updateNodeOrder, updateNodeTitle } from "../db/repositories/nodesRepo.js";
import { resolveNodeAbsolutePath } from "../media/resolvePath.js";
import { canUserAccessNode } from "../services/sectionVisibility.js";

export const nodesRouter = Router();

const PREVIEWABLE_TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".log", ".html", ".htm"]);
const PREVIEWABLE_INLINE_EXTENSIONS = new Set([".pdf"]);
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

nodesRouter.get("/:id/download", (req, res, next) => {
  const node = getNodeById(Number(req.params.id));
  if (!node || node.type !== "file") {
    next(new ApiHttpError(404, "not_found", "File not found"));
    return;
  }
  if (!canUserAccessNode(req.user!, node.id)) {
    next(new ApiHttpError(404, "not_found", "File not found"));
    return;
  }
  const absPath = resolveNodeAbsolutePath(node.courseId, node.relativePath);
  if (!absPath || !existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "File missing on disk"));
    return;
  }
  res.download(absPath, node.rawName);
});

// Inline text preview for small, obviously-text files (txt/md/csv/log) — the
// download route always forces a save-file prompt, which isn't useful when
// someone just wants to read a quick notes.txt without leaving the app.
nodesRouter.get("/:id/content", async (req, res, next) => {
  const node = getNodeById(Number(req.params.id));
  if (!node || node.type !== "file") {
    next(new ApiHttpError(404, "not_found", "File not found"));
    return;
  }
  if (!canUserAccessNode(req.user!, node.id)) {
    next(new ApiHttpError(404, "not_found", "File not found"));
    return;
  }
  if (!PREVIEWABLE_TEXT_EXTENSIONS.has(extname(node.rawName).toLowerCase())) {
    next(new ApiHttpError(415, "not_previewable", "This file type can't be previewed — download it instead"));
    return;
  }
  const absPath = resolveNodeAbsolutePath(node.courseId, node.relativePath);
  if (!absPath || !existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "File missing on disk"));
    return;
  }
  try {
    const stats = await stat(absPath);
    if (stats.size > MAX_PREVIEW_BYTES) {
      next(new ApiHttpError(413, "too_large", "This file is too large to preview — download it instead"));
      return;
    }
    res.json({ content: await readFile(absPath, "utf-8") });
  } catch (err) {
    next(err);
  }
});

// Serves the file for in-browser rendering (a PDF embedded in an iframe)
// rather than forcing a save-file prompt — the browser's own PDF viewer
// handles the rest, no client-side PDF library needed.
nodesRouter.get("/:id/inline", (req, res, next) => {
  const node = getNodeById(Number(req.params.id));
  if (!node || node.type !== "file") {
    next(new ApiHttpError(404, "not_found", "File not found"));
    return;
  }
  if (!canUserAccessNode(req.user!, node.id)) {
    next(new ApiHttpError(404, "not_found", "File not found"));
    return;
  }
  if (!PREVIEWABLE_INLINE_EXTENSIONS.has(extname(node.rawName).toLowerCase())) {
    next(new ApiHttpError(415, "not_previewable", "This file type can't be previewed inline — download it instead"));
    return;
  }
  const absPath = resolveNodeAbsolutePath(node.courseId, node.relativePath);
  if (!absPath || !existsSync(absPath)) {
    next(new ApiHttpError(404, "not_found", "File missing on disk"));
    return;
  }
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(node.rawName)}"`);
  res.sendFile(absPath, (err) => {
    if (err) next(err);
  });
});

nodesRouter.patch("/:id", requireAdmin, validateBody(updateNodeSchema), (req, res, next) => {
  const id = Number(req.params.id);
  const node = getNodeById(id);
  if (!node) {
    next(new ApiHttpError(404, "not_found", "Node not found"));
    return;
  }
  const { title, orderIndex, parentId } = req.body;
  if (parentId !== undefined && !isValidParent(node.courseId, parentId, id)) {
    next(new ApiHttpError(400, "invalid_parent", "parentId must be an existing group node in the same course"));
    return;
  }
  if (title !== undefined) updateNodeTitle(id, title);
  if (orderIndex !== undefined) updateNodeOrder(id, orderIndex, parentId);
  res.json({ node: getNodeById(id) });
});

nodesRouter.post("/reorder", requireAdmin, validateBody(reorderNodesSchema), (req, res, next) => {
  const { courseId, parentId, orderedNodeIds } = req.body;
  const siblings = listChildren(courseId, parentId);
  const siblingIds = new Set(siblings.map((n) => n.id));
  const validSet = new Set(orderedNodeIds);
  const sameSet = siblingIds.size === validSet.size && [...siblingIds].every((id) => validSet.has(id));
  if (!sameSet) {
    next(new ApiHttpError(400, "invalid_order", "orderedNodeIds must exactly match the current siblings"));
    return;
  }
  reorderSiblings(courseId, parentId, orderedNodeIds);
  res.json({ nodes: listChildren(courseId, parentId) });
});
