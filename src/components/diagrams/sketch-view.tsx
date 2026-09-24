"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { markCreditsStale } from "@/lib/credits/client";
import { canonicalSketch, parseSketchJson, type SketchSpec } from "@/lib/sketch/spec";

type Result = { svg: string } | { error: string };

/** One request per distinct sketch per page, however often the reply re-renders. */
const requests = new Map<string, Promise<Result>>();

function fetchSketch(spec: SketchSpec, topicId: string | undefined): Promise<Result> {
  const key = canonicalSketch(spec);
  let request = requests.get(key);
  if (!request) {
    request = fetch("/api/sketch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...spec, topicId }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { svg?: string; error?: string; cached?: boolean };
        if (res.ok && body.svg) {
          if (!body.cached) markCreditsStale();
          return { svg: body.svg };
        }
        requests.delete(key);
        return { error: body.error ?? "Couldn't draw that one." };
      })
      .catch(() => {
        requests.delete(key);
        return { error: "Couldn't draw that one." };
      });
    requests.set(key, request);
  }
  return request;
}

/** Moves the label columns clear of the drawing when it spills past its band. */
function placeLabelColumns(svg: SVGSVGElement) {
  const labels = [...svg.querySelectorAll<SVGGElement>("g.sketch-label")];
  if (labels.length === 0) return;
  const view = svg.viewBox.baseVal;
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const el of svg.children) {
    if (!(el instanceof SVGGraphicsElement) || el.classList.contains("sketch-labels")) continue;
    const b = el.getBBox();
    const background = el instanceof SVGRectElement && b.width >= view.width * 0.9 && b.height >= view.height * 0.9;
    if (background || (b.width === 0 && b.height === 0)) continue;
    x0 = Math.min(x0, b.x);
    x1 = Math.max(x1, b.x + b.width);
  }
  if (!Number.isFinite(x0)) return;
  const leftX = Math.min(160, Math.round(x0 - 14));
  const rightX = Math.max(460, Math.round(x1 + 14));
  for (const label of labels) {
    const left = label.dataset.side === "left";
    const x = left ? leftX : rightX;
    label.querySelector("line")?.setAttribute("x1", String(left ? x + 6 : x - 6));
    label.querySelectorAll("text, tspan").forEach((t) => t.setAttribute("x", String(x)));
  }
}

/** Widens the viewBox to take in anything drawn past the edges (a long label, say), so nothing is cut off. */
function fitToContent(svg: SVGSVGElement) {
  const view = svg.viewBox.baseVal;
  const drawn = svg.getBBox();
  if (!view || view.width === 0 || drawn.width === 0) return;
  const pad = 6;
  const x0 = Math.min(view.x, drawn.x - pad);
  const y0 = Math.min(view.y, drawn.y - pad);
  const x1 = Math.max(view.x + view.width, drawn.x + drawn.width + pad);
  const y1 = Math.max(view.y + view.height, drawn.y + drawn.height + pad);
  if (x0 < view.x || y0 < view.y || x1 > view.x + view.width || y1 > view.y + view.height) {
    svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  }
}

/**
 * Renders a ```sketch block: a tutor-drawn diagram for anything outside the built-in library.
 * Drawing starts as soon as the block's JSON is complete, even while the rest of the reply streams.
 */
export function SketchView({ json, pending, topicId }: { json: string; pending: boolean; topicId?: string }) {
  const spec = useMemo(() => parseSketchJson(json), [json]);
  const key = spec ? canonicalSketch(spec) : null;
  const [result, setResult] = useState<{ key: string; value: Result } | null>(null);

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;
    fetchSketch(spec, topicId).then((value) => !cancelled && setResult({ key: canonicalSketch(spec), value }));
    return () => {
      cancelled = true;
    };
  }, [spec, topicId]);

  const current = key && result?.key === key ? result.value : null;
  const svg = useMemo(
    () => (current && "svg" in current ? DOMPurify.sanitize(current.svg, { USE_PROFILES: { svg: true, svgFilters: true } }) : null),
    [current],
  );
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = box.current?.querySelector("svg");
    if (!svg || !element) return;
    placeLabelColumns(element);
    fitToContent(element);
  }, [svg]);

  if (!pending && !spec) {
    return <p className="my-3 text-xs italic text-muted">(The drawing couldn&apos;t be shown. Ask the tutor to try again.)</p>;
  }
  if (current && "error" in current) {
    return <p className="my-3 text-xs italic text-muted">({current.error} Ask the tutor to try again.)</p>;
  }
  if (!svg) {
    return (
      <div className="my-3 flex h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-navy-100 text-xs text-muted">
        <span>Drawing {spec ? <strong className="font-medium text-navy-700">{spec.title}</strong> : "diagram"}…</span>
        <span className="text-[11px]">A brand-new drawing takes about 20 seconds</span>
      </div>
    );
  }
  // Safe to inject: checked on the server before it was stored, and sanitised again here.
  return (
    <figure data-visual className="my-3 overflow-hidden rounded-xl border border-navy-100 bg-white">
      <div
        ref={box}
        className="[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[640px]"
        role="img"
        aria-label={spec ? `${spec.title}: ${spec.labels.join(", ")}` : undefined}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="border-t border-navy-50 px-3 py-1.5 text-xs text-muted">{spec?.title}</figcaption>
    </figure>
  );
}
