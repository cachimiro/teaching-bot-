import { describe, expect, it } from "vitest";
import { buildSystem, buildTopicBlock, pickTierDocs, TUTOR_PERSONA, type Learner, type TopicPack } from "./prompt";

const topic: TopicPack = {
  id: "B076",
  subject: "biology",
  unitName: "Ecology",
  title: "Abiotic and Biotic Factors",
  url: "/biology/ecology/abiotic-and-biotic-factors",
  boards: ["AQA", "Edexcel", "OCR"],
  notes: "## Topic overview\nAbiotic factors are non-living.",
  foundation: { worksheet: "F worksheet Q1", markscheme: "F mark scheme", worksheetUrl: null, markschemeUrl: null },
  higher: { worksheet: "H worksheet Q1", markscheme: "H mark scheme", worksheetUrl: null, markschemeUrl: null },
};

const learner: Learner = {
  displayName: "Sam",
  yearGroup: 10,
  targetGrade: "7",
  learningStyle: ["analogies", "not_a_real_style"],
  interests: "football, Minecraft",
  aboutMe: "I get nervous in exams",
  examBoard: "AQA",
  tier: "higher",
  notes: [{ kind: "struggle", note: "Mixes up abiotic and biotic", topicTitle: "Abiotic and Biotic Factors" }],
};

describe("pickTierDocs", () => {
  it("uses the student's tier when the topic has it", () => {
    expect(pickTierDocs(topic, "foundation")).toMatchObject({ tier: "foundation", fellBack: false });
  });

  it("falls back to the other tier for single-tier topics", () => {
    const higherOnly = { ...topic, foundation: null };
    expect(pickTierDocs(higherOnly, "foundation")).toMatchObject({ tier: "higher", fellBack: true });
  });
});

describe("buildTopicBlock", () => {
  it("includes the notes, and only the chosen tier's worksheet and mark scheme", () => {
    const block = buildTopicBlock(topic, "higher");
    expect(block).toContain("Abiotic factors are non-living.");
    expect(block).toContain("H worksheet Q1");
    expect(block).toContain("H mark scheme");
    expect(block).not.toContain("F worksheet");
    expect(block).toContain("https://virtusacademy.co.uk/biology/ecology/abiotic-and-biotic-factors");
  });

  it("does not depend on anything about the student (so it caches across students)", () => {
    expect(buildTopicBlock(topic, "higher")).toBe(buildTopicBlock(topic, "higher"));
  });

  it("lists sketches already drawn for the topic as ready-to-copy blocks", () => {
    const quadrat = { title: "Quadrat sampling", labels: ["Quadrat", "Tape measure"], detail: "" };
    const block = buildTopicBlock(topic, "higher", [quadrat]);
    expect(block).toContain("<drawings>");
    expect(block).toContain("```sketch\n" + JSON.stringify(quadrat) + "\n```");
    expect(buildTopicBlock(topic, "higher")).not.toContain("<drawings>");
  });
});

describe("TUTOR_PERSONA", () => {
  it("lists every ready-made diagram and offers the tutor no tools", () => {
    for (const name of ["animal-cell", "plant-cell", "heart", "leaf", "atom", "periodic-table", "particles", "wave", "circuit", "forces", "em-spectrum"]) {
      expect(TUTOR_PERSONA).toContain(`"${name}"`);
    }
    expect(TUTOR_PERSONA).toContain("there are no tools to call");
    expect(TUTOR_PERSONA).not.toMatch(/find_topics|save_learner_note/);
  });
});

describe("buildSystem", () => {
  const system = buildSystem(topic, learner, "learn", false);

  it("orders blocks persona → topic → learner and caches up to the topic pack", () => {
    expect(system).toHaveLength(3);
    expect(system[0].text).toBe(TUTOR_PERSONA);
    expect(system[0].cache_control).toBeUndefined();
    expect(system[1].text).toContain("<topic_pack>");
    expect(system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(system[2].text).toContain("<learner>");
  });

  it("describes the learner, ignoring unknown learning styles", () => {
    const text = system[2].text;
    expect(text).toContain("Sam");
    expect(text).toContain("Target grade: 7");
    expect(text).toContain("everyday analogies");
    expect(text).not.toContain("not_a_real_style");
    expect(text).toContain("[struggle] Mixes up abiotic and biotic");
    expect(text).toContain("Mode: LEARN");
    expect(text).toContain("Interests (use for examples where natural): football, Minecraft");
  });

  it("switches instructions per mode", () => {
    expect(buildSystem(topic, learner, "quiz", false)[2].text).toContain("Mode: QUIZ");
    const mock = buildSystem(topic, learner, "mock", false)[2].text;
    expect(mock).toContain("Mode: MOCK EXAM (AQA, Higher tier)");
  });

  it("adds spoken-reply rules only in voice mode", () => {
    expect(system[2].text).not.toContain("read aloud");
    const voice = buildSystem(topic, learner, "learn", true)[2].text;
    expect(voice).toContain("read aloud");
    expect(voice).toContain("Don't say the student's name");
  });

  it("warns the tutor when the tier had to fall back", () => {
    const text = buildSystem({ ...topic, higher: null }, learner, "learn", false)[2].text;
    expect(text).toContain("only has Foundation-tier material");
  });
});
