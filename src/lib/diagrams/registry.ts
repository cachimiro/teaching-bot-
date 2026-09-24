import type { DiagramEntry } from "./types";
import { animalCell } from "./library/animal-cell";
import { atomEntry } from "./library/atom";
import { bacterialCell } from "./library/bacterial-cell";
import { circuitEntry } from "./library/circuit";
import { emSpectrumEntry } from "./library/em-spectrum";
import { forcesEntry } from "./library/forces";
import { heart } from "./library/heart";
import { leaf } from "./library/leaf";
import { particlesEntry } from "./library/particles";
import { periodicTableEntry } from "./library/periodic-table";
import { plantCell } from "./library/plant-cell";
import { waveEntry } from "./library/wave";

/**
 * Every diagram the tutor can show. The catalogue text for the tutor's prompt is generated from
 * these entries, so adding a diagram here makes it available to the tutor automatically.
 * Entry modules must not be "use client": the server reads their names and options for the prompt.
 */
export const DIAGRAMS: DiagramEntry[] = [
  { kind: "parts", def: animalCell, subject: "biology", description: "animal cell with nucleus, cytoplasm, cell membrane, mitochondria, ribosomes" },
  {
    kind: "parts",
    def: plantCell,
    subject: "biology",
    description: "plant cell with cell wall, cell membrane, cytoplasm, nucleus, chloroplasts, permanent vacuole, mitochondria, ribosomes",
  },
  {
    kind: "parts",
    def: bacterialCell,
    subject: "biology",
    description: "bacterial (prokaryotic) cell: cell wall, membrane, cytoplasm, one loop of chromosomal DNA (no nucleus), plasmids, ribosomes, flagellum",
  },
  {
    kind: "parts",
    def: heart,
    subject: "biology",
    description:
      "human heart, front view (the heart's left side is on the picture's right): four chambers, vena cava, pulmonary artery, pulmonary vein, aorta, valves; left ventricle wall thickest",
  },
  {
    kind: "parts",
    def: leaf,
    subject: "biology",
    description: "leaf cross-section: waxy cuticle, upper epidermis, palisade and spongy mesophyll, air spaces, vein with xylem above phloem, lower epidermis with stomata and guard cells",
  },
  atomEntry,
  periodicTableEntry,
  particlesEntry,
  waveEntry,
  circuitEntry,
  forcesEntry,
  emSpectrumEntry,
];

export function findDiagram(name: string): DiagramEntry | undefined {
  const n = name.trim().toLowerCase();
  return DIAGRAMS.find((d) => (d.kind === "parts" ? d.def.name : d.name) === n);
}

/** One line per diagram for the tutor's prompt. Static, so it doesn't disturb prompt caching. */
export function diagramCatalogue(): string {
  return DIAGRAMS.map((d) =>
    d.kind === "parts"
      ? `  - "${d.def.name}" (${d.subject}): ${d.description}. Parts: ${d.def.parts.map((p) => `"${p.id}"`).join(", ")}.`
      : `  - "${d.name}" (${d.subject}): ${d.description}. Put these fields in the same JSON as "name": ${d.options}`,
  ).join("\n");
}
