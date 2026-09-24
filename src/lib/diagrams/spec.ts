import { z } from "zod";
import { findDiagram } from "./registry";
import type { DiagramEntry, DiagramMode } from "./types";

const Base = z
  .object({
    name: z.string().min(1).max(40),
    highlight: z.union([z.string(), z.array(z.string())]).optional(),
    mode: z.enum(["labelled", "quiz", "blank"]).default("labelled"),
    ask: z.array(z.string()).max(10).optional(),
  })
  .passthrough();

export type DiagramSpec = {
  name: string;
  highlight: string[];
  mode: DiagramMode;
  ask?: string[];
  raw: Record<string, unknown>;
};

/**
 * The JSON for a diagram block, or null if the fence isn't one. The tutor sometimes names the fence
 * after the diagram (```wave instead of ```diagram with "name": "wave"); both mean the same.
 */
export function diagramBlockJson(lang: string | undefined, body: string): string | null {
  if (lang === "diagram") return body;
  if (!lang || !findDiagram(lang)) return null;
  try {
    const value: unknown = JSON.parse(body || "{}");
    return JSON.stringify({ ...(value && typeof value === "object" ? value : {}), name: lang });
  } catch {
    return JSON.stringify({ name: lang });
  }
}

/** Parses and validates a ```diagram block against the library. */
export function parseDiagramSpec(json: string): { entry: DiagramEntry; spec: DiagramSpec } | { error: string } {
  try {
    const raw = Base.parse(JSON.parse(json));
    const entry = findDiagram(raw.name);
    if (!entry) return { error: `No diagram called "${raw.name}"` };
    const highlight = raw.highlight === undefined ? [] : Array.isArray(raw.highlight) ? raw.highlight : [raw.highlight];
    if (entry.kind === "parts") {
      const names = entry.def.parts.flatMap((p) => [p.id, p.label.toLowerCase(), ...(p.aliases ?? []).map((a) => a.toLowerCase())]);
      const unknown = [...highlight, ...(raw.ask ?? [])].find((h) => !names.includes(h.trim().toLowerCase()));
      if (unknown) return { error: `"${raw.name}" has no part called "${unknown}"` };
    } else if (entry.validate) {
      const problem = entry.validate(raw);
      if (problem) return { error: problem };
    }
    return { entry, spec: { name: raw.name, highlight, mode: raw.mode, ask: raw.ask, raw } };
  } catch (err) {
    return { error: err instanceof z.ZodError ? err.issues[0].message : (err as Error).message };
  }
}
