import type { PartsDiagramDef } from "../types";

const NAVY = "#0b1e3c";
const CHLOROPLAST = "#4f9a45";
const AIR = "#eef5fa";

/** Leaf block edges and layer boundaries (y). */
const LEFT = 176;
const RIGHT = 444;
const CUTICLE_TOP = 54;
const UPPER_EPI_TOP = 62;
const PALISADE_TOP = 92;
const SPONGY_TOP = 196;
const LOWER_EPI_TOP = 332;
const LOWER_EPI_BOTTOM = 356;

/** Stomata (pore centres) in the lower epidermis; each has a guard cell either side. */
const STOMATA = [236, 404];
const GUARD_Y = 344;
const GUARD_OFFSET = 15;

/** A smooth, slightly irregular closed outline (Catmull-Rom through jittered points on an ellipse). */
function blob(cx: number, cy: number, rx: number, ry: number, rot: number, seed: number): string {
  const n = 8;
  const a = (rot * Math.PI) / 180;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const r = 1 + 0.08 * Math.sin(seed * 7.3 + i * 2.1);
    const x = rx * r * Math.cos(t);
    const y = ry * r * Math.sin(t);
    pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  const p = (i: number) => pts[(i + n) % n];
  let d = `M${p(0)[0].toFixed(1)},${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** Spongy mesophyll cells: [cx, cy, rx, ry, rotation]. Loosely packed so air spaces show between them. */
const SPONGY_CELLS: [number, number, number, number, number][] = [
  [200, 217, 20, 14, 8],
  [248, 220, 21, 15, -10],
  [292, 214, 19, 13, 12],
  [336, 214, 20, 13, -4],
  [380, 214, 19, 13, 10],
  [422, 210, 16, 10, -4],
  [200, 252, 20, 15, 4],
  [248, 262, 22, 17, 14],
  [287, 262, 11, 17, 0],
  [410, 258, 16, 10, -12],
  [196, 316, 17, 12, -6],
  [284, 312, 22, 14, 6],
  [334, 314, 19, 12, -3],
  [372, 312, 11, 14, 0],
  [433, 300, 8, 13, 0],
];
const SPONGY_PATHS = SPONGY_CELLS.map(([cx, cy, rx, ry, rot], i) => blob(cx, cy, rx, ry, rot, i + 1));

/** Vein (vascular bundle): xylem on the upper side, phloem on the lower side. */
const VEIN = { cx: 340, cy: 262, rx: 38, ry: 30 };
const XYLEM_VESSELS: [number, number, number][] = [
  [320, 254, 6.5],
  [336, 246, 8],
  [354, 246, 7.5],
  [368, 255, 5.5],
];
const PHLOEM_CELLS: [number, number, number][] = [
  [318, 270, 4],
  [330, 276, 4],
  [342, 270, 4],
  [354, 276, 4],
  [366, 270, 4],
  [334, 285, 3.5],
  [348, 285, 3.5],
];

/** Palisade cells: tall columns packed with chloroplasts. */
const PALISADE_COUNT = 11;
const PALISADE_W = (RIGHT - LEFT) / PALISADE_COUNT;
const PALISADE_X = Array.from({ length: PALISADE_COUNT }, (_, i) => LEFT + i * PALISADE_W);
const PALISADE_CHLOROPLAST_Y = [102, 117, 132, 147, 162, 177];

const UPPER_EPI_W = (RIGHT - LEFT) / 8;

/** Lower epidermis cells fill the gaps between the guard cells: [x, width]. */
const LOWER_EPI_CELLS: [number, number][] = [
  [LEFT, STOMATA[0] - GUARD_OFFSET - 10 - LEFT],
  ...Array.from({ length: 4 }, (_, i): [number, number] => {
    const from = STOMATA[0] + GUARD_OFFSET + 10;
    const w = (STOMATA[1] - GUARD_OFFSET - 10 - from) / 4;
    return [from + i * w, w];
  }),
  [STOMATA[1] + GUARD_OFFSET + 10, RIGHT - (STOMATA[1] + GUARD_OFFSET + 10)],
];

/** The pore between a pair of guard cells (just outside their outlines), open to the air space above. */
function porePath(px: number): string {
  const [l, r, rx, ry] = [px - GUARD_OFFSET, px + GUARD_OFFSET, 10.9, 12.9];
  return (
    `M${l},${GUARD_Y - ry} A${rx},${ry} 0 0 1 ${l + rx},${GUARD_Y} A${rx},${ry} 0 0 1 ${l},${GUARD_Y + ry} ` +
    `L${r},${GUARD_Y + ry} A${rx},${ry} 0 0 1 ${r - rx},${GUARD_Y} A${rx},${ry} 0 0 1 ${r},${GUARD_Y - ry} Z`
  );
}

/**
 * GCSE leaf cross-section: waxy cuticle, upper epidermis, palisade mesophyll, spongy mesophyll with
 * air spaces, a vein (xylem above phloem), lower epidermis with stomata and guard cells.
 */
export const leaf: PartsDiagramDef = {
  name: "leaf",
  title: "Leaf cross-section",
  viewBox: "0 0 620 420",
  parts: [
    {
      id: "palisade-mesophyll",
      label: "Palisade mesophyll",
      aliases: ["palisade", "palisade cells", "palisade layer"],
      shape: (
        <g>
          <rect x={LEFT} y={PALISADE_TOP} width={RIGHT - LEFT} height={SPONGY_TOP - PALISADE_TOP} fill="#e6f2da" />
          {PALISADE_X.map((x) => (
            <g key={x}>
              <rect x={x + 1.2} y={PALISADE_TOP + 2} width={PALISADE_W - 2.4} height={SPONGY_TOP - PALISADE_TOP - 4} rx={9} fill="#cde7b6" stroke={NAVY} strokeWidth={1.4} />
              {PALISADE_CHLOROPLAST_Y.flatMap((y) => [
                <ellipse key={`${y}-a`} cx={x + 7} cy={y} rx={3.6} ry={3} fill={CHLOROPLAST} />,
                <ellipse key={`${y}-b`} cx={x + PALISADE_W - 7} cy={y + 8} rx={3.6} ry={3} fill={CHLOROPLAST} />,
              ])}
            </g>
          ))}
        </g>
      ),
      anchor: [188, 146],
      labelAt: [158, 146],
      align: "end",
    },
    {
      id: "spongy-mesophyll",
      label: "Spongy mesophyll",
      aliases: ["spongy", "spongy layer", "spongy cells"],
      shape: (
        <g>
          {SPONGY_PATHS.map((d) => (
            <path key={d} d={d} fill="#e0f0d0" stroke={NAVY} strokeWidth={1.4} />
          ))}
          {SPONGY_CELLS.flatMap(([cx, cy, rx, ry]) => [
            <ellipse key={`${cx}-${cy}-a`} cx={cx - rx * 0.4} cy={cy - ry * 0.3} rx={3.4} ry={2.8} fill={CHLOROPLAST} />,
            <ellipse key={`${cx}-${cy}-b`} cx={cx + rx * 0.35} cy={cy + ry * 0.3} rx={3.4} ry={2.8} fill={CHLOROPLAST} />,
          ])}
        </g>
      ),
      anchor: [190, 248],
      labelAt: [158, 236],
      align: "end",
    },
    {
      id: "air-spaces",
      label: "Air spaces",
      aliases: ["air space"],
      shape: (
        <path
          d={`M${LEFT},${SPONGY_TOP} H${RIGHT} V${LOWER_EPI_TOP} H${LEFT} Z ${SPONGY_PATHS.join(" ")}`}
          fill={AIR}
          fillRule="evenodd"
        />
      ),
      anchor: [198, 286],
      labelAt: [158, 290],
      align: "end",
    },
    {
      id: "upper-epidermis",
      label: "Upper epidermis",
      shape: (
        <g>
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={LEFT + i * UPPER_EPI_W}
              y={UPPER_EPI_TOP}
              width={UPPER_EPI_W}
              height={PALISADE_TOP - UPPER_EPI_TOP}
              rx={3}
              fill="#f5f9ef"
              stroke={NAVY}
              strokeWidth={1.5}
            />
          ))}
        </g>
      ),
      anchor: [430, 78],
      labelAt: [462, 90],
      align: "start",
    },
    {
      id: "lower-epidermis",
      label: "Lower epidermis",
      shape: (
        <g>
          {LOWER_EPI_CELLS.map(([x, w]) => (
            <rect key={x} x={x} y={LOWER_EPI_TOP} width={w} height={LOWER_EPI_BOTTOM - LOWER_EPI_TOP} rx={3} fill="#f5f9ef" stroke={NAVY} strokeWidth={1.5} />
          ))}
        </g>
      ),
      anchor: [193, 344],
      labelAt: [158, 350],
      align: "end",
    },
    {
      id: "waxy-cuticle",
      label: "Waxy cuticle",
      aliases: ["cuticle"],
      shape: (
        <g>
          <rect x={LEFT} y={CUTICLE_TOP} width={RIGHT - LEFT} height={UPPER_EPI_TOP - CUTICLE_TOP} fill="#f1dc8b" stroke={NAVY} strokeWidth={1.5} />
          {/* A thinner cuticle on the lower surface, broken at each stoma. */}
          {[LEFT, ...STOMATA.map((px) => px + 5)].map((x, i) => {
            const end = i < STOMATA.length ? STOMATA[i] - 5 : RIGHT;
            return <rect key={x} x={x} y={LOWER_EPI_BOTTOM} width={end - x} height={3.5} fill="#f1dc8b" stroke={NAVY} strokeWidth={1} />;
          })}
        </g>
      ),
      hit: <rect x={LEFT} y={CUTICLE_TOP - 12} width={RIGHT - LEFT} height={20} fill="transparent" />,
      anchor: [430, 58],
      labelAt: [462, 46],
      align: "start",
    },
    {
      id: "xylem",
      label: "Xylem",
      shape: (
        <g>
          <path
            d={`M${VEIN.cx - VEIN.rx},${VEIN.cy} A${VEIN.rx},${VEIN.ry} 0 0 1 ${VEIN.cx + VEIN.rx},${VEIN.cy} Z`}
            fill="#cfdef3"
            stroke={NAVY}
            strokeWidth={2}
          />
          {XYLEM_VESSELS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#f7faff" stroke={NAVY} strokeWidth={2.2} />
          ))}
        </g>
      ),
      anchor: [368, 255],
      labelAt: [462, 222],
      align: "start",
    },
    {
      id: "phloem",
      label: "Phloem",
      shape: (
        <g>
          <path
            d={`M${VEIN.cx - VEIN.rx},${VEIN.cy} A${VEIN.rx},${VEIN.ry} 0 0 0 ${VEIN.cx + VEIN.rx},${VEIN.cy} Z`}
            fill="#f3d6b3"
            stroke={NAVY}
            strokeWidth={2}
          />
          {PHLOEM_CELLS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fcf1e3" stroke={NAVY} strokeWidth={1.2} />
          ))}
        </g>
      ),
      anchor: [362, 281],
      labelAt: [462, 278],
      align: "start",
    },
    {
      id: "guard-cells",
      label: "Guard cells",
      aliases: ["guard cell"],
      shape: (
        <g>
          {STOMATA.flatMap((px) =>
            [px - GUARD_OFFSET, px + GUARD_OFFSET].map((x) => (
              <g key={x}>
                <ellipse cx={x} cy={GUARD_Y} rx={10} ry={12} fill="#cde7b6" stroke={NAVY} strokeWidth={1.8} />
                <ellipse cx={x} cy={GUARD_Y - 5} rx={3} ry={2.5} fill={CHLOROPLAST} />
                <ellipse cx={x} cy={GUARD_Y + 5} rx={3} ry={2.5} fill={CHLOROPLAST} />
              </g>
            )),
          )}
        </g>
      ),
      hit: (
        <g>
          {STOMATA.flatMap((px) =>
            [px - GUARD_OFFSET - 1, px + GUARD_OFFSET + 1].map((x) => <circle key={x} cx={x} cy={GUARD_Y} r={13} fill="transparent" />),
          )}
        </g>
      ),
      anchor: [421, 342],
      labelAt: [462, 332],
      align: "start",
    },
    {
      id: "stomata",
      label: "Stomata",
      aliases: ["stoma"],
      shape: (
        <g>
          {STOMATA.map((px) => (
            <path key={px} d={porePath(px)} fill={AIR} />
          ))}
        </g>
      ),
      hit: (
        <g>
          {STOMATA.map((px) => (
            <circle key={px} cx={px} cy={LOWER_EPI_BOTTOM + 6} r={13} fill="transparent" />
          ))}
        </g>
      ),
      anchor: [404, 354],
      labelAt: [462, 388],
      align: "start",
    },
  ],
  overlay: (
    <path
      d={`M${LEFT},${SPONGY_TOP} V${LOWER_EPI_TOP} M${RIGHT},${SPONGY_TOP} V${LOWER_EPI_TOP}`}
      stroke={NAVY}
      strokeWidth={1.4}
      pointerEvents="none"
    />
  ),
};
