import { useState } from "react";
import type { CaseDetail } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Spinner } from "./States";
import { formatDateTime } from "@/lib/format";

export const NotesThread = ({
  notes,
  pending,
  onAdd,
  canWrite,
}: {
  notes: CaseDetail["notes"];
  pending?: boolean;
  onAdd: (body: string) => void | Promise<void>;
  canWrite: boolean;
}) => {
  const [body, setBody] = useState("");
  const trimmed = body.trim();

  const submit = async () => {
    if (!trimmed) return;
    await onAdd(trimmed);
    setBody("");
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {notes.length === 0 ? (
          <li className="text-sm text-muted-foreground">No notes yet.</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{note.author.name}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
            </li>
          ))
        )}
      </ol>

      {canWrite ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="note-body" className="text-sm font-medium">
            Add a note
          </label>
          <Textarea
            id="note-body"
            rows={3}
            value={body}
            maxLength={4000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What did you check? What did you find?"
          />
          <Button type="submit" size="sm" disabled={pending || trimmed.length === 0}>
            {pending ? <Spinner label="Saving…" /> : "Add note"}
          </Button>
        </form>
      ) : null}
    </div>
  );
};
