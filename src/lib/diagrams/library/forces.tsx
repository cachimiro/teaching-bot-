import { ForcesDiagram } from "@/components/diagrams/forces-diagram";
import type { DiagramEntry } from "../types";
import { FORCE_OBJECTS, isNum, parseDirection } from "./physics";

export { acceleration, resultantForce } from "./physics";

/** Checks a ```diagram {"name": "forces", …} block's options. Unknown highlights are ignored. */
export function validateForces(spec: Record<string, unknown>): string | null {
  if (spec.object !== undefined && !(FORCE_OBJECTS as readonly unknown[]).includes(spec.object)) {
    return `"forces" object must be one of ${FORCE_OBJECTS.map((o) => `"${o}"`).join(", ")}`;
  }
  if (spec.forces !== undefined) {
    if (!Array.isArray(spec.forces) || spec.forces.length < 1 || spec.forces.length > 6) return `"forces" needs a list of 1 to 6 forces`;
    for (const f of spec.forces) {
      const force = (f ?? {}) as Record<string, unknown>;
      if (typeof force.label !== "string" || !force.label.trim() || force.label.length > 40) return `each force needs a short "label"`;
      if (!(isNum(force.size) && force.size >= 0)) return `force "${force.label}" needs a "size" in newtons (0 or more)`;
      if (!parseDirection(force.direction)) return `force "${force.label}" has an unknown direction "${String(force.direction)}" (use left, right, up or down)`;
    }
  }
  if (spec.mass !== undefined && !(isNum(spec.mass) && spec.mass > 0)) return `"forces" mass must be a positive number of kilograms`;
  if (spec.controls !== undefined && typeof spec.controls !== "boolean") return `"forces" controls must be true or false`;
  return null;
}

export const forcesEntry: DiagramEntry = {
  kind: "custom",
  name: "forces",
  title: "Forces",
  subject: "physics",
  description:
    "free-body diagram: a car, box, skydiver, rocket or ball with labelled force arrows (length proportional to size), a slider per force, the resultant force and whether forces are balanced, and a = F / m when the mass is given",
  options:
    '{"object": "car" | "box" | "skydiver" | "rocket" | "ball", "forces": [{"label": "Thrust", "size": 500, "direction": "right"}, {"label": "Drag", "size": 300, "direction": "left"}], "mass": 1000, "controls": true} (1 to 6 forces; direction is left, right, up or down; size in N; mass in kg is optional; "highlight": ["Drag"] or ["resultant"]; "controls": false hides the sliders and the resultant)',
  Component: ForcesDiagram,
  validate: validateForces,
};
