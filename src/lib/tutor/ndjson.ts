/** Reads a newline-delimited JSON stream, calling `onEvent` for each complete line. */
export async function readNdjson<T = unknown>(body: ReadableStream<Uint8Array>, onEvent: (event: T) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop()!;
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as T);
    if (done) return;
  }
}
