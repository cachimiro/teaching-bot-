import Anthropic from "@anthropic-ai/sdk";
import { MODEL, type ClaudeUsage } from "@/lib/credits/pricing";
import { extractNotes, type LearnerNote } from "./notes";
import type { Mode } from "./prompt";

/**
 * The tutor used to have find_topics and save_learner_note tools. With tools available it often
 * called one part-way through a reply where a picture belonged, and the picture was lost. Topic
 * links (/learn/find?q=...) and learner notes (```note blocks) are now written in the reply itself,
 * so every turn is one model call. These definitions remain only so conversations stored before
 * the change still replay: history containing tool blocks must be sent with its tools defined.
 */
const LEGACY_TOOLS: Anthropic.Tool[] = [
  {
    name: "find_topics",
    description: "Retired.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "save_learner_note",
    description: "Retired.",
    input_schema: { type: "object", properties: { kind: { type: "string" }, note: { type: "string" } }, required: ["kind", "note"] },
  },
];

/** A message to append to the stored conversation, in exact API shape for byte-stable replay. */
export type StoredMessage = { role: "user" | "assistant"; content: Anthropic.ContentBlockParam[]; displayText: string | null };

export type TurnResult = {
  newMessages: StoredMessage[];
  usage: Required<ClaudeUsage>;
  stopReason: Anthropic.Message["stop_reason"];
  /** The reply as the student sees it (learner notes removed). */
  text: string;
  notes: LearnerNote[];
};

/** Structural subset of the SDK client, so tests can pass a fake. */
export type MessagesClient = { messages: Pick<Anthropic["messages"], "stream"> };

export const REFUSAL_TEXT =
  "Sorry, I can't help with that one. Let's get back to your revision. What would you like to go over?";

export function effortFor(mode: Mode): "medium" | "high" {
  return mode === "mock" ? "high" : "medium";
}

/** The text of each assistant reply in a history, oldest first. */
export function assistantTexts(history: Anthropic.MessageParam[]): string[] {
  return history
    .filter((m) => m.role === "assistant")
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((b) => (b.type === "text" ? b.text : "")).join("")));
}

function hasToolBlocks(history: Anthropic.MessageParam[]) {
  return history.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_use" || b.type === "tool_result"));
}

/** Runs one student turn: streams Claude's reply and returns the messages to persist plus usage. */
export async function runTutorTurn(opts: {
  client: MessagesClient;
  system: Anthropic.TextBlockParam[];
  history: Anthropic.MessageParam[];
  userText: string;
  mode: Mode;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<TurnResult> {
  const userMessage: StoredMessage = {
    role: "user",
    content: [{ type: "text", text: opts.userText }],
    displayText: opts.userText,
  };
  const legacy = hasToolBlocks(opts.history) ? { tools: LEGACY_TOOLS, tool_choice: { type: "none" as const } } : {};

  const stream = opts.client.messages.stream(
    {
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: effortFor(opts.mode) },
      cache_control: { type: "ephemeral" },
      system: opts.system,
      ...legacy,
      messages: [...opts.history, { role: "user", content: userMessage.content }],
    },
    { signal: opts.signal },
  );
  stream.on("text", opts.onText);
  const message = await stream.finalMessage();

  const usage = {
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
  };

  if (message.stop_reason === "refusal") {
    opts.onText(REFUSAL_TEXT);
    // Don't replay a refused turn; store a plain assistant reply instead.
    return {
      newMessages: [userMessage, { role: "assistant", content: [{ type: "text", text: REFUSAL_TEXT }], displayText: REFUSAL_TEXT }],
      usage,
      stopReason: message.stop_reason,
      text: REFUSAL_TEXT,
      notes: [],
    };
  }

  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const { text, notes } = extractNotes(raw);
  return {
    newMessages: [userMessage, { role: "assistant", content: message.content as Anthropic.ContentBlockParam[], displayText: text || null }],
    usage,
    stopReason: message.stop_reason,
    text,
    notes,
  };
}
