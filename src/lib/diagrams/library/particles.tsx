import { ParticlesDiagram } from "@/components/diagrams/particles-diagram";
import type { DiagramEntry } from "../types";
import { normaliseState } from "./particles-model";

export * from "./particles-model";

// The particle model's entry and validation. No client directive here: the tutor's prompt reads this
// entry on the server. The simulation is in particles-model.ts; the drawing and animation loop are in
// components/diagrams/particles-diagram.tsx.

export function validateParticles(spec: Record<string, unknown>): string | null {
  if (!normaliseState(spec.state)) return `"state" should be "solid", "liquid", "gas" or "all" (got ${JSON.stringify(spec.state)})`;
  if (spec.controls !== undefined && typeof spec.controls !== "boolean") return '"controls" should be true or false';
  return null;
}

export const particlesEntry: DiagramEntry = {
  kind: "custom",
  name: "particles",
  title: "Particle model",
  subject: "chemistry",
  description: "animated particle model of solids, liquids and gases (arrangement and movement), with an optional temperature slider through melting and boiling",
  options:
    '{"state": "all"} or {"state": "solid", "controls": true} (state: "solid" | "liquid" | "gas" | "all", default "all"; controls: true adds a temperature slider that takes one container from solid to liquid to gas, starting at the given state)',
  Component: ParticlesDiagram,
  validate: validateParticles,
};
