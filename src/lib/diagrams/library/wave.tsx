import { WaveDiagram } from "@/components/diagrams/wave-diagram";
import type { DiagramEntry } from "../types";
import { isNum } from "./physics";

export { featurePositions, ridingLabel, waveDisplacement, waveSpeed } from "./physics";

/** Checks a ```diagram {"name": "wave", …} block's options. Unknown highlights are ignored. */
export function validateWave(spec: Record<string, unknown>): string | null {
  if (spec.type !== undefined && spec.type !== "transverse" && spec.type !== "longitudinal") {
    return `"wave" type must be "transverse" or "longitudinal"`;
  }
  for (const key of ["amplitude", "wavelength", "frequency"] as const) {
    const v = spec[key];
    if (v !== undefined && !(isNum(v) && v > 0)) return `"wave" ${key} must be a positive number`;
  }
  if (spec.controls !== undefined && typeof spec.controls !== "boolean") return `"wave" controls must be true or false`;
  return null;
}

export const waveEntry: DiagramEntry = {
  kind: "custom",
  name: "wave",
  title: "Wave",
  subject: "physics",
  description:
    "animated transverse wave (crest, trough, amplitude, wavelength, rest position) or longitudinal wave (compressions, rarefactions, wavelength), with sliders and a live v = f × λ readout",
  options:
    '{"type": "transverse" | "longitudinal", "amplitude": 2, "wavelength": 4, "frequency": 1, "controls": true} (amplitude and wavelength in m, frequency in Hz; "highlight": ["amplitude"] or ["wavelength"] draws that label gold; "controls": false hides the sliders and the wave-speed answer)',
  Component: WaveDiagram,
  validate: validateWave,
};
