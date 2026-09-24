import type { PartsDiagramDef } from "../types";

const NAVY = "#0b1e3c";

/** Mitochondrion: outer oval with folded inner membrane (cristae). */
function Mitochondrion({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <ellipse rx={34} ry={16} fill="#f6c6c6" stroke={NAVY} strokeWidth={2.5} />
      <path d="M-24,0 q6,-10 12,0 t12,0 t12,0 t12,0" fill="none" stroke={NAVY} strokeWidth={1.6} />
    </g>
  );
}

const RIBOSOMES: [number, number][] = [
  [238, 104],
  [255, 118],
  [384, 128],
  [398, 140],
  [420, 214],
  [262, 308],
  [278, 318],
  [176, 214],
];

/** GCSE animal cell: cell membrane, cytoplasm, nucleus, mitochondria, ribosomes. */
export const animalCell: PartsDiagramDef = {
  name: "animal-cell",
  title: "Animal cell",
  viewBox: "0 0 620 410",
  parts: [
    {
      id: "cytoplasm",
      label: "Cytoplasm",
      shape: <ellipse cx={310} cy={205} rx={178} ry={150} fill="#fde9da" />,
      anchor: [205, 292],
      labelAt: [112, 300],
      align: "end",
    },
    {
      id: "cell-membrane",
      label: "Cell membrane",
      aliases: ["membrane", "plasma membrane"],
      shape: <ellipse cx={310} cy={205} rx={178} ry={150} fill="none" stroke={NAVY} strokeWidth={4} />,
      hit: <ellipse cx={310} cy={205} rx={178} ry={150} fill="none" stroke="transparent" strokeWidth={18} />,
      anchor: [446, 109],
      labelAt: [508, 92],
      align: "start",
    },
    {
      id: "nucleus",
      label: "Nucleus",
      shape: (
        <g>
          <circle cx={310} cy={205} r={58} fill="#cddcf2" stroke={NAVY} strokeWidth={3} />
          <circle cx={318} cy={198} r={19} fill="#8fa9d9" stroke={NAVY} strokeWidth={1.5} />
        </g>
      ),
      anchor: [366, 218],
      labelAt: [508, 238],
      align: "start",
    },
    {
      id: "mitochondria",
      label: "Mitochondria",
      aliases: ["mitochondrion"],
      shape: (
        <g>
          <Mitochondrion x={206} y={146} angle={-25} />
          <Mitochondrion x={402} y={284} angle={20} />
        </g>
      ),
      anchor: [178, 158],
      labelAt: [112, 130],
      align: "end",
    },
    {
      id: "ribosomes",
      label: "Ribosomes",
      aliases: ["ribosome"],
      shape: (
        <g>
          {RIBOSOMES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={5} fill="#3f63a0" stroke={NAVY} strokeWidth={1} />
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
      anchor: [262, 308],
      labelAt: [112, 360],
      align: "end",
    },
  ],
};
