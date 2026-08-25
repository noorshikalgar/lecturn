import type { Note } from "@coursedeck/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Clock, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { createNote, deleteNote, getNotesForVideo } from "../../lib/api/notes";
import { formatTimestampToken, splitBodyIntoSegments } from "../../lib/timestampTokens";

interface NotesPanelProps {
  videoNodeId: number;
  videoRef: RefObject<HTMLVideoElement>;
}

function NoteBody({ body, onSeek }: { body: string; onSeek: (seconds: number) => void }) {
  const segments = splitBodyIntoSegments(body);
  return (
    <p className="whitespace-pre-wrap text-sm text-slate-300">
      {segments.map((seg, i) =>
        seg.type === "timestamp" && seg.seconds !== undefined ? (
          <button
            key={i}
            onClick={() => onSeek(seg.seconds!)}
            className="mx-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-sky-300 hover:bg-slate-700"
          >
            {seg.value}
          </button>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </p>
  );
}

export function NotesPanel({ videoNodeId, videoRef }: NotesPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryKey = ["notes", videoNodeId];

  const { data } = useQuery({ queryKey, queryFn: () => getNotesForVideo(videoNodeId) });

  const createMutation = useMutation({
    mutationFn: (body: string) => {
      const timestampSeconds = videoRef.current && Number.isFinite(videoRef.current.currentTime) ? videoRef.current.currentTime : null;
      return createNote(videoNodeId, timestampSeconds, body);
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed) createMutation.mutate(trimmed);
  }

  function insertTimestamp() {
    const videoEl = videoRef.current;
    if (!videoEl || !Number.isFinite(videoEl.currentTime)) return;
    const token = formatTimestampToken(videoEl.currentTime);
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(end);
    const insertion = `${before.length > 0 && !before.endsWith(" ") ? " " : ""}${token} `;
    const newValue = `${before}${insertion}${after}`;
    // flushSync forces the textarea's DOM value to update synchronously —
    // without it, setSelectionRange below would run against the stale value
    // (setDraft's re-render hasn't committed yet) and clamp to the wrong spot.
    flushSync(() => setDraft(newValue));
    const newCursor = before.length + insertion.length;
    textarea?.focus();
    textarea?.setSelectionRange(newCursor, newCursor);
  }

  function seekTo(seconds: number) {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = seconds;
    el.play();
  }

  const notes: Note[] = data?.notes ?? [];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note… use the clock button to drop in the current timestamp"
          rows={3}
          className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={insertTimestamp}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Clock size={13} />
            Insert timestamp
          </button>
          <button
            type="submit"
            disabled={!draft.trim() || createMutation.isPending}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet for this video.</p>}
        {notes.map((note) => (
          <div key={note.id} className={clsx("group rounded-md border border-slate-800 bg-slate-900/60 p-3")}>
            <div className="mb-1 flex items-center justify-between">
              {note.timestampSeconds !== null ? (
                <button
                  onClick={() => seekTo(note.timestampSeconds!)}
                  className="text-xs font-medium text-sky-400 hover:underline"
                >
                  {formatTimestampToken(note.timestampSeconds).slice(1)}
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => deleteMutation.mutate(note.id)}
                className="text-slate-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <NoteBody body={note.body} onSeek={seekTo} />
          </div>
        ))}
      </div>
    </div>
  );
}
