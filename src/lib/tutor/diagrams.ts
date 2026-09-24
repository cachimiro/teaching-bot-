/** Renames each ```steps fence to ```steps-0, ```steps-1… (matches StepRef.block in the speech plan). */
export function numberStepsBlocks(markdown: string): string {
  let inFence = false;
  let n = 0;
  return markdown
    .split("\n")
    .map((line) => {
      if (!line.trimStart().startsWith("```")) return line;
      if (!inFence && /^\s*```steps\s*$/.test(line)) {
        inFence = true;
        return line.replace("```steps", `\`\`\`steps-${n++}`);
      }
      inFence = !inFence;
      return line;
    })
    .join("\n");
}

const DIAGRAM_START = /^(?:xychart-beta|flowchart\s+(?:LR|RL|TD|TB|BT)|graph\s+(?:LR|RL|TD|TB|BT)|pie\b)/;

/**
 * The tutor is told to put diagrams in ```mermaid fences, but occasionally forgets.
 * Wraps any bare diagram (a mermaid keyword at the start of a line, followed by indented lines)
 * in a fence so it still renders as a picture and isn't read aloud as code.
 */
export function fenceBareDiagrams(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (!inFence && DIAGRAM_START.test(line)) {
      const block = [line];
      while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])) block.push(lines[++i]);
      out.push("```mermaid", ...block, "```");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
