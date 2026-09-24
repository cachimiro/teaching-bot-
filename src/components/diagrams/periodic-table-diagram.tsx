"use client";

import { useState, type KeyboardEvent } from "react";
import type { CustomDiagramProps } from "@/lib/diagrams/types";
import { ELEMENTS, electronConfig, findElement, formatMass, massIsBracketed, massNumber, type ChemicalElement, type ElementCategory } from "@/lib/diagrams/data/elements";
import {
  CATEGORY_STYLE,
  CH,
  CW,
  F_TOP,
  GAP,
  LEFT,
  TABLE_H,
  TABLE_W,
  TOP,
  cellPosition,
  colX,
  groupText,
  highlightMatcher,
  rowY,
  typeText,
  type Matcher,
} from "@/lib/diagrams/library/periodic-table-model";

const NAVY = "#0b1e3c";
const GOLD = "#c19a3e";
const FONT = "var(--font-inter), system-ui, sans-serif";
const GLOW = `drop-shadow(0 0 4px ${GOLD}) drop-shadow(0 0 2px ${GOLD})`;

function InfoPanel({ el }: { el: ChemicalElement }) {
  const config = electronConfig(el.z);
  const n = massNumber(el.z) - el.z;
  const facts: [string, string][] = [
    ["Atomic number", String(el.z)],
    ["Relative atomic mass", formatMass(el)],
    ["Group", groupText(el)],
    ["Period", String(el.period)],
    ["Type", typeText(el)],
  ];
  if (config) facts.push(["Electron configuration", config.join(",")]);
  facts.push(["In one atom", `${el.z} proton${el.z === 1 ? "" : "s"}, ${el.z} electron${el.z === 1 ? "" : "s"}, ${n} neutron${n === 1 ? "" : "s"}`]);
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-[4.5rem] w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-navy-200 text-navy"
        style={{ background: CATEGORY_STYLE[el.category].fill }}
        aria-hidden
      >
        <span className="text-[11px] leading-none">{el.z}</span>
        <span className="text-2xl font-bold leading-tight">{el.symbol}</span>
        <span className="text-[11px] leading-none">{formatMass(el)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy">
          {el.name} <span className="font-normal text-muted">({el.symbol})</span>
        </p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium text-navy">{v}</dd>
            </div>
          ))}
        </dl>
        {massIsBracketed(el.z) && <p className="mt-1 text-xs text-muted">Mass in [ ] brackets: no stable isotope, so this is the mass number of its longest-lived isotope.</p>}
      </div>
    </div>
  );
}

// ---------- the table ----------

/** A key in the empty space above the transition metals: the chosen element (sodium until one is tapped). */
function KeyTile({ el }: { el: ChemicalElement }) {
  const x = colX(3) + 36;
  const y = rowY(1) + 6;
  const w = 118;
  const h = 3 * (CH + GAP) - GAP - 12;
  const lx = x + w + 30;
  const rows: [string, number][] = [
    ["atomic (proton) number", y + 24],
    ["symbol", y + 72],
    ["name", y + 104],
    ["relative atomic mass", y + 128],
  ];
  return (
    <g pointerEvents="none" fontFamily={FONT}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={CATEGORY_STYLE[el.category].fill} stroke={NAVY} strokeWidth={2} />
      <text x={x + 10} y={y + 24} fontSize={17} fontWeight={600} fill={NAVY}>
        {el.z}
      </text>
      <text x={x + w / 2} y={y + 80} fontSize={46} fontWeight={700} textAnchor="middle" fill={NAVY}>
        {el.symbol}
      </text>
      <text x={x + w / 2} y={y + 104} fontSize={el.name.length > 11 ? 12 : 15} textAnchor="middle" fill={NAVY}>
        {el.name}
      </text>
      <text x={x + w / 2} y={y + 128} fontSize={15} textAnchor="middle" fill={NAVY}>
        {formatMass(el)}
      </text>
      {rows.map(([label, ty]) => (
        <g key={label}>
          <line x1={x + w + 4} y1={ty - 5} x2={lx - 6} y2={ty - 5} stroke="#a7bbd9" strokeWidth={1.2} />
          <text x={lx} y={ty} fontSize={14} fill="#5b6675">
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}

function Cell({
  el,
  state,
  selected,
  onSelect,
}: {
  el: ChemicalElement;
  state: "normal" | "lit" | "faded";
  selected: boolean;
  onSelect: (z: number) => void;
}) {
  const { x, y } = cellPosition(el);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(el.z);
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${el.name}, ${el.symbol}, atomic number ${el.z}`}
      aria-pressed={selected}
      onClick={() => onSelect(el.z)}
      onKeyDown={onKey}
      className="group cursor-pointer outline-none"
      opacity={state === "faded" ? 0.28 : 1}
      style={{ filter: state === "lit" ? GLOW : undefined }}
    >
      <rect
        x={x}
        y={y}
        width={CW}
        height={CH}
        rx={5}
        fill={CATEGORY_STYLE[el.category].fill}
        stroke={state === "lit" ? GOLD : "#8fa3c4"}
        strokeWidth={state === "lit" ? 3 : 1}
        className="transition-[stroke] group-hover:stroke-navy group-focus-visible:stroke-navy group-focus-visible:stroke-[3px]"
      />
      <text x={x + 4} y={y + 12} fontSize={10.5} fill="#3b4a60" className="max-sm:hidden">
        {el.z}
      </text>
      <text x={x + CW / 2} y={y + CH / 2 + 11} fontSize={25} fontWeight={700} textAnchor="middle" fill={NAVY}>
        {el.symbol}
      </text>
    </g>
  );
}

/** The full periodic table: category colours, UK group numbers, highlights, and tap-for-details. */
export function PeriodicTable({ spec, highlight }: CustomDiagramProps) {
  const matchers = highlight.map(highlightMatcher).filter((m): m is Matcher => typeof m === "function");
  const litSet = new Set(ELEMENTS.filter((e) => matchers.some((m) => m(e))).map((e) => e.z));
  const initial =
    (typeof spec.select === "string" || typeof spec.select === "number" ? findElement(spec.select)?.z : undefined) ??
    (litSet.size === 1 ? [...litSet][0] : null);
  const [selected, setSelected] = useState<number | null>(initial);
  const chosen = selected ? ELEMENTS[selected - 1] : null;
  const anyLit = litSet.size > 0;

  const groupHeads: [number, string][] = [
    [1, "1"],
    [2, "2"],
    [13, "3"],
    [14, "4"],
    [15, "5"],
    [16, "6"],
    [17, "7"],
    [18, "0"],
  ];
  const categories = Object.entries(CATEGORY_STYLE) as [ElementCategory, { fill: string; label: string }][];
  const aria = `Periodic table${anyLit ? `, highlighting ${highlight.join(", ")}` : ""}${chosen ? `. Selected: ${chosen.name}` : ""}`;

  return (
    <figure className="my-3 rounded-xl border border-navy-100 bg-white p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-navy">Periodic table</span>
        {anyLit && (
          <span className="rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-navy">Highlighted: {highlight.join(", ")}</span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${TABLE_W} ${TABLE_H}`} className="h-auto w-full select-none" role="group" aria-label={aria} fontFamily={FONT}>
        {/* UK group numbers along the top, period numbers down the side. */}
        {groupHeads.map(([col, label]) => (
          <text key={col} x={colX(col) + CW / 2} y={TOP - 9} fontSize={16} fontWeight={700} textAnchor="middle" fill={NAVY}>
            {label}
          </text>
        ))}
        <text x={colX(3) + ((CW + GAP) * 10 - GAP) / 2} y={TOP - 9} fontSize={12} textAnchor="middle" fill="#5b6675" className="max-sm:hidden">
          Group numbers (UK): 1–7 and 0
        </text>
        {[1, 2, 3, 4, 5, 6, 7].map((p) => (
          <text key={p} x={LEFT - 8} y={rowY(p) + CH / 2 + 5} fontSize={14} fontWeight={600} textAnchor="middle" fill="#5b6675">
            {p}
          </text>
        ))}

        <KeyTile el={chosen ?? ELEMENTS[10]} />

        {/* The lanthanide and actinide rows sit below the main table. */}
        <text x={colX(4) - 8} y={F_TOP + CH / 2 + 5} fontSize={13} textAnchor="end" fill="#5b6675">
          Lanthanides
        </text>
        <text x={colX(4) - 8} y={F_TOP + CH + GAP + CH / 2 + 5} fontSize={13} textAnchor="end" fill="#5b6675">
          Actinides
        </text>

        {ELEMENTS.map((el) => (
          <Cell
            key={el.z}
            el={el}
            state={anyLit ? (litSet.has(el.z) ? "lit" : "faded") : "normal"}
            selected={selected === el.z}
            onSelect={(z) => setSelected((s) => (s === z ? null : z))}
          />
        ))}

        {/* Selected element: a bold navy outline drawn on top. */}
        {chosen && (
          <rect
            {...cellPosition(chosen)}
            width={CW}
            height={CH}
            rx={5}
            fill="none"
            stroke={NAVY}
            strokeWidth={3.5}
            pointerEvents="none"
          />
        )}
      </svg>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-navy" aria-label="Key to colours">
        {categories.map(([cat, { fill, label }]) => (
          <li key={cat} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-navy-200" style={{ background: fill }} />
            {label}
          </li>
        ))}
      </ul>

      <div className="mt-2 rounded-lg bg-paper p-3 text-sm" aria-live="polite">
        {chosen ? <InfoPanel el={chosen} /> : <p className="text-muted">Tap an element to see its details.</p>}
      </div>
    </figure>
  );
}

