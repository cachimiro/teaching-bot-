import { z } from "zod";

/**
 * The tutor remembers things about a student by writing a hidden ```note block in its reply.
 * The student never sees or hears it; the server saves it after the turn. (This replaced a
 * save-note tool: tool calls part-way through a reply made the tutor drop its pictures.)
 */

const Note = z.object({
  kind: z.enum(["strength", "struggle", "misconception", "preference", "goal"]),
  note: z.string().trim().min(1).max(300),
});
export type LearnerNote = z.infer<typeof Note>;

const NOTE_BLOCK = /```note[^\n]*\n([\s\S]*?)(?:```|$)/g;
const MAX_NOTES_PER_REPLY = 2;

/** Removes note blocks (including one still streaming in) from text shown or spoken to the student. */
export function stripNotes(text: string): string {
  return text.replace(NOTE_BLOCK, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractNotes(text: string): { text: string; notes: LearnerNote[] } {
  const notes: LearnerNote[] = [];
  for (const [, body] of text.matchAll(NOTE_BLOCK)) {
    try {
      const parsed = Note.safeParse(JSON.parse(body));
      if (parsed.success && notes.length < MAX_NOTES_PER_REPLY) notes.push(parsed.data);
    } catch {}
  }
  return { text: notes.length || NOTE_BLOCK.test(text) ? stripNotes(text) : text, notes };
}
