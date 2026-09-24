"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { GALLERY_SAMPLES } from "./samples";

/** Development-only page showing every visual and activity, for visual checks and browser tests. */
export function Gallery() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">Visuals gallery</h1>
      {GALLERY_SAMPLES.map((sample) => (
        <section key={sample.id} id={sample.id} data-sample={sample.id} className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{sample.title}</h2>
          <Markdown interactive onActivity={(m) => setLog((l) => [...l, `${sample.id}: ${m}`])}>
            {sample.markdown}
          </Markdown>
        </section>
      ))}
      <section className="rounded-2xl bg-navy p-5 text-sm text-white">
        <h2 className="font-bold">Messages that would be sent to the tutor</h2>
        <ol id="activity-log" className="mt-2 list-decimal space-y-1 pl-5">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
