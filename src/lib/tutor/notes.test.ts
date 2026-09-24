import { describe, expect, it } from "vitest";
import { extractNotes, stripNotes } from "./notes";

describe("extractNotes", () => {
  it("pulls hidden learner notes out of a reply", () => {
    const reply = 'Nice work on the ratios.\n\n```note\n{"kind": "strength", "note": "Confident with ratio problems."}\n```\n';
    expect(extractNotes(reply)).toEqual({
      text: "Nice work on the ratios.",
      notes: [{ kind: "strength", note: "Confident with ratio problems." }],
    });
  });

  it("ignores notes that are malformed, of an unknown kind, or too long", () => {
    const reply = [
      "Text.",
      "```note\nnot json\n```",
      '```note\n{"kind": "secret", "note": "x"}\n```',
      `\`\`\`note\n{"kind": "goal", "note": "${"x".repeat(301)}"}\n\`\`\``,
    ].join("\n");
    expect(extractNotes(reply)).toEqual({ text: "Text.", notes: [] });
  });

  it("keeps at most two notes per reply", () => {
    const note = '```note\n{"kind": "goal", "note": "Wants a 7."}\n```';
    expect(extractNotes(`Hi.\n${note}\n${note}\n${note}`).notes).toHaveLength(2);
  });

  it("leaves a reply without notes unchanged", () => {
    expect(extractNotes("Just teaching.\n\n```steps\nx = 1 | Done.\n```")).toEqual({ text: "Just teaching.\n\n```steps\nx = 1 | Done.\n```", notes: [] });
  });
});

describe("stripNotes", () => {
  it("hides a note that is still streaming in", () => {
    expect(stripNotes('Well done.\n```note\n{"kind": "str')).toBe("Well done.");
  });
});
