"use client";

import { useMemo } from "react";
import { PartsDiagram } from "@/components/diagrams/parts-diagram";
import { parseDiagramSpec } from "@/lib/diagrams/spec";

/** Renders a ```diagram block from the library, or a quiet note if it can't be drawn. */
export function DiagramView({ json, pending, interactive, onDone }: { json: string; pending: boolean; interactive: boolean; onDone?: (m: string) => void }) {
  const parsed = useMemo(() => (pending ? null : parseDiagramSpec(json)), [json, pending]);
  if (pending) {
    return <div className="my-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-navy-100 text-xs text-muted">Drawing diagram…</div>;
  }
  if (!parsed || "error" in parsed) {
    return <p className="my-3 text-xs italic text-muted">(The diagram couldn&apos;t be shown. Ask the tutor to try again.)</p>;
  }
  const { entry, spec } = parsed;
  if (entry.kind === "parts") {
    return (
      <div data-visual>
        <PartsDiagram def={entry.def} highlight={spec.highlight} mode={spec.mode} ask={spec.ask} interactive={interactive} onDone={onDone} />
      </div>
    );
  }
  const { Component } = entry;
  return (
    <div data-visual>
      <Component spec={spec.raw} highlight={spec.highlight} mode={spec.mode} interactive={interactive} onDone={onDone} />
    </div>
  );
}
