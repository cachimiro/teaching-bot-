"use client";

import { useEffect, useId, useState } from "react";

type MermaidApi = typeof import("mermaid").default;
let mermaidPromise: Promise<MermaidApi> | null = null;

/** Loads Mermaid only when a reply actually contains a diagram. */
function loadMermaid() {
  mermaidPromise ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      themeVariables: {
        primaryColor: "#eef2f8",
        primaryBorderColor: "#0b1e3c",
        primaryTextColor: "#1a2230",
        lineColor: "#3f63a0",
        secondaryColor: "#faf6ec",
        tertiaryColor: "#ffffff",
        pie1: "#0b1e3c",
        pie2: "#c19a3e",
        pie3: "#3f63a0",
        pie4: "#d4b566",
        pie5: "#a7bbd9",
        xyChart: { plotColorPalette: "#0b1e3c, #c19a3e, #3f63a0" },
      },
    });
    return mermaid;
  });
  return mermaidPromise;
}

/** Renders a mermaid diagram from the tutor as an inline SVG. */
export function MermaidDiagram({ code, pending }: { code: string; pending: boolean }) {
  const id = `diagram-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    loadMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then(({ svg }) => !cancelled && setSvg(svg))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [code, id, pending]);

  if (failed) return <p className="my-3 text-xs italic text-muted">(The diagram couldn&apos;t be drawn. Ask the tutor to try again.)</p>;
  if (!svg) {
    return (
      <div className="my-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-navy-100 text-xs text-muted">
        Drawing diagram…
      </div>
    );
  }
  // Safe to inject: securityLevel "strict" makes Mermaid sanitise its SVG output with DOMPurify.
  return (
    <div
      className="my-3 overflow-x-auto rounded-xl border border-navy-100 bg-white p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      role="img"
      aria-label="Diagram from your tutor"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
