"use client";

import { useMemo, useState } from "react";
import { scrambled } from "@/lib/tutor/activities";
import type { DiagramMode, PartsDiagramDef } from "@/lib/diagrams/types";

const LABEL_FONT = 15;

function matches(part: { id: string; label: string; aliases?: string[] }, name: string) {
  const n = name.trim().toLowerCase();
  return part.id === n || part.label.toLowerCase() === n || (part.aliases ?? []).some((a) => a.toLowerCase() === n);
}

/**
 * Renders a parts diagram (cells, organs…). Modes:
 * - labelled: every part labelled; highlighted parts glow gold.
 * - blank: no labels (for "what is this part?" discussion).
 * - quiz: "tap the ___" — the student finds each part; labels appear as they're found.
 */
export function PartsDiagram({
  def,
  highlight,
  mode,
  ask,
  interactive,
  onDone,
}: {
  def: PartsDiagramDef;
  highlight: string[];
  mode: DiagramMode;
  ask?: string[];
  interactive: boolean;
  onDone?: (message: string) => void;
}) {
  const highlighted = new Set(def.parts.filter((p) => highlight.some((h) => matches(p, h))).map((p) => p.id));
  const questions = useMemo(() => {
    const ids = ask?.length ? def.parts.filter((p) => ask.some((a) => matches(p, a))).map((p) => p.id) : def.parts.map((p) => p.id);
    return ids.length > 1 ? scrambled(ids) : ids;
  }, [ask, def.parts]);

  const quiz = mode === "quiz" && interactive;
  const [step, setStep] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<{ wanted: string; tapped: string }[]>([]);
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const done = quiz && step >= questions.length;
  const partById = (id: string) => def.parts.find((p) => p.id === id)!;

  const tap = (id: string) => {
    if (!quiz || done) return;
    const wanted = questions[step];
    if (id === wanted) {
      setFound((f) => [...f, id]);
      setFlash({ id, ok: true });
      const next = step + 1;
      setStep(next);
      if (next >= questions.length) {
        const wrongFirst = new Set(mistakes.map((m) => m.wanted));
        const firstTime = questions.filter((q) => !wrongFirst.has(q)).length;
        const detail = mistakes.length
          ? ` I mixed up: ${mistakes.map((m) => `${partById(m.wanted).label.toLowerCase()} (tapped ${partById(m.tapped).label.toLowerCase()})`).join(", ")}.`
          : "";
        onDone?.(`Labelling quiz on "${def.title}": ${firstTime} of ${questions.length} first time.${detail}`);
      }
    } else {
      setMistakes((m) => [...m, { wanted, tapped: id }]);
      setFlash({ id, ok: false });
    }
    window.setTimeout(() => setFlash(null), 1100);
  };

  const showLabel = (id: string) => mode === "labelled" || (mode === "quiz" && (!interactive || found.includes(id)));
  const [, , vbW] = def.viewBox.split(" ").map(Number);

  return (
    <figure className="my-3 rounded-xl border border-navy-100 bg-white p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-navy">{def.title}</span>
        {quiz && !done && (
          <span className="rounded-full bg-gold-50 px-3 py-1 font-semibold text-navy" aria-live="polite">
            Tap the <strong>{partById(questions[step]).label.toLowerCase()}</strong> ({step + 1} of {questions.length})
          </span>
        )}
        {quiz && done && (
          <span className="rounded-full bg-green-50 px-3 py-1 font-semibold text-green-800" aria-live="polite">
            Found them all: {questions.length - new Set(mistakes.map((m) => m.wanted)).size} of {questions.length} first time
          </span>
        )}
      </figcaption>
      <svg viewBox={def.viewBox} className="h-auto w-full select-none" role="img" aria-label={`${def.title} diagram`}>
        {def.parts.map((part) => {
          const isHighlighted = highlighted.has(part.id);
          const isFlash = flash?.id === part.id;
          return (
            <g
              key={part.id}
              data-part={part.id}
              onClick={() => tap(part.id)}
              className={`transition-[filter] duration-300 ${quiz && !done ? "cursor-pointer" : ""}`}
              style={{
                filter: isFlash
                  ? `drop-shadow(0 0 5px ${flash!.ok ? "#16a34a" : "#dc2626"}) drop-shadow(0 0 2px ${flash!.ok ? "#16a34a" : "#dc2626"})`
                  : isHighlighted
                    ? "drop-shadow(0 0 5px #c19a3e) drop-shadow(0 0 2px #c19a3e)"
                    : undefined,
              }}
            >
              <title>{quiz && !done && !found.includes(part.id) ? "?" : part.label}</title>
              {part.shape}
              {part.hit}
            </g>
          );
        })}
        {def.overlay}
        {def.parts.map((part) => {
          if (!showLabel(part.id)) return null;
          const [ax, ay] = part.anchor;
          const [lx, ly] = part.labelAt;
          const isHighlighted = highlighted.has(part.id);
          const colour = isHighlighted ? "#7d6325" : quiz && found.includes(part.id) ? "#15803d" : "#0b1e3c";
          const lineStart = part.align === "end" ? lx + 6 : lx - 6;
          return (
            <g key={`label-${part.id}`} pointerEvents="none">
              <line x1={lineStart} y1={ly - LABEL_FONT / 3} x2={ax} y2={ay} stroke={colour} strokeWidth={1.4} />
              <circle cx={ax} cy={ay} r={2.5} fill={colour} />
              <text
                x={lx}
                y={ly}
                fontSize={LABEL_FONT}
                fontWeight={isHighlighted ? 700 : 500}
                textAnchor={part.align}
                fill={colour}
                fontFamily="var(--font-inter), system-ui, sans-serif"
              >
                {part.label}
              </text>
            </g>
          );
        })}
        {flash && !flash.ok && (
          <text x={vbW / 2} y={24} textAnchor="middle" fontSize={15} fontWeight={700} fill="#b91c1c" pointerEvents="none">
            That&apos;s the {partById(flash.id).label.toLowerCase()}
          </text>
        )}
      </svg>
    </figure>
  );
}
