/** Draws the same sketches with different models/settings and writes a side-by-side page. */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { SKETCH_SYSTEM, extractSvg, layoutLabels } from "../src/lib/sketch/sketch";

const anthropic = new Anthropic();
const PRICE: Record<string, [number, number]> = { "claude-sonnet-5": [2, 10], "claude-opus-5": [5, 25] };

const SKETCHES = [
  ["Motor neurone", "A motor neurone with labels: dendrites, cell body, nucleus, axon, myelin sheath, nerve endings. Arrow showing direction of impulse."],
  ["Simple distillation", "Simple distillation apparatus: heat source, round-bottomed flask with salty water, thermometer at the neck, condenser with cold water in at the bottom and out at the top, beaker collecting pure water."],
  ["The human eye", "Cross-section of the human eye with labels: cornea, iris, pupil, lens, ciliary muscles, suspensory ligaments, retina, optic nerve."],
];

type Config = { id: string; model: string; effort: "low" | "medium"; thinking: boolean };
const CONFIGS: Config[] = [
  { id: "A sonnet medium", model: "claude-sonnet-5", effort: "medium", thinking: false },
  { id: "B opus low", model: "claude-opus-5", effort: "low", thinking: false },
  { id: "C opus medium thinking", model: "claude-opus-5", effort: "medium", thinking: true },
  { id: "D opus low thinking", model: "claude-opus-5", effort: "low", thinking: true },
  { id: "E opus medium", model: "claude-opus-5", effort: "medium", thinking: false },
];

const only = process.argv.slice(2);
const configs = only.length ? CONFIGS.filter((c) => only.some((o) => c.id.startsWith(o))) : CONFIGS;

const cells = await Promise.all(
  configs.flatMap((c) =>
    SKETCHES.map(async ([title, describe]) => {
      const t0 = Date.now();
      const message = await anthropic.messages.create({
        model: c.model,
        max_tokens: 16000,
        thinking: c.thinking ? { type: "adaptive" } : { type: "disabled" },
        output_config: { effort: c.effort },
        system: SKETCH_SYSTEM,
        messages: [{ role: "user", content: `Title: ${title}\nDraw: ${describe}` }],
      });
      const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const svg = extractSvg(text);
      const [pin, pout] = PRICE[c.model];
      const pence = ((message.usage.input_tokens * pin + message.usage.output_tokens * pout) / 1e6) * 80;
      return { config: c.id, title, seconds: (Date.now() - t0) / 1000, pence, out: message.usage.output_tokens, svg: svg ? layoutLabels(svg) : "<p>no svg</p>" };
    }),
  ),
);

for (const r of cells) console.log(`${r.config.padEnd(24)} ${r.title.padEnd(20)} ${r.seconds.toFixed(1)}s  ${r.pence.toFixed(1)}p  out=${r.out}`);
const html = `<!doctype html><meta charset="utf-8"><style>body{font:13px system-ui;margin:12px}.row{display:flex;gap:10px;margin-bottom:10px}.cell{width:480px;border:1px solid #ccd;border-radius:8px;padding:4px}.cell svg{width:100%;height:auto}</style>` +
  configs.map((c) => `<h3>${c.id}</h3><div class="row">` + cells.filter((r) => r.config === c.id).map((r) => `<div class="cell"><div>${r.title} · ${r.seconds.toFixed(0)}s · ${r.pence.toFixed(1)}p</div>${r.svg}</div>`).join("") + `</div>`).join("");
writeFileSync(`data/sketch-compare/${only.join("-") || "all"}.html`, html);
