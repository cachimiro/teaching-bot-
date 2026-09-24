import { AtomDiagram } from "@/components/diagrams/atom-diagram";
import type { DiagramEntry } from "../types";
import { highlightKey, resolveAtom } from "./atom-model";

export * from "./atom-model";

// The atom diagram's entry and validation. No client directive here: the tutor's prompt reads this entry
// on the server. The helpers are in atom-model.ts; the drawing is in components/diagrams/atom-diagram.tsx.

function highlightList(spec: Record<string, unknown>): unknown[] {
  const h = spec.highlight;
  return h === undefined ? [] : Array.isArray(h) ? h : [h];
}

export function validateAtom(spec: Record<string, unknown>): string | null {
  const model = resolveAtom(spec);
  if ("error" in model) return model.error;
  const unknown = highlightList(spec).find((h) => typeof h !== "string" || !highlightKey(h));
  if (unknown !== undefined) return `"atom" can highlight "outer shell", "nucleus", "electrons" or "shells", not "${String(unknown)}"`;
  return null;
}

export const atomEntry: DiagramEntry = {
  kind: "custom",
  name: "atom",
  title: "Atom (Bohr model)",
  subject: "chemistry",
  description: "Bohr model of an atom or simple ion (elements 1–20): nucleus with protons/neutrons, electrons on 2,8,8,2 shells, configuration caption",
  options:
    '{"element": "Na", "charge": 1} (element: symbol, name or atomic number 1–20; optional charge −3..+3 draws the ion in brackets; highlight "outer shell" or "nucleus"; mode "labelled" | "blank")',
  Component: AtomDiagram,
  validate: validateAtom,
};
