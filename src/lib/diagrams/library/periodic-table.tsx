import { PeriodicTable } from "@/components/diagrams/periodic-table-diagram";
import type { DiagramEntry } from "../types";
import { findElement } from "../data/elements";
import { highlightMatcher } from "./periodic-table-model";

export * from "./periodic-table-model";

// The periodic table's entry and validation. No client directive here: the tutor's prompt reads this
// entry on the server. The helpers are in periodic-table-model.ts; the drawing is in
// components/diagrams/periodic-table-diagram.tsx.

function highlightTokens(spec: Record<string, unknown>): unknown[] {
  const h = spec.highlight;
  return h === undefined ? [] : Array.isArray(h) ? h : [h];
}

export function validatePeriodicTable(spec: Record<string, unknown>): string | null {
  for (const token of highlightTokens(spec)) {
    if (typeof token !== "string") return '"highlight" should be a list of words, e.g. ["group 1", "Na"]';
    const m = highlightMatcher(token);
    if ("error" in m) return m.error;
  }
  if (spec.select !== undefined) {
    if ((typeof spec.select !== "string" && typeof spec.select !== "number") || !findElement(spec.select)) {
      return `"select" should be an element, e.g. "Na" (got ${JSON.stringify(spec.select)})`;
    }
  }
  return null;
}

export const periodicTableEntry: DiagramEntry = {
  kind: "custom",
  name: "periodic-table",
  title: "Periodic table",
  subject: "chemistry",
  description: "full periodic table coloured by family, UK group numbers (1–7, 0); highlights groups, periods, families or elements; tap an element for its details",
  options:
    '{"highlight": ["group 1", "Na"]} (highlight: elements, "group 1"–"group 7", "group 0", "period 3", "alkali metals", "halogens", "noble gases", "transition metals", "metals", "non-metals"; optional "select": "Na" opens its details)',
  Component: PeriodicTable,
  validate: validatePeriodicTable,
};
