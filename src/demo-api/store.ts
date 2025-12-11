export type Note = { id: string; text: string; createdAt: number };

const notesBySub = new Map<string, Note[]>();

export function seedNotes(sub: string, count = 3) {
  const now = Date.now();
  const existing = notesBySub.get(sub) ?? [];
  const seeded: Note[] = Array.from({ length: count }).map((_, i) => ({
    id: `note_${now}_${i}`,
    text: `Hello ${sub.slice(0, 10)}… (#${i + 1})`,
    createdAt: now + i,
  }));
  const next = [...seeded, ...existing];
  notesBySub.set(sub, next);
  return seeded;
}

export function listNotes(sub: string) {
  return notesBySub.get(sub) ?? [];
}

export function addNote(sub: string, text: string) {
  const now = Date.now();
  const note: Note = { id: `note_${now}`, text, createdAt: now };
  const next = [note, ...(notesBySub.get(sub) ?? [])];
  notesBySub.set(sub, next);
  return note;
}
