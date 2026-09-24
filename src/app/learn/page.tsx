import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SUBJECT_NAMES } from "@/lib/tutor/prompt";

const MODE_LABEL = { learn: "Learn", quiz: "Quiz", mock: "Mock exam" } as const;

export default async function LearnHome() {
  const supabase = await createClient();
  const [{ data: topics }, { data: recent }] = await Promise.all([
    supabase.from("topics").select("subject"),
    supabase
      .from("conversations")
      .select("id, mode, updated_at, topics(title, subject, unit, slug)")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const counts = new Map<string, number>();
  for (const t of topics ?? []) counts.set(t.subject, (counts.get(t.subject) ?? 0) + 1);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-navy">What are we learning today?</h1>

      {recent && recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-700">Pick up where you left off</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((c) => {
              const t = c.topics as unknown as { title: string; subject: string; unit: string; slug: string };
              return (
                <li key={c.id}>
                  <Link
                    href={`/learn/${t.subject}/${t.unit}/${t.slug}?mode=${c.mode}`}
                    className="block rounded-2xl border border-navy-100 bg-white p-4 shadow-sm hover:border-gold"
                  >
                    <span className="block font-semibold text-navy">{t.title}</span>
                    <span className="text-sm text-muted">
                      {SUBJECT_NAMES[t.subject]} · {MODE_LABEL[c.mode as keyof typeof MODE_LABEL]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-700">Subjects</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(SUBJECT_NAMES).map(([slug, name]) => (
            <li key={slug}>
              <Link
                href={`/learn/${slug}`}
                className="block rounded-2xl border border-navy-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold"
              >
                <span className="font-display block text-xl font-semibold text-navy">{name}</span>
                <span className="text-sm text-muted">{counts.get(slug) ?? 0} topics</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
