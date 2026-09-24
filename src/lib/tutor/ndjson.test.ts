import { describe, expect, it } from "vitest";
import { readNdjson } from "./ndjson";

function streamOf(chunks: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((ch) => c.enqueue(enc.encode(ch)));
      c.close();
    },
  });
}

describe("readNdjson", () => {
  it("emits one event per line even when lines are split across chunks", async () => {
    const events: unknown[] = [];
    await readNdjson(streamOf(['{"type":"start"}\n{"type":"te', 'xt","delta":"Hi"}\n', '{"type":"done"}']), (e) => events.push(e));
    expect(events).toEqual([{ type: "start" }, { type: "text", delta: "Hi" }, { type: "done" }]);
  });

  it("handles multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode('{"delta":"£5"}\n');
    const events: unknown[] = [];
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 11));
        c.enqueue(bytes.slice(11));
        c.close();
      },
    });
    await readNdjson(stream, (e) => events.push(e));
    expect(events).toEqual([{ delta: "£5" }]);
  });
});
