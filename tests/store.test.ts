import { describe, it, expect } from "vitest";
import { seedNotes, listNotes, addNote } from "../src/demo-api/store.js";

describe("note store — user isolation", () => {
  const userA = "auth0|userA";
  const userB = "auth0|userB";

  it("seeds notes for a user", () => {
    const seeded = seedNotes(userA, 3);
    expect(seeded).toHaveLength(3);
    expect(seeded[0].text).toContain("auth0|user");
  });

  it("lists only the user's own notes", () => {
    const notesA = listNotes(userA);
    const notesB = listNotes(userB);
    expect(notesA.length).toBeGreaterThan(0);
    expect(notesB).toHaveLength(0);
  });

  it("adds a note to the correct user", () => {
    const note = addNote(userB, "hello from B");
    expect(note.text).toBe("hello from B");

    const notesB = listNotes(userB);
    expect(notesB).toHaveLength(1);
    expect(notesB[0].text).toBe("hello from B");

    // userA's notes unchanged
    const notesA = listNotes(userA);
    expect(notesA.every((n) => n.text !== "hello from B")).toBe(true);
  });
});
