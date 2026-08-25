import { createNoteSchema, updateNoteSchema } from "@coursedeck/shared";
import { Router, type Request } from "express";
import { validateBody } from "../middleware/validateBody.js";
import { ApiHttpError } from "../middleware/errorHandler.js";
import { createNote, deleteNote, getNoteById, listNotesForVideo, updateNote } from "../db/repositories/notesRepo.js";

export const notesRouter = Router();

notesRouter.get("/video/:videoNodeId", (req, res) => {
  res.json({ notes: listNotesForVideo(req.user!.id, Number(req.params.videoNodeId)) });
});

notesRouter.post("/", validateBody(createNoteSchema), (req, res) => {
  const { videoNodeId, timestampSeconds, body } = req.body;
  const note = createNote(req.user!.id, videoNodeId, timestampSeconds ?? null, body);
  res.status(201).json({ note });
});

function requireOwnNote(req: Request) {
  const note = getNoteById(Number(req.params.id));
  if (!note || note.userId !== req.user!.id) return undefined;
  return note;
}

notesRouter.patch("/:id", validateBody(updateNoteSchema), (req, res, next) => {
  const note = requireOwnNote(req);
  if (!note) {
    next(new ApiHttpError(404, "not_found", "Note not found"));
    return;
  }
  updateNote(note.id, req.body);
  res.json({ note: getNoteById(note.id) });
});

notesRouter.delete("/:id", (req, res, next) => {
  const note = requireOwnNote(req);
  if (!note) {
    next(new ApiHttpError(404, "not_found", "Note not found"));
    return;
  }
  deleteNote(note.id);
  res.status(204).end();
});
