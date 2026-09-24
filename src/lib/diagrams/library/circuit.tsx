import { CircuitDiagram } from "@/components/diagrams/circuit-diagram";
import type { DiagramEntry } from "../types";
import { isNum } from "./physics";

export { circuitValues, pointsAlong } from "./physics";

/** Checks a ```diagram {"name": "circuit", …} block's options. Unknown highlights are ignored. */
export function validateCircuit(spec: Record<string, unknown>): string | null {
  if (spec.type !== undefined && spec.type !== "series" && spec.type !== "parallel") return `"circuit" type must be "series" or "parallel"`;
  if (spec.voltage !== undefined && !(isNum(spec.voltage) && spec.voltage >= 0)) return `"circuit" voltage must be a number of volts (0 or more)`;
  if (spec.resistors !== undefined) {
    if (!Array.isArray(spec.resistors) || spec.resistors.length < 1 || spec.resistors.length > 3) return `"circuit" needs 1 to 3 resistors`;
    if (!spec.resistors.every((r) => isNum(r) && r > 0)) return `"circuit" resistances must be positive numbers of ohms`;
  }
  if (spec.controls !== undefined && typeof spec.controls !== "boolean") return `"circuit" controls must be true or false`;
  return null;
}

export const circuitEntry: DiagramEntry = {
  kind: "custom",
  name: "circuit",
  title: "Circuit",
  subject: "physics",
  description:
    "series or parallel circuit with UK symbols (battery, ammeter, 1 to 3 resistors), sliders for V and each R, and live total resistance, current, branch currents and p.d. across each resistor",
  options:
    '{"type": "series" | "parallel", "voltage": 6, "resistors": [2, 4], "controls": true} (1 to 3 resistors in ohms, voltage in V; "highlight": ["ammeter"], ["battery"] or ["R2"] glows that component; "controls": false hides the sliders and all calculated values)',
  Component: CircuitDiagram,
  validate: validateCircuit,
};
