import type { ComponentType, ReactNode } from "react";

/**
 * The diagram library: ready-made, accurate GCSE diagrams the tutor shows with a ```diagram block:
 *   {"name": "animal-cell", "highlight": ["nucleus"], "mode": "labelled" | "quiz" | "blank", ...options}
 *
 * Two kinds of entry:
 * - "parts" diagrams (cells, organs): a drawing split into named parts. One shared renderer handles
 *   labels, highlighting and the "tap the ___" labelling quiz.
 * - "custom" diagrams (atoms, waves, circuits…): their own component, usually with controls.
 */

export type DiagramMode = "labelled" | "quiz" | "blank";

/** One labelled, tappable part of a parts diagram. Coordinates are in the diagram's viewBox. */
export type PartDef = {
  id: string;
  label: string;
  /** Other names the tutor might use for it in "highlight" (e.g. "mitochondrion"). */
  aliases?: string[];
  /** The visible SVG shape(s) for this part. */
  shape: ReactNode;
  /** Optional larger invisible shape so small parts are easy to tap. Use fill="transparent". */
  hit?: ReactNode;
  /** Where the label's leader line points (on or inside the part). */
  anchor: [number, number];
  /** Where the label text sits (outside the drawing). */
  labelAt: [number, number];
  /** "end" for labels on the left (text ends at labelAt), "start" for labels on the right. */
  align: "start" | "end";
};

export type PartsDiagramDef = {
  name: string;
  title: string;
  /** e.g. "0 0 600 400" */
  viewBox: string;
  /** Parts are drawn in this order: put large background parts (cytoplasm) first. */
  parts: PartDef[];
  /** Optional non-interactive decoration drawn above the parts (arrows, captions). */
  overlay?: ReactNode;
};

/** Props every custom diagram receives. `spec` is the whole JSON block (validated by the entry). */
export type CustomDiagramProps = {
  spec: Record<string, unknown>;
  highlight: string[];
  mode: DiagramMode;
  interactive: boolean;
  onDone?: (message: string) => void;
};

export type DiagramEntry =
  | { kind: "parts"; def: PartsDiagramDef; subject: string; description: string }
  | {
      kind: "custom";
      name: string;
      title: string;
      subject: string;
      /** One line for the tutor's catalogue: what it shows. */
      description: string;
      /** One line for the tutor's catalogue: the JSON options it takes, with an example. */
      options: string;
      Component: ComponentType<CustomDiagramProps>;
      /** Returns an error message if the spec's options are unusable, else null. */
      validate?: (spec: Record<string, unknown>) => string | null;
    };
