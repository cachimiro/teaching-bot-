/**
 * Smoke test against the real Claude API (costs ~2p): runs two tutor turns on one topic
 * and prints token usage, cache hits and credits charged.
 * Usage: npx tsx scripts/try-tutor.ts [topicId] [mode]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem, type Learner, type Mode } from "../src/lib/tutor/prompt";
import { runTutorTurn } from "../src/lib/tutor/turn";
import { claudeCostUsd, usdToCredits } from "../src/lib/credits/pricing";
import type { TopicContent } from "../src/lib/content/types";

const [topicId = "B076", mode = "learn"] = process.argv.slice(2);
const topic: TopicContent = JSON.parse(readFileSync(`data/content/${topicId}.json`, "utf8"));
const learner: Learner = {
  displayName: "Sam",
  yearGroup: 10,
  targetGrade: "6",
  learningStyle: ["analogies", "step_by_step"],
  interests: null,
  aboutMe: null,
  examBoard: "AQA",
  tier: "foundation",
  notes: [],
};

const client = new Anthropic();
const system = buildSystem({ ...topic, unitName: topic.unitName }, learner, mode as Mode, false);
const history: Anthropic.MessageParam[] = [];

for (const userText of ["I don't really get this topic, can you explain it simply?", "ok so is temperature biotic?"]) {
  console.log(`\n> ${userText}\n`);
  const result = await runTutorTurn({
    client,
    system,
    history,
    userText,
    mode: mode as Mode,
    onText: (d) => process.stdout.write(d),
  });
  for (const n of result.notes) console.log(`\n[note saved: ${n.kind}: ${n.note}]`);
  history.push(...result.newMessages.map(({ role, content }) => ({ role, content })));
  const credits = usdToCredits(claudeCostUsd(result.usage));
  console.log(`\n\n[stop=${result.stopReason} usage=${JSON.stringify(result.usage)} credits=${credits.toFixed(2)}]`);
}
