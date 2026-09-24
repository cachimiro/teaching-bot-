import type { PartsDiagramDef } from "../types";

const NAVY = "#0b1e3c";

/** Mitochondrion: outer oval with folded inner membrane (cristae), as in the animal cell. */
function Mitochondrion({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(0.6)`}>
      <ellipse rx={34} ry={16} fill="#f6c6c6" stroke={NAVY} strokeWidth={3.4} />
      <path d="M-24,0 q6,-10 12,0 t12,0 t12,0 t12,0" fill="none" stroke={NAVY} strokeWidth={2.2} />
    </g>
  );
}

/** Chloroplast: green oval with stacked internal membranes. Drawn bigger than a mitochondrion, as it is. */
function Chloroplast({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <ellipse rx={21} ry={11} fill="#8fcf78" stroke={NAVY} strokeWidth={2} />
      <path d="M-12,-4.5 h24 M-14,0 h28 M-12,4.5 h24" stroke="#2f6b2a" strokeWidth={1.4} />
    </g>
  );
}

const CHLOROPLASTS: [number, number, number][] = [
  [300, 68, -4],
  [362, 70, 6],
  [413, 150, 90],
  [413, 296, 88],
  [222, 184, 70],
  [294, 374, 2],
  [356, 373, -4],
];

const RIBOSOMES: [number, number][] = [
  [206, 64],
  [268, 88],
  [331, 60],
  [398, 90],
  [412, 202],
  [412, 250],
  [240, 232],
  [244, 282],
  [206, 368],
  [246, 358],
  [325, 368],
  [404, 366],
  [388, 380],
];

/** Large central vacuole, dented where the nucleus is pushed against the side of the cell. */
const VACUOLE =
  "M316,92 C368,90 396,110 396,158 L396,300 C396,336 374,352 338,352 L290,352 C264,352 252,336 252,310 " +
  "L252,204 C252,180 266,170 271,152 C276,128 280,94 316,92 Z";

/**
 * GCSE plant cell: cell wall, cell membrane, cytoplasm, nucleus, chloroplasts, permanent vacuole,
 * mitochondria, ribosomes. Rectangular cell with a thick wall and the membrane pressed just inside it.
 */
export const plantCell: PartsDiagramDef = {
  name: "plant-cell",
  title: "Plant cell",
  viewBox: "0 0 620 440",
  parts: [
    {
      id: "cytoplasm",
      label: "Cytoplasm",
      shape: <rect x={184} y={40} width={252} height={360} rx={14} fill="#fde9da" />,
      anchor: [218, 252],
      labelAt: [152, 250],
      align: "end",
    },
    {
      id: "permanent-vacuole",
      label: "Permanent vacuole",
      aliases: ["vacuole"],
      shape: <path d={VACUOLE} fill="#dcecf3" stroke={NAVY} strokeWidth={2.2} />,
      anchor: [364, 226],
      labelAt: [468, 222],
      align: "start",
    },
    {
      id: "cell-wall",
      label: "Cell wall",
      shape: (
        <g>
          <rect x={178} y={34} width={264} height={372} rx={20} fill="none" stroke="#d3e6b5" strokeWidth={12} />
          <rect x={172} y={28} width={276} height={384} rx={26} fill="none" stroke={NAVY} strokeWidth={3} />
          <rect x={184} y={40} width={252} height={360} rx={14} fill="none" stroke={NAVY} strokeWidth={1.4} />
        </g>
      ),
      hit: <rect x={174} y={30} width={272} height={380} rx={24} fill="none" stroke="transparent" strokeWidth={20} />,
      anchor: [442, 84],
      labelAt: [468, 64],
      align: "start",
    },
    {
      id: "cell-membrane",
      label: "Cell membrane",
      aliases: ["membrane", "plasma membrane"],
      shape: <rect x={189} y={45} width={242} height={350} rx={9} fill="none" stroke={NAVY} strokeWidth={2.4} />,
      hit: <rect x={192} y={48} width={236} height={344} rx={7} fill="none" stroke="transparent" strokeWidth={14} />,
      anchor: [431, 118],
      labelAt: [468, 118],
      align: "start",
    },
    {
      id: "nucleus",
      label: "Nucleus",
      shape: (
        <g>
          <circle cx={226} cy={122} r={30} fill="#cddcf2" stroke={NAVY} strokeWidth={3} />
          <circle cx={232} cy={116} r={10} fill="#8fa9d9" stroke={NAVY} strokeWidth={1.5} />
        </g>
      ),
      anchor: [205, 114],
      labelAt: [152, 106],
      align: "end",
    },
    {
      id: "mitochondria",
      label: "Mitochondria",
      aliases: ["mitochondrion"],
      shape: (
        <g>
          <Mitochondrion x={221} y={318} angle={90} />
          <Mitochondrion x={240} y={66} angle={-8} />
        </g>
      ),
      anchor: [219, 310],
      labelAt: [152, 312],
      align: "end",
    },
    {
      id: "chloroplasts",
      label: "Chloroplasts",
      aliases: ["chloroplast"],
      shape: (
        <g>
          {CHLOROPLASTS.map(([x, y, a]) => (
            <Chloroplast key={`${x}-${y}`} x={x} y={y} angle={a} />
          ))}
        </g>
      ),
      hit: (
        <g>
          {CHLOROPLASTS.map(([x, y, a]) => (
            <ellipse key={`${x}-${y}`} rx={24} ry={14} transform={`translate(${x} ${y}) rotate(${a})`} fill="transparent" />
          ))}
        </g>
      ),
      anchor: [216, 180],
      labelAt: [152, 178],
      align: "end",
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
      anchor: [404, 366],
      labelAt: [468, 334],
      align: "start",
    },
  ],
};
