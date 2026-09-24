"use client";

import katex from "katex";
import { Fragment } from "react";

/** KaTeX output is escaped HTML (trust is off), so it is safe to inject. */
export function tex(math: string) {
  return katex.renderToString(math, { throwOnError: false, displayMode: false, output: "html" });
}

/** Plain text in which any $...$ is rendered as maths. */
export function InlineMaths({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") && p.length > 2 ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: tex(p.slice(1, -1)) }} />
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
