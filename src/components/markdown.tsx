"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ExploreCard } from "@/components/activities/explore-card";
import { OrderCard } from "@/components/activities/order-card";
import { QuizCard } from "@/components/activities/quiz-card";
import { DiagramView } from "@/components/diagrams/diagram-view";
import { SketchView } from "@/components/diagrams/sketch-view";
import { GraphView } from "@/components/graph-view";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { StepsBoard } from "@/components/steps-board";
import { diagramBlockJson } from "@/lib/diagrams/spec";
import { parseActivity } from "@/lib/tutor/activities";
import { fenceBareDiagrams, numberStepsBlocks } from "@/lib/tutor/diagrams";
import { parseSteps, type StepRef } from "@/lib/voice/speech-plan";

type ReplyState = {
  streaming: boolean;
  activeStep: StepRef | null;
  interactive: boolean;
  onActivity?: (message: string) => void;
  topicId?: string;
};

/**
 * The renderers below are defined once, at module level, so React keeps the same component instances
 * across re-renders (an answered quiz or a moved slider keeps its state). Per-reply settings come in
 * through this context instead of props.
 */
const ReplyContext = createContext<ReplyState>({ streaming: false, activeStep: null, interactive: false });

function Pending({ what }: { what: string }) {
  return (
    <div className="my-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-navy-100 text-xs text-muted">
      {what}…
    </div>
  );
}

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const { streaming, activeStep, interactive, onActivity, topicId } = useContext(ReplyContext);
  const canAnswer = interactive && !streaming;
  const code = String(children).replace(/\n$/, "");
  const lang = className?.match(/language-([\w-]+)/)?.[1];

  const steps = lang?.match(/^steps-(\d+)$/);
  if (steps) {
    const block = Number(steps[1]);
    return (
      <StepsBoard
        steps={parseSteps(code)}
        active={activeStep?.block === block ? activeStep.index : null}
        narrating={activeStep !== null}
        interactive={canAnswer}
        onDone={onActivity}
      />
    );
  }
  if (lang === "quiz" || lang === "order" || lang === "explore") {
    if (streaming) return <Pending what="Preparing an activity" />;
    return <ActivityBlock lang={lang} code={code} interactive={canAnswer} onDone={onActivity} />;
  }
  // The chat shows one sticky progress bar for the whole lesson instead.
  if (lang === "lesson") return null;
  if (lang === "graph") return <GraphView json={code} pending={streaming} />;
  const diagram = diagramBlockJson(lang, code);
  if (diagram !== null) return <DiagramView json={diagram} pending={streaming} interactive={canAnswer} onDone={onActivity} />;
  if (lang === "note") return null;
  if (lang === "sketch") return <SketchView json={code} pending={streaming} topicId={topicId} />;
  if (lang === "mermaid") return <MermaidDiagram code={code} pending={streaming} />;
  if (className) {
    return (
      <pre className="my-3 overflow-x-auto rounded-xl bg-navy-50 p-3 text-sm">
        <code>{code}</code>
      </pre>
    );
  }
  return <code className="rounded bg-navy-50 px-1 py-0.5 text-[0.9em]">{children}</code>;
}

function ActivityBlock({ lang, code, interactive, onDone }: { lang: string; code: string; interactive: boolean; onDone?: (m: string) => void }) {
  const activity = useMemo(() => parseActivity(lang, code), [lang, code]);
  if (activity.kind === "quiz") return <QuizCard spec={activity.spec} interactive={interactive} onDone={onDone} />;
  if (activity.kind === "order") return <OrderCard spec={activity.spec} interactive={interactive} onDone={onDone} />;
  if (activity.kind === "explore") return <ExploreCard spec={activity.spec} />;
  return <p className="my-3 text-xs italic text-muted">(This activity couldn&apos;t be shown. Ask the tutor to try again.)</p>;
}

const COMPONENTS: Components = {
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link href={href}>{children}</Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock,
};

const REMARK = [remarkGfm, remarkMath];
const REHYPE = [rehypeKatex];

/**
 * Renders a tutor reply: markdown, tables, LaTeX maths, working-out boards (```steps), interactive
 * graphs (```graph), activities (```quiz, ```order, ```explore), ready-made diagrams (```diagram),
 * tutor sketches (```sketch) and mermaid diagrams. ```lesson and ```note blocks are not shown here.
 * - `streaming` holds visuals back until the reply is complete.
 * - `activeStep` highlights the working-out step being read aloud.
 * - `interactive` enables answering activities (only in the latest reply); `onActivity` receives the
 *   student's result as a message for the tutor.
 */
export function Markdown({
  children,
  streaming = false,
  activeStep = null,
  interactive = false,
  onActivity,
  topicId,
}: {
  children: string;
  streaming?: boolean;
  activeStep?: StepRef | null;
  interactive?: boolean;
  onActivity?: (message: string) => void;
  /** The topic being studied, so a new sketch is remembered for it. */
  topicId?: string;
}) {
  const state = useMemo(
    () => ({ streaming, activeStep, interactive, onActivity, topicId }),
    [streaming, activeStep, interactive, onActivity, topicId],
  );
  const source = useMemo(() => numberStepsBlocks(fenceBareDiagrams(children)), [children]);
  return (
    <ReplyContext.Provider value={state}>
      <div className="prose-tutor">
        <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={COMPONENTS}>
          {source}
        </ReactMarkdown>
      </div>
    </ReplyContext.Provider>
  );
}
