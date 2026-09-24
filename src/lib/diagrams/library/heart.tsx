import type { PartsDiagramDef } from "../types";

const NAVY = "#0b1e3c";
const MUSCLE = "#edd3ca";
/** Deoxygenated blood (right side of the heart) and oxygenated blood (left side), in soft tones. */
const BLUE = "#b7cdef";
const BLUE_END = "#8eaede";
const RED = "#f3aca8";
const RED_END = "#e2847f";
const FLAP = "#fffaf1";

/**
 * A chamber is a muscle region plus its cavity of blood. Only the outside edge of the heart is outlined,
 * so neighbouring regions (e.g. the two sides of the septum) read as one continuous wall of muscle.
 */
function Chamber({ region, cavity, edge, blood }: { region: string; cavity: string; edge: string; blood: string }) {
  return (
    <g>
      <path d={region} fill={MUSCLE} />
      <path d={cavity} fill={blood} />
      <path d={edge} fill="none" stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function Flap({ d }: { d: string }) {
  return <path d={d} fill={FLAP} stroke={NAVY} strokeWidth={1.6} strokeLinejoin="round" />;
}

/** Aorta: rises from the left ventricle, arches over the pulmonary artery and descends behind the heart. */
const AORTA_FILL =
  "M302,254 L302,108 A74,74 0 0 1 450,108 L450,140 L416,140 L416,108 A40,40 0 0 0 336,108 L336,254 Z";
const AORTA_EDGE = "M302,254 L302,108 A74,74 0 0 1 450,108 L450,140 M416,140 L416,108 A40,40 0 0 0 336,108 L336,254";
/** Arteries to the head and arms leave the top of the arch. */
const AORTA_BRANCHES = [346, 376, 406];
const archTop = (x: number) => 108 - Math.sqrt(74 * 74 - (x - 376) ** 2);

/** Pulmonary artery: rises from the right ventricle (in front of the aorta) and splits to both lungs. */
const PA_FILL = "M264,254 L264,138 Q264,130 256,130 L170,130 L170,104 L394,104 L394,130 L308,130 Q300,130 300,138 L300,254 Z";
const PA_EDGE = "M264,254 L264,138 Q264,130 256,130 L170,130 M170,104 L394,104 M394,130 L308,130 Q300,130 300,138 L300,254";

const PULMONARY_VEINS = [182, 210];

const VALVE_SPOTS: [number, number][] = [
  [237, 266],
  [392, 266],
  [282, 250],
  [319, 250],
];

/**
 * GCSE human heart, front view: the heart's right side is on the left of the picture. Four chambers,
 * the septum, the main blood vessels and the valves. The left ventricle has the thickest wall.
 */
export const heart: PartsDiagramDef = {
  name: "heart",
  title: "The human heart",
  viewBox: "0 0 620 470",
  parts: [
    {
      id: "right-atrium",
      label: "Right atrium",
      shape: (
        <Chamber
          blood={BLUE}
          region="M172,252 L172,236 C164,216 162,196 168,178 C176,158 200,146 234,146 C268,146 298,156 306,176 L306,252 Z"
          cavity="M180,246 C172,226 171,202 176,184 C183,166 204,155 234,155 C262,155 288,163 298,180 L298,246 L262,246 L262,252 L212,252 L212,246 Z"
          edge="M172,236 C164,216 162,196 168,178 C176,158 200,146 234,146 C268,146 298,156 306,176"
        />
      ),
      anchor: [206, 200],
      labelAt: [150, 196],
      align: "end",
    },
    {
      id: "left-atrium",
      label: "Left atrium",
      shape: (
        <Chamber
          blood={RED}
          region="M306,252 L306,178 C314,162 342,156 374,156 C408,156 434,164 440,186 C444,208 442,234 436,252 Z"
          cavity="M314,246 L314,182 C322,169 346,165 374,165 C404,165 426,172 431,190 C435,208 434,230 429,246 L420,246 L420,252 L364,252 L364,246 Z"
          edge="M306,178 C314,162 342,156 374,156 C408,156 434,164 440,186 C444,208 442,234 436,252"
        />
      ),
      anchor: [400, 226],
      labelAt: [490, 236],
      align: "start",
    },
    {
      id: "right-ventricle",
      label: "Right ventricle",
      shape: (
        <Chamber
          blood={BLUE}
          region="M196,250 L306,250 L320,429.5 L311.7,427.2 C273.4,417.7 234.4,395.6 212,362 C198,338 196,296 196,250 Z"
          cavity="M205,258 L212,258 L212,249 L262,249 L262,258 L266,258 L266,249 L296,249 C301,300 303,350 296,390 C288,402 252,390 226,358 C212,336 205,298 205,258 Z"
          edge="M311.7,427.2 C273.4,417.7 234.4,395.6 212,362 C198,338 196,296 196,250"
        />
      ),
      anchor: [244, 330],
      labelAt: [150, 330],
      align: "end",
    },
    {
      id: "left-ventricle",
      label: "Left ventricle",
      shape: (
        <Chamber
          blood={RED}
          region="M298,250 L450,250 C458,300 448,370 416,404 C396,424 366,434 340,432 C330.8,431.2 321.3,429.6 311.7,427.2 L298,250 Z"
          cavity="M310,249 L336,249 L336,258 L364,258 L364,249 L418,249 L418,258 L426,258 C432,300 424,352 398,384 C380,402 356,410 332,404 C322,360 314,300 310,249 Z"
          edge="M436,250 L450,250 C458,300 448,370 416,404 C396,424 366,434 340,432 C330.8,431.2 321.3,429.6 311.7,427.2"
        />
      ),
      anchor: [384, 340],
      labelAt: [490, 346],
      align: "start",
    },
    {
      id: "aorta",
      label: "Aorta",
      shape: (
        <g>
          <path d={AORTA_FILL} fill={RED} />
          <path d={AORTA_EDGE} fill="none" stroke={NAVY} strokeWidth={2.5} />
          {AORTA_BRANCHES.map((x) => (
            <g key={x}>
              <rect x={x - 5} y={20} width={10} height={archTop(x) - 16} fill={RED} />
              <path d={`M${x - 5},20 V${archTop(x - 5)} M${x + 5},20 V${archTop(x + 5)}`} stroke={NAVY} strokeWidth={2} />
              <ellipse cx={x} cy={20} rx={5} ry={2.5} fill={RED_END} stroke={NAVY} strokeWidth={1.5} />
            </g>
          ))}
          <ellipse cx={433} cy={140} rx={17} ry={5} fill={RED_END} stroke={NAVY} strokeWidth={2} />
        </g>
      ),
      anchor: [416, 68],
      labelAt: [490, 44],
      align: "start",
    },
    {
      id: "pulmonary-artery",
      label: "Pulmonary artery",
      aliases: ["pulmonary arteries"],
      shape: (
        <g>
          <path d={PA_FILL} fill={BLUE} />
          <path d={PA_EDGE} fill="none" stroke={NAVY} strokeWidth={2.5} />
          <ellipse cx={170} cy={117} rx={5} ry={13} fill={BLUE_END} stroke={NAVY} strokeWidth={2} />
          <ellipse cx={394} cy={117} rx={5} ry={13} fill={BLUE_END} stroke={NAVY} strokeWidth={2} />
        </g>
      ),
      anchor: [181, 117],
      labelAt: [150, 118],
      align: "end",
    },
    {
      id: "vena-cava",
      label: "Vena cava",
      aliases: ["venae cavae", "vena cavae"],
      shape: (
        <g>
          {/* Superior vena cava (from the head and arms) into the top of the right atrium. */}
          <rect x={190} y={34} width={36} height={136} fill={BLUE} />
          <path d="M190,34 V155 M226,34 V146" stroke={NAVY} strokeWidth={2.5} />
          <ellipse cx={208} cy={34} rx={18} ry={5} fill={BLUE_END} stroke={NAVY} strokeWidth={2} />
          {/* Inferior vena cava (from the lower body) into the bottom of the right atrium. */}
          <rect x={172} y={236} width={24} height={62} fill={BLUE} />
          <path d="M172,236 V298 M196,250 V298" stroke={NAVY} strokeWidth={3} />
          <ellipse cx={184} cy={298} rx={12} ry={4} fill={BLUE_END} stroke={NAVY} strokeWidth={2} />
        </g>
      ),
      anchor: [208, 66],
      labelAt: [150, 60],
      align: "end",
    },
    {
      id: "pulmonary-vein",
      label: "Pulmonary vein",
      aliases: ["pulmonary veins"],
      shape: (
        <g>
          {PULMONARY_VEINS.map((y) => (
            <g key={y}>
              <rect x={428} y={y - 8} width={46} height={16} fill={RED} />
              <path d={`M439,${y - 8} H474 M441,${y + 8} H474`} stroke={NAVY} strokeWidth={2.5} />
              <ellipse cx={474} cy={y} rx={4} ry={8} fill={RED_END} stroke={NAVY} strokeWidth={2} />
            </g>
          ))}
        </g>
      ),
      hit: <rect x={440} y={168} width={42} height={56} fill="transparent" />,
      anchor: [464, 182],
      labelAt: [490, 156],
      align: "start",
    },
    {
      id: "valves",
      label: "Valves",
      aliases: ["valve", "heart valves"],
      shape: (
        <g>
          {/* Tricuspid valve: right atrium to right ventricle. */}
          <Flap d="M212,249 C222,256 230,268 234,282 C224,276 214,266 212,258 Z" />
          <Flap d="M262,249 C252,256 244,268 240,282 C250,276 260,266 262,258 Z" />
          {/* Bicuspid (mitral) valve: left atrium to left ventricle. */}
          <Flap d="M364,249 C374,256 382,268 386,282 C376,276 366,266 364,258 Z" />
          <Flap d="M420,249 C410,256 402,268 398,282 C408,276 418,266 420,258 Z" />
          {/* Semilunar valves at the base of the pulmonary artery and the aorta. */}
          <Flap d="M265,244 Q273,258 282,244 Z" />
          <Flap d="M282,244 Q291,258 299,244 Z" />
          <Flap d="M303,244 Q311,258 319,244 Z" />
          <Flap d="M319,244 Q327,258 335,244 Z" />
        </g>
      ),
      hit: (
        <g>
          {VALVE_SPOTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={14} fill="transparent" />
          ))}
        </g>
      ),
      anchor: [412, 264],
      labelAt: [490, 286],
      align: "start",
    },
  ],
  overlay: (
    <text
      x={310}
      y={460}
      textAnchor="middle"
      fontSize={13}
      fontStyle="italic"
      fill="#51607a"
      fontFamily="var(--font-inter), system-ui, sans-serif"
      pointerEvents="none"
    >
      Left and right are the person&apos;s own sides
    </text>
  ),
};
