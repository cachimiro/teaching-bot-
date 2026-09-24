/**
 * Runs scripted student conversations through the tutor (real Claude API, ~20p per run)
 * and writes the transcripts to data/evals/<label>.md for review.
 * Usage: npx tsx scripts/eval-tutor.mts <label> [scenarioId...]
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem, type Learner, type Mode } from "../src/lib/tutor/prompt";
import { assistantTexts, runTutorTurn } from "../src/lib/tutor/turn";
import { claudeCostUsd, usdToCredits } from "../src/lib/credits/pricing";
import type { TopicContent } from "../src/lib/content/types";
import { fenceBareDiagrams } from "../src/lib/tutor/diagrams";
import katex from "katex";
import { parseGraphSpec } from "../src/lib/maths/graph";
import { latestLessonStage, parseActivity, parseLessonStage } from "../src/lib/tutor/activities";
import { diagramBlockJson, parseDiagramSpec } from "../src/lib/diagrams/spec";
import { parseSketchJson } from "../src/lib/sketch/spec";
import { looksLikeMaths, parseSteps, speechPlan } from "../src/lib/voice/speech-plan";

type Scenario = {
  id: string;
  what: string;
  topic: string;
  mode: Mode;
  learner: Partial<Learner>;
  turns: string[];
  voice?: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    id: "maths-explain-differently",
    what: "Visual learner stuck on the quadratic formula, asks for a different explanation",
    topic: "H129",
    mode: "learn",
    learner: { tier: "higher", learningStyle: ["visual"], targetGrade: "6" },
    turns: [
      "I don't get the quadratic formula at all",
      "I still don't understand. Can you explain it a different way?",
      "ok so what are a, b and c?",
    ],
  },
  {
    id: "bio-misconception",
    what: "Short-and-direct learner with a classic osmosis misconception",
    topic: "B011",
    mode: "learn",
    learner: { tier: "foundation", learningStyle: ["short_direct"], targetGrade: "5" },
    turns: ["what is osmosis", "so water moves from where there's less water to where there's more water?"],
  },
  {
    id: "chem-wants-answers",
    what: "Student asks for homework answers",
    topic: "C057",
    mode: "learn",
    learner: { tier: "higher", targetGrade: "7" },
    turns: ["just give me the answer to question 1 on the worksheet, I need to hand it in tomorrow"],
  },
  {
    id: "physics-gamer",
    what: "Tech-minded student who dislikes physics",
    topic: "P056",
    mode: "learn",
    learner: { tier: "foundation", interests: "gaming, coding", aboutMe: "I hate physics.", targetGrade: "5" },
    turns: ["why should I even care about acceleration", "i dont understand what m/s² means"],
  },
  {
    id: "cs-simple",
    what: "Asks for a very simple explanation",
    topic: "CS002",
    mode: "learn",
    learner: { tier: "foundation", yearGroup: 9 },
    turns: ["explain abstraction like I'm 10"],
  },
  {
    id: "stats-mock",
    what: "Mock exam: starts, then gives a partly correct answer",
    topic: "S041",
    mode: "mock",
    learner: { tier: "foundation", targetGrade: "5" },
    turns: ["start my mock exam", "I added up all the numbers and divided by how many rows there are"],
  },
  {
    id: "french-lost",
    what: "Lost student in French",
    topic: "FR042",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["idk what the perfect tense even is"],
  },
  {
    id: "maths-still-stuck",
    what: "Keeps saying they are stuck, then asks to be shown; checks escalation and name repetition",
    topic: "H129",
    mode: "learn",
    learner: { tier: "higher" },
    turns: [
      "I don't get the quadratic formula",
      "no I still don't get it",
      "still confused tbh",
      "can you just show me how to do x² + 5x + 6 = 0",
    ],
  },
  {
    id: "maths-diagram",
    what: "Visual learner asks to see it: should draw the parabola crossing the x-axis",
    topic: "H129",
    mode: "learn",
    learner: { tier: "higher", learningStyle: ["visual"] },
    turns: ["what does the answer to a quadratic actually mean? can you show me on a graph"],
  },
  {
    id: "bio-diagram",
    what: "Process topic: should draw a flowchart",
    topic: "B011",
    mode: "learn",
    learner: { tier: "foundation", learningStyle: ["visual"] },
    turns: ["can you draw what happens to a plant cell in pure water vs salty water"],
  },
  {
    id: "maths-board-formula",
    what: "Asks to be shown the quadratic formula: expects a working-out board",
    topic: "H129",
    mode: "learn",
    learner: { tier: "higher" },
    turns: ["show me how to solve x^2 - 3x - 10 = 0 with the formula", "ok give me one to try"],
  },
  {
    id: "maths-graph-sliders",
    what: "Explores what c does: expects a graph with sliders",
    topic: "H121",
    mode: "learn",
    learner: { tier: "higher", learningStyle: ["visual"] },
    turns: ["I don't get what changing c does to a quadratic, can you show me?"],
  },
  {
    id: "maths-board-completing-square",
    what: "Completing the square, which students find hard: expects a board",
    topic: "H130",
    mode: "learn",
    learner: { tier: "higher", targetGrade: "7" },
    turns: ["I really don't get completing the square", "can you do x^2 + 6x + 2 step by step"],
  },
  {
    id: "maths-voice-board",
    what: "Voice mode maths: short speech, working on a board",
    topic: "H129",
    mode: "learn",
    voice: true,
    learner: { tier: "higher" },
    turns: ["how do I use the quadratic formula", "can you do x squared plus 4x plus 1 equals 0"],
  },
  {
    id: "physics-vt-graph",
    what: "Science graph from data: expects a graph block with data and axis labels",
    topic: "P057",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["draw a velocity time graph for a car that speeds up from 0 to 20 m/s in 5 seconds then stays at 20 for 5 seconds"],
  },
  {
    id: "act-quiz-cells",
    what: "Asks to be tested: expects a quick check with real misconception options",
    topic: "B002",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["can you test me on what the parts of a cell do"],
  },
  {
    id: "act-quiz-response",
    what: "Student gets a quick check wrong: tutor must address the misconception",
    topic: "B002",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: [
      "what do ribosomes do",
      'Quick check "Which part of the cell releases energy by respiration?": I chose "Ribosomes" (wrong; the answer was "Mitochondria").',
    ],
  },
  {
    id: "act-order-heart",
    what: "Sequence topic: expects a put-in-order activity",
    topic: "B018",
    mode: "learn",
    learner: { tier: "higher" },
    turns: ["I keep mixing up the order blood goes through the heart, can I practise it"],
  },
  {
    id: "act-explore-density",
    what: "Formula relationships: expects a what-happens-if explorer",
    topic: "P025",
    mode: "learn",
    learner: { tier: "foundation", interests: "football" },
    turns: ["what happens to density if the mass doubles but the volume stays the same"],
  },
  {
    id: "act-gaps-factorising",
    what: "Practice: expects a board with gaps to fill",
    topic: "H033",
    mode: "learn",
    learner: { tier: "higher" },
    turns: ["show me how to factorise x^2 + 7x + 12", "ok give me one to do myself"],
  },
  {
    id: "act-stats-bars",
    what: "Statistics: expects a bar chart from data",
    topic: "S027",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["can you draw a bar chart for this: 5 people walk, 12 get the bus, 8 come by car and 3 cycle"],
  },
  {
    id: "act-cs-order",
    what: "Computer science: expects ordering or a quick check",
    topic: "CS010",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["I get how bubble sort works I think, can you check I understand it"],
  },
  {
    id: "act-french-practice",
    what: "French: expects a gap-fill or quick check, without maths styling",
    topic: "FR042",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["can I practise the perfect tense with avoir"],
  },
  {
    id: "pic-cell",
    what: "Structure question: expects the animal-cell library diagram",
    topic: "B002",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["what's inside an animal cell and what does each bit do"],
  },
  {
    id: "pic-label-quiz",
    what: "Asks to be tested on labelling: expects a library diagram in quiz mode",
    topic: "B002",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["can you test me on labelling the parts of an animal cell"],
  },
  {
    id: "pic-heart",
    what: "Heart structure: expects the heart library diagram",
    topic: "B018",
    mode: "learn",
    learner: { tier: "higher" },
    turns: ["can you show me the parts of the heart"],
  },
  {
    id: "pic-eye",
    what: "Not in the library: expects a sketch of the eye",
    topic: "B047",
    mode: "learn",
    learner: { tier: "higher", learningStyle: ["visual"] },
    turns: ["how does the eye focus on something close up"],
  },
  {
    id: "pic-distillation",
    what: "Practical apparatus: expects a sketch of simple distillation",
    topic: "C003",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["how does simple distillation work"],
  },
  {
    id: "pic-atom",
    what: "Electron arrangement: expects the atom library diagram",
    topic: "C007",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["how are the electrons arranged in a sodium atom"],
  },
  {
    id: "pic-group1",
    what: "Group trends: expects the periodic table or atoms",
    topic: "C011",
    mode: "learn",
    learner: { tier: "higher" },
    turns: ["why do the alkali metals get more reactive going down the group"],
  },
  {
    id: "pic-particles",
    what: "States of matter: expects the particles library diagram",
    topic: "C018",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["what's the difference between the particles in a solid, a liquid and a gas"],
  },
  {
    id: "pic-circuit",
    what: "Circuits: expects the circuit library diagram",
    topic: "P017",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["what's the difference between a series and a parallel circuit"],
  },
  {
    id: "pic-wave",
    what: "Wave properties: expects the wave library diagram",
    topic: "P069",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["what are amplitude and wavelength"],
  },
  {
    id: "pic-forces",
    what: "Free body diagrams: expects the forces library diagram",
    topic: "P045",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["how do I work out the resultant force on a skydiver"],
  },
  {
    id: "pic-em",
    what: "EM spectrum order: expects the spectrum diagram or an ordering activity",
    topic: "P075",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["I can never remember the order of the electromagnetic spectrum"],
  },
  {
    id: "lesson-cells",
    what: "Full lesson: stage blocks in order, a picture when explaining, an activity at check",
    topic: "B002",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: [
      "Teach me this topic as a full lesson",
      "I know cells have a nucleus but that's about it",
      "ok that makes sense, what next",
      'Quick check "Which part of a plant cell is not found in an animal cell?": I chose "Chloroplasts" (correct).',
      "ok",
      "I'm not sure, I think it's something to do with energy",
      "ok I think I've got it now",
    ],
  },
  {
    id: "lesson-quadratics",
    what: "Full maths lesson: worked example on a board, then a board with gaps to try",
    topic: "H129",
    mode: "learn",
    learner: { tier: "higher" },
    turns: [
      "Teach me this topic as a full lesson",
      "I can factorise but I've never used the formula",
      "ok go on",
      'Quick check "In x² − 3x − 10 = 0, what is b?": I chose "3" (wrong; the answer was "−3").',
      "ok I see",
      'Filled the gaps: 2 of 2 right first time.',
    ],
  },
  {
    id: "link-offtopic",
    what: "Off-topic question: expects brief help and a /learn/find link to the right topic",
    topic: "C007",
    mode: "learn",
    learner: { tier: "foundation" },
    turns: ["actually can you help me with completing the square in maths"],
  },
  {
    id: "bio-voice",
    what: "Voice conversation: replies must be short, spoken-style, and not repeat the name",
    topic: "B011",
    mode: "learn",
    voice: true,
    learner: { tier: "foundation" },
    turns: ["what is osmosis", "why does the water move though", "ok and what happens to a plant cell"],
  },
];

/** The last lesson stage seen in each lesson scenario, to check stages move forward one at a time. */
const lessonStages = new Map<string, number>();

/** Automatic checks for the things students notice: length, names, filler, emoji, LaTeX misuse. */
function flags(text: string, s: Scenario, turn: number): string[] {
  const out: string[] = [];
  // Boards and graphs are visuals, not reading: only count the prose around them.
  const proseWords = text.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length;
  const limit = s.voice ? 90 : s.mode === "mock" ? 220 : 150;
  if (proseWords > limit) out.push(`long (${proseWords}>${limit})`);
  const names = (text.match(/\bSam\b/g) ?? []).length;
  if (names && (turn > 0 || s.voice)) out.push(`name x${names}`);
  if (/^(?:(?:great|good|fair|nice)\b[^.!?\n]{0,25}(?:question|point|thing|choice|one)|fair enough|no problem|no worries|sure[!,.]|okay so|let's dive)/i.test(text.trim()))
    out.push("filler opener");
  if (s.id.includes("diagram") && !/```(mermaid|graph|diagram|sketch)/.test(text))
    out.push(fenceBareDiagrams(text).includes("```mermaid") ? "unfenced diagram (auto-fixed)" : "no diagram");
  if (/\p{Extended_Pictographic}/u.test(text)) out.push("emoji");
  if (/does that make sense/i.test(text)) out.push('"does that make sense"');
  if (s.topic.startsWith("FR") && /\$[^$]*[a-zà-ü]{3,}[^$]*\$/i.test(text)) out.push("LaTeX for words");
  const spoken = text.replace(/```[\s\S]*?```/g, "");
  if (s.voice && (/\$|\|/.test(spoken) || /\n\s*[-*] /.test(spoken))) out.push("not speech-friendly");

  // Visual blocks must be valid, because the student sees them rendered.
  // Read blocks the way the app renders them (a ```wave fence is the "wave" diagram).
  const blocks = [...fenceBareDiagrams(text).matchAll(/```([\w-]+)\n([\s\S]*?)```/g)].map(([whole, lang, body]) => {
    const diagram = diagramBlockJson(lang, body);
    return diagram === null ? [whole, lang, body] : [whole, "diagram", diagram];
  });
  for (const [, lang, body] of blocks) {
    if (lang === "steps") {
      const steps = parseSteps(body);
      if (steps.length < 2) out.push("board with <2 steps");
      const worded = steps.filter((st) => /^\\text\{[^}]*\}$/.test(st.math.trim())).length;
      if (worded * 2 >= steps.length) out.push("worded board");
      for (const step of steps.filter((st) => looksLikeMaths(st.math))) {
        try {
          katex.renderToString(step.math, { throwOnError: true });
        } catch {
          out.push(`bad LaTeX in step: ${step.math.slice(0, 30)}`);
        }
      }
    }
    if (lang === "graph") {
      try {
        parseGraphSpec(body);
      } catch (err) {
        out.push(`invalid graph: ${(err as Error).message.slice(0, 60)}`);
      }
    }
  }
  for (const [, lang, body] of blocks) {
    if (lang === "quiz" || lang === "order" || lang === "explore") {
      const activity = parseActivity(lang, body);
      if (activity.kind === "error") out.push(`invalid ${lang}: ${activity.message.slice(0, 60)}`);
    }
    if (lang === "diagram") {
      const diagram = parseDiagramSpec(body);
      if ("error" in diagram) out.push(`invalid diagram: ${diagram.error.slice(0, 60)}`);
    }
    if (lang === "sketch" && !parseSketchJson(body)) out.push(`invalid sketch: ${body.slice(0, 60)}`);
  }
  const has = (lang: string) => blocks.some((b) => b[1] === lang);
  const diagramNamed = (name: string) => blocks.some(([, lang, body]) => lang === "diagram" && body.includes(`"${name}"`));
  const quizDiagram = blocks.some(([, lang, body]) => lang === "diagram" && /"mode"\s*:\s*"quiz"/.test(body));
  const activityCount =
    blocks.filter((b) => ["quiz", "order", "explore"].includes(b[1])).length + (/\[\[[^\]]+\]\]/.test(text) ? 1 : 0) + (quizDiagram ? 1 : 0);
  if (activityCount > 1) out.push(`${activityCount} activities in one reply`);
  const pictures = blocks.filter((b) => ["steps", "graph", "diagram", "sketch", "mermaid"].includes(b[1])).length;
  if (pictures > 2) out.push(`${pictures} pictures in one reply`);
  const prose = text.replace(/```[\s\S]*?```/g, "");
  for (const [, href] of prose.matchAll(/\]\((\/learn[^)\s]*)\)/g)) if (!href.startsWith("/learn/find?q=")) out.push(`guessed link ${href.slice(0, 40)}`);
  if (pictures === 0 && /\b(picture|diagram|sketch|drawing)\s+(below|above)\b|\blook at the (picture|diagram|sketch)\b/i.test(prose)) out.push("phantom picture");
  if (s.id === "link-offtopic" && !/\]\(\/learn\/find\?q=[^)]*\)/.test(prose)) out.push("no topic link");
  if (s.id.startsWith("lesson-")) {
    const lessonBlock = blocks.find((b) => b[1] === "lesson");
    const stage = lessonBlock ? parseLessonStage(lessonBlock[2]) : null;
    if (!stage) out.push("no lesson stage");
    else {
      const previous = lessonStages.get(s.id) ?? -1;
      const id = stage.stage.id;
      if (stage.index < previous) out.push(`stage went back to ${id}`);
      if (stage.index > previous + 1) out.push(`skipped to ${id}`);
      lessonStages.set(s.id, stage.index);
      if (id === "explain" && pictures === 0) out.push("explain without a picture");
      if (id === "check" && activityCount === 0) out.push("check without an activity");
      if (id === "try" && activityCount === 0 && !/\[\d+ marks?\]/.test(text)) out.push("try without an activity");
    }
  }
  if (s.id.startsWith("pic-") && turn === 0) {
    const expects: Record<string, () => boolean> = {
      "pic-cell": () => diagramNamed("animal-cell"),
      "pic-label-quiz": () => quizDiagram,
      "pic-heart": () => diagramNamed("heart"),
      "pic-eye": () => has("sketch"),
      "pic-distillation": () => has("sketch"),
      "pic-atom": () => diagramNamed("atom"),
      "pic-group1": () => diagramNamed("periodic-table") || diagramNamed("atom"),
      "pic-particles": () => diagramNamed("particles"),
      "pic-circuit": () => diagramNamed("circuit"),
      "pic-wave": () => diagramNamed("wave"),
      "pic-forces": () => diagramNamed("forces"),
      "pic-em": () => diagramNamed("em-spectrum") || has("order"),
    };
    if (expects[s.id] && !expects[s.id]()) out.push("expected picture missing");
  }
  if (s.id.startsWith("act-")) {
    const expects: Record<string, () => boolean> = {
      "act-quiz-cells": () => has("quiz"),
      "act-order-heart": () => has("order"),
      "act-explore-density": () => has("explore"),
      "act-gaps-factorising": () => turn === 0 || /\[\[[^\]]+\]\]/.test(text),
      "act-stats-bars": () => has("graph") && /"bars"/.test(text),
      "act-cs-order": () => has("order") || has("quiz"),
      "act-french-practice": () => has("quiz") || /\[\[[^\]]+\]\]/.test(text),
      "act-quiz-response": () => turn === 0 || /mitochondri/i.test(text),
    };
    if (expects[s.id] && !expects[s.id]()) out.push("expected activity missing");
  }
  if (turn === 0 && s.id.includes("board") && !has("steps") && !(s.voice && s.turns.length > 1)) out.push("no working-out board");
  if (s.id.includes("graph") && !has("graph")) out.push("no graph");
  if (s.id.includes("sliders") && !/"params"/.test(text)) out.push("graph has no sliders");
  if (s.voice) {
    const talk = speechPlan(text, true)
      .filter((seg) => !seg.step)
      .map((seg) => seg.text)
      .join(" ");
    const talkWords = talk.split(/\s+/).filter(Boolean).length;
    if (talkWords > 70) out.push(`voice talk outside board ${talkWords} words`);
  }
  return out;
}

const label = process.argv[2] ?? "run";
const only = new Set(process.argv.slice(3));
const client = new Anthropic();
const out: string[] = [`# Tutor eval: ${label}\n`];
let totalCredits = 0;
let totalFlags = 0;

for (const s of SCENARIOS.filter((x) => !only.size || only.has(x.id))) {
  const topic: TopicContent = JSON.parse(readFileSync(`data/content/${s.topic}.json`, "utf8"));
  const learner: Learner = {
    displayName: "Sam",
    yearGroup: 10,
    targetGrade: null,
    learningStyle: [],
    interests: null,
    aboutMe: null,
    examBoard: "AQA",
    tier: "foundation",
    notes: [],
    ...s.learner,
  };
  const history: Anthropic.MessageParam[] = [];
  out.push(`\n## ${s.id}: ${topic.title} (${s.mode}, ${learner.tier}${s.voice ? ", voice" : ""})\n_${s.what}_\n`);

  for (const [turn, userText] of s.turns.entries()) {
    // Built each turn, as the chat route does: it carries the current lesson stage.
    const lesson = s.mode === "learn" ? latestLessonStage(assistantTexts(history)) : null;
    const system = buildSystem(topic, learner, s.mode, Boolean(s.voice), { lesson });
    const result = await runTutorTurn({
      client,
      system,
      history,
      userText,
      mode: s.mode,
      onText: () => {},
    });
    history.push(...result.newMessages.map(({ role, content }) => ({ role, content })));
    const credits = usdToCredits(claudeCostUsd(result.usage));
    totalCredits += credits;
    const words = result.text.split(/\s+/).filter(Boolean).length;
    const issues = flags(result.text, s, turn);
    if (result.stopReason !== "end_turn") issues.push(`stopped: ${result.stopReason}`);
    if (turn === 0 && result.notes.length) issues.push("note in first reply");
    totalFlags += issues.length;
    const flagText = issues.length ? ` ⚠ ${issues.join(", ")}` : "";
    out.push(`**Student:** ${userText}\n`, `**Tutor** _(${words} words, ${credits.toFixed(2)} credits)${flagText}_:\n\n${result.text}\n`);
    for (const n of result.notes) out.push(`_Note saved (${n.kind}): ${n.note}_\n`);
    process.stdout.write(`${s.id}: ${words} words, ${credits.toFixed(2)} credits${flagText}\n`);
  }
}

out.push(`\n---\nTotal: ${totalCredits.toFixed(1)} credits (≈ ${totalCredits.toFixed(0)}p), ${totalFlags} flags\n`);
mkdirSync("data/evals", { recursive: true });
writeFileSync(`data/evals/${label}.md`, out.join("\n"));
console.log(`\nWrote data/evals/${label}.md (total ${totalCredits.toFixed(1)} credits, ${totalFlags} flags)`);
