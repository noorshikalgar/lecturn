import type { Note } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Clock, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { ConfirmDialog } from "../ConfirmDialog";
import { createNote, deleteNote, getNotesForVideo } from "../../lib/api/notes";
import { formatTimestampToken, splitBodyIntoSegments } from "../../lib/timestampTokens";

interface NotesPanelProps {
  videoNodeId: string;
  videoRef: RefObject<HTMLVideoElement>;
}

function NoteBody({ body, onSeek }: { body: string; onSeek: (seconds: number) => void }) {
  const segments = splitBodyIntoSegments(body);
  return (
    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
      {segments.map((seg, i) =>
        seg.type === "timestamp" && seg.seconds !== undefined ? (
          <button
            key={i}
            onClick={() => onSeek(seg.seconds!)}
            className="mx-0.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-sky-600 hover:bg-muted"
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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
    mutationFn: (id: string) => deleteNote(id),
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
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={insertTimestamp}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <Clock size={13} />
            Insert timestamp
          </button>
          <button
            type="submit"
            disabled={!draft.trim() || createMutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet for this video.</p>}
        {notes.map((note) => (
          <div key={note.id} className={clsx("group rounded-md border border-border bg-card/60 p-3")}>
            <div className="mb-1 flex items-center justify-between">
              {note.timestampSeconds !== null ? (
                <button
                  onClick={() => seekTo(note.timestampSeconds!)}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  {formatTimestampToken(note.timestampSeconds).slice(1)}
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setPendingDeleteId(note.id)}
                aria-label="Delete note"
                className="text-muted-foreground opacity-0 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <NoteBody body={note.body} onSeek={seekTo} />
          </div>
        ))}
      </div>

      {pendingDeleteId !== null && (
        <ConfirmDialog
          title="Delete note"
          message="Delete this note? This can't be undone."
          confirmLabel="Delete"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            deleteMutation.mutate(pendingDeleteId);
            setPendingDeleteId(null);
          }}
        />
      )}
    </div>
  );
}
