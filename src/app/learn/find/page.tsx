import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { searchTopics } from "@/lib/tutor/data";
import { SUBJECT_NAMES } from "@/lib/tutor/prompt";

/**
 * Where the tutor's topic links go (/learn/find?q=electron+shells&s=chemistry). One clear match
 * opens that topic straight away; otherwise the student picks from the closest matches.
 */
export default async function FindTopicPage({ searchParams }: PageProps<"/learn/find">) {
  const params = await searchParams;
  const query = String(params.q ?? "").slice(0, 120).trim();
  const subject = typeof params.s === "string" ? params.s : undefined;
  if (!query) redirect("/learn");

  const supabase = await createClient();
  const matches = await searchTopics(supabase, query, subject);
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const titleMatches = (title: string) => words.length > 0 && words.every((w) => title.toLowerCase().includes(w));
  const clear = matches.length === 1 || (matches.length > 1 && titleMatches(matches[0].title) && !titleMatches(matches[1].title));
  if (clear) redirect(matches[0].path);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <nav className="text-sm text-muted">
        <Link href="/learn" className="hover:text-navy">
          Subjects
        </Link>{" "}
        / <span className="text-ink">Find a topic</span>
      </nav>
      <h1 className="font-display mt-3 text-2xl font-bold text-navy">Topics for &ldquo;{query}&rdquo;</h1>
      {matches.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No topics matched. <Link href="/learn" className="text-navy underline">Browse all subjects</Link> instead.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-navy-50 rounded-2xl border border-navy-100 bg-white">
          {matches.map((m) => (
            <li key={m.path}>
              <Link href={m.path} className="flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-navy-50">
                <span className="font-medium text-navy">{m.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {SUBJECT_NAMES[m.subject] ?? m.subject} · {m.unitName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
