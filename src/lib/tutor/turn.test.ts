import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runTutorTurn, REFUSAL_TEXT, type MessagesClient } from "./turn";

type Reply = Pick<Anthropic.Message, "content" | "stop_reason"> & { usage?: Partial<Anthropic.Usage> };

/** Fake client: returns scripted replies in order and records each request. */
function fakeClient(replies: Reply[]) {
  const requests: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      stream: (params: Anthropic.MessageCreateParams) => {
        requests.push(structuredClone(params));
        const reply = replies.shift()!;
        let onText: ((t: string) => void) | undefined;
        return {
          on(event: string, cb: (t: string) => void) {
            if (event === "text") onText = cb;
            return this;
          },
          async finalMessage() {
            for (const b of reply.content) if (b.type === "text") onText?.(b.text);
            return {
              ...reply,
              usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0, ...reply.usage },
            };
          },
        };
      },
    },
  } as unknown as MessagesClient;
  return { client, requests };
}

const text = (t: string) => ({ type: "text", text: t, citations: null }) as Anthropic.TextBlock;
const base = { system: [{ type: "text" as const, text: "sys" }], history: [], mode: "learn" as const };

describe("runTutorTurn", () => {
  it("streams a plain reply in one call and returns the user + assistant messages", async () => {
    const { client, requests } = fakeClient([{ content: [text("Hello! What do you know already?")], stop_reason: "end_turn" }]);
    const deltas: string[] = [];
    const result = await runTutorTurn({ ...base, client, userText: "hi", onText: (d) => deltas.push(d) });

    expect(deltas.join("")).toBe("Hello! What do you know already?");
    expect(result.newMessages.map((m) => [m.role, m.displayText])).toEqual([
      ["user", "hi"],
      ["assistant", "Hello! What do you know already?"],
    ]);
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: "claude-sonnet-5", cache_control: { type: "ephemeral" }, output_config: { effort: "medium" } });
  });

  it("offers the tutor no tools, so pictures are never swapped for a tool call", async () => {
    const { client, requests } = fakeClient([{ content: [text("Hi.")], stop_reason: "end_turn" }]);
    await runTutorTurn({ ...base, client, userText: "hi", onText: () => {} });
    expect(requests[0].tools).toBeUndefined();
  });

  it("still replays older conversations that contain tool calls, with tool use switched off", async () => {
    const history: Anthropic.MessageParam[] = [
      { role: "user", content: [{ type: "text", text: "quadratics?" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "tu_1", name: "find_topics", input: { query: "quadratics" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1", content: "Quadratics → /learn/maths/a/b" }] },
      { role: "assistant", content: [{ type: "text", text: "Open Quadratics." }] },
    ];
    const { client, requests } = fakeClient([{ content: [text("Next?")], stop_reason: "end_turn" }]);
    await runTutorTurn({ ...base, history, client, userText: "ok", onText: () => {} });
    expect((requests[0].tools as Anthropic.Tool[]).map((t) => t.name)).toEqual(["find_topics", "save_learner_note"]);
    expect(requests[0].tool_choice).toEqual({ type: "none" });
  });

  it("pulls learner notes out of the reply, keeping them in the stored API content only", async () => {
    const reply = 'Well done.\n\n```note\n{"kind": "strength", "note": "Solid on factorising."}\n```';
    const { client } = fakeClient([{ content: [text(reply)], stop_reason: "end_turn" }]);
    const result = await runTutorTurn({ ...base, client, userText: "done", onText: () => {} });
    expect(result.text).toBe("Well done.");
    expect(result.notes).toEqual([{ kind: "strength", note: "Solid on factorising." }]);
    expect(result.newMessages[1].displayText).toBe("Well done.");
    expect(result.newMessages[1].content).toEqual([text(reply)]);
  });

  it("replaces a refusal with a friendly message and stores that instead", async () => {
    const { client } = fakeClient([{ content: [], stop_reason: "refusal" }]);
    const deltas: string[] = [];
    const result = await runTutorTurn({ ...base, client, userText: "bad", onText: (d) => deltas.push(d) });
    expect(deltas.join("")).toBe(REFUSAL_TEXT);
    expect(result.newMessages[1]).toEqual({ role: "assistant", content: [{ type: "text", text: REFUSAL_TEXT }], displayText: REFUSAL_TEXT });
  });

  it("uses high effort for mock exam marking", async () => {
    const { client, requests } = fakeClient([{ content: [text("Question 1 [2 marks]")], stop_reason: "end_turn" }]);
    await runTutorTurn({ ...base, mode: "mock", client, userText: "start", onText: () => {} });
    expect(requests[0].output_config).toEqual({ effort: "high" });
  });
});
