import { EmSpectrumDiagram } from "@/components/diagrams/em-spectrum-diagram";
import type { DiagramEntry } from "../types";
import { EM_BANDS, findBand } from "./physics";

export { EM_BANDS, findBand } from "./physics";

/** Checks a ```diagram {"name": "em-spectrum", …} block: every highlight must name a band. */
export function validateEmSpectrum(spec: Record<string, unknown>): string | null {
  const h = spec.highlight;
  if (h === undefined) return null;
  const names = Array.isArray(h) ? h : [h];
  for (const name of names) {
    if (typeof name !== "string" || !findBand(name)) {
      return `"em-spectrum" has no band called "${String(name)}" (use ${EM_BANDS.map((b) => b.name.toLowerCase()).join(", ")})`;
    }
  }
  return null;
}

export const emSpectrumEntry: DiagramEntry = {
  kind: "custom",
  name: "em-spectrum",
  title: "The electromagnetic spectrum",
  subject: "physics",
  description:
    "the seven EM bands in order (radio to gamma) with wavelength decreasing and frequency/energy increasing, the visible-light colours, and tap-a-band typical wavelength, uses and dangers",
  options:
    '{"highlight": "microwaves"} (any band: radio waves, microwaves, infrared, visible light, ultraviolet, X-rays, gamma rays; glows that band gold and opens its uses and dangers; "mode": "blank" hides the band names until tapped)',
  Component: EmSpectrumDiagram,
  validate: validateEmSpectrum,
};
