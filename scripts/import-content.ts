/**
 * Imports every topic from virtusacademy.co.uk into data/content/<id>.json.
 *
 * Sources:
 *   - /search-index.json          → the list of 783 topics and their metadata
 *   - each topic page             → revision notes (section#onpage-content), boards, tiers
 *   - files.virtusacademy.co.uk   → worksheet + mark scheme PDFs per tier (text extracted)
 *
 * Re-runnable: topics that already have a JSON file are skipped unless --force.
 * Usage: npx tsx scripts/import-content.ts [--force] [--only=biology] [--limit=10]
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { parse, HTMLElement } from "node-html-parser";
import { extractText, getDocumentProxy } from "unpdf";
import type { TopicContent, TierDocs } from "../src/lib/content/types";
import { cleanPdfText } from "../src/lib/content/clean";

const SITE = "https://virtusacademy.co.uk";
const OUT_DIR = path.join(process.cwd(), "data", "content");
const CONCURRENCY = 6;

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);
const force = args.has("force");
const only = args.get("only");
const limit = args.has("limit") ? Number(args.get("limit")) : Infinity;

type IndexEntry = {
  id: string;
  subject: string;
  topic: string;
  strand: string;
  strandSlug: string;
  category: string;
  subcategory: string;
  url: string;
  status: string;
  f: boolean;
  h: boolean;
};

async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "VirtusTutorImporter/1.0" } });
      if (res.ok || res.status === 404 || i >= tries) return res;
    } catch (err) {
      if (i >= tries) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * i));
  }
}

/** Converts the notes HTML into compact markdown the tutor can read. */
export function htmlToMarkdown(el: HTMLElement): string {
  const out: string[] = [];
  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      const tag = child.tagName?.toLowerCase();
      const text = () => child.text.replace(/\s+/g, " ").trim();
      if (tag === "nav") continue;
      if (tag === "h2") out.push(`\n## ${text()}\n`);
      else if (tag === "h3") out.push(`\n### ${text()}\n`);
      else if (tag === "p") {
        const t = text();
        if (t) out.push(t + "\n");
      } else if (tag === "li") {
        const paras = child.childNodes
          .filter((n): n is HTMLElement => n instanceof HTMLElement && n.tagName === "P")
          .map((p) => p.text.replace(/\s+/g, " ").trim());
        out.push(`- ${paras.length ? paras.join(" — ") : text()}`);
      }
      else if (tag === "dt") out.push(`- **${text()}**:`);
      else if (tag === "dd") out[out.length - 1] += ` ${text()}`;
      else walk(child);
    }
  };
  walk(el);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function pdfText(url: string): Promise<string | null> {
  const res = await fetchWithRetry(url);
  if (!res.ok) return null;
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return cleanPdfText(text);
}

async function tierDocs(pdfUrls: string[], tier: "foundation" | "higher"): Promise<TierDocs | null> {
  const ws = pdfUrls.find((u) => u.endsWith(`-${tier}-worksheet.pdf`));
  const ms = pdfUrls.find((u) => u.endsWith(`-${tier}-markscheme.pdf`));
  if (!ws && !ms) return null;
  return {
    worksheetUrl: ws ?? null,
    worksheet: ws ? await pdfText(ws) : null,
    markschemeUrl: ms ?? null,
    markscheme: ms ? await pdfText(ms) : null,
  };
}

async function importTopic(entry: IndexEntry): Promise<TopicContent> {
  const res = await fetchWithRetry(SITE + entry.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${entry.url}`);
  const root = parse(await res.text());
  const article = root.querySelector("article");
  if (!article) throw new Error(`No <article> on ${entry.url}`);

  const badges = article.querySelectorAll("header span").map((s) => s.text.trim());
  const boards = ["AQA", "Edexcel", "OCR"].filter((b) => badges.includes(b));
  const intro = article.querySelector("p.intro-prose")?.text.replace(/\s+/g, " ").trim() ?? "";
  const notesEl = article.querySelector("#onpage-content");
  const notes = notesEl ? htmlToMarkdown(notesEl) : "";
  const pdfUrls = [...new Set(article.querySelectorAll("a[href$='.pdf']").map((a) => a.getAttribute("href")!))];
  const related = article
    .querySelectorAll("section[aria-labelledby='related-heading'] a")
    .map((a) => ({ title: a.text.trim(), url: a.getAttribute("href")! }));

  const [, subject, unit, slug] = entry.url.split("/");
  return {
    id: entry.id,
    subject,
    unit,
    unitName: entry.strand,
    slug,
    title: entry.topic,
    url: entry.url,
    category: entry.category,
    subcategory: entry.subcategory,
    boards,
    tiers: { foundation: entry.f, higher: entry.h },
    intro,
    notes,
    foundation: entry.f ? await tierDocs(pdfUrls, "foundation") : null,
    higher: entry.h ? await tierDocs(pdfUrls, "higher") : null,
    related,
    importedAt: new Date().toISOString(),
  };
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const index: IndexEntry[] = await (await fetchWithRetry(`${SITE}/search-index.json`)).json();
  const todo = index
    .filter((e) => e.status === "live" && (!only || e.subject === only))
    .slice(0, limit);

  let done = 0;
  let skipped = 0;
  const failures: string[] = [];
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const file = path.join(OUT_DIR, `${entry.id}.json`);
        if (!force && (await exists(file))) {
          skipped++;
          continue;
        }
        try {
          const topic = await importTopic(entry);
          await writeFile(file, JSON.stringify(topic, null, 1));
          done++;
          if (done % 25 === 0) console.log(`imported ${done}/${todo.length - skipped}`);
        } catch (err) {
          failures.push(`${entry.id} ${entry.url}: ${(err as Error).message}`);
        }
      }
    }),
  );
  console.log(`Done. imported=${done} skipped=${skipped} failed=${failures.length}`);
  if (failures.length) console.log(failures.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
