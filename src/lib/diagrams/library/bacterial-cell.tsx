import type { PartsDiagramDef } from "../types";

const NAVY = "#0b1e3c";
const DNA = "#7a3d9e";

/** A closed, gently wavy loop (the bacterial chromosome is one long circular strand, not in a nucleus). */
function wavyLoop(cx: number, cy: number, rx: number, ry: number): string {
  const n = 120;
  const points: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const k = 1 + 0.11 * Math.sin(9 * t + 0.6) + 0.06 * Math.sin(14 * t);
    points.push(`${(cx + rx * k * Math.cos(t)).toFixed(1)},${(cy + ry * k * Math.sin(t)).toFixed(1)}`);
  }
  return `M${points.join(" L")} Z`;
}

const CHROMOSOME = wavyLoop(274, 162, 46, 22);

const PLASMIDS: [number, number][] = [
  [338, 128],
  [362, 184],
];

const RIBOSOMES: [number, number][] = [
  [240, 122],
  [292, 120],
  [372, 156],
  [258, 200],
  [318, 202],
  [340, 192],
];

const FLAGELLUM = "M396,162 C406,148 416,148 424,162 S442,176 450,162 S466,148 474,162";

/**
 * GCSE bacterial (prokaryotic) cell: rod-shaped, with a cell wall, cell membrane, cytoplasm,
 * a single loop of chromosomal DNA (no nucleus), plasmids, ribosomes and a flagellum.
 */
export const bacterialCell: PartsDiagramDef = {
  name: "bacterial-cell",
  title: "Bacterial cell",
  viewBox: "0 0 620 320",
  parts: [
    {
      id: "cytoplasm",
      label: "Cytoplasm",
      shape: <rect x={180} y={105} width={210} height={110} rx={55} fill="#fde9da" />,
      anchor: [212, 186],
      labelAt: [150, 212],
      align: "end",
    },
    {
      id: "cell-wall",
      label: "Cell wall",
      shape: (
        <g>
          <rect x={175} y={100} width={220} height={120} rx={60} fill="none" stroke="#e6d6b1" strokeWidth={10} />
          <rect x={170} y={95} width={230} height={130} rx={65} fill="none" stroke={NAVY} strokeWidth={3} />
          <rect x={180} y={105} width={210} height={110} rx={55} fill="none" stroke={NAVY} strokeWidth={1.4} />
        </g>
      ),
      hit: <rect x={172} y={97} width={226} height={126} rx={63} fill="none" stroke="transparent" strokeWidth={18} />,
      anchor: [193, 118],
      labelAt: [150, 88],
      align: "end",
    },
    {
      id: "cell-membrane",
      label: "Cell membrane",
      aliases: ["membrane", "plasma membrane"],
      shape: <rect x={185} y={110} width={200} height={100} rx={50} fill="none" stroke={NAVY} strokeWidth={2.4} />,
      hit: <rect x={188} y={113} width={194} height={94} rx={47} fill="none" stroke="transparent" strokeWidth={12} />,
      anchor: [370, 125],
      labelAt: [490, 80],
      align: "start",
    },
    {
      id: "flagellum",
      label: "Flagellum",
      aliases: ["flagella", "tail"],
      shape: <path d={FLAGELLUM} fill="none" stroke={NAVY} strokeWidth={3} strokeLinecap="round" />,
      hit: <path d={FLAGELLUM} fill="none" stroke="transparent" strokeWidth={24} strokeLinecap="round" />,
      anchor: [462, 152],
      labelAt: [490, 130],
      align: "start",
    },
    {
      id: "chromosomal-dna",
      label: "Chromosomal DNA",
      aliases: ["dna", "chromosome", "genetic material", "dna loop", "loop of dna"],
      shape: (
        <path d={CHROMOSOME} fill="none" stroke={DNA} strokeWidth={2.6} strokeLinejoin="round" />
      ),
      hit: <path d={CHROMOSOME} fill="transparent" stroke="transparent" strokeWidth={12} />,
      anchor: [231, 156],
      labelAt: [150, 140],
      align: "end",
    },
    {
      id: "plasmids",
      label: "Plasmids",
      aliases: ["plasmid"],
      shape: (
        <g>
          {PLASMIDS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={8} fill="none" stroke={DNA} strokeWidth={2.4} />
          ))}
        </g>
      ),
      hit: (
        <g>
          {PLASMIDS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={14} fill="transparent" />
          ))}
        </g>
      ),
      anchor: [370, 184],
      labelAt: [490, 202],
      align: "start",
    },
    {
      id: "ribosomes",
      label: "Ribosomes",
      aliases: ["ribosome"],
      shape: (
        <g>
          {RIBOSOMES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} fill="#3f63a0" stroke={NAVY} strokeWidth={1} />
          ))}
        </g>
      ),
      hit: (
        <g>
          {RIBOSOMES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={13} fill="transparent" />
          ))}
        </g>
      ),
      anchor: [318, 202],
      labelAt: [490, 256],
      align: "start",
    },
  ],
};
