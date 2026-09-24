/**
 * Loads data/content/*.json (from import-content.ts) into the Supabase `topics` table.
 * Usage: npx tsx scripts/seed-topics.mts
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { TopicContent } from "../src/lib/content/types";
import { stripControlChars } from "../src/lib/content/clean";

const DIR = path.join(process.cwd(), "data", "content");
const BATCH = 50;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const rows = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  // Postgres rejects NUL characters in text/jsonb; strip control chars from every string.
  .map((f) =>
    JSON.parse(readFileSync(path.join(DIR, f), "utf8"), (_, v) => (typeof v === "string" ? stripControlChars(v) : v)) as TopicContent,
  )
  .map((t) => ({
    id: t.id,
    subject: t.subject,
    unit: t.unit,
    unit_name: t.unitName,
    slug: t.slug,
    title: t.title,
    url: t.url,
    category: t.category,
    subcategory: t.subcategory,
    boards: t.boards,
    has_foundation: Boolean(t.foundation),
    has_higher: Boolean(t.higher),
    intro: t.intro,
    notes: t.notes,
    foundation: t.foundation,
    higher: t.higher,
    related: t.related,
    updated_at: new Date().toISOString(),
  }));

for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from("topics").upsert(rows.slice(i, i + BATCH));
  if (error) throw error;
  console.log(`upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
console.log("Done.");
