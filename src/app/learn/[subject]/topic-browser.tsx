"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type TopicListItem = {
  id: string;
  unit: string;
  unitName: string;
  slug: string;
  title: string;
  foundation: boolean;
  higher: boolean;
};

export function TopicBrowser({ subject, topics }: { subject: string; topics: TopicListItem[] }) {
  const [query, setQuery] = useState("");

  const units = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const grouped = new Map<string, TopicListItem[]>();
    for (const t of topics) {
      const haystack = `${t.title} ${t.unitName}`.toLowerCase();
      if (words.length && !words.every((w) => haystack.includes(w))) continue;
      grouped.set(t.unitName, [...(grouped.get(t.unitName) ?? []), t]);
    }
    return [...grouped.entries()];
  }, [query, topics]);

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search topics… e.g. osmosis, quadratics"
        className="mt-6 w-full max-w-md rounded-full border border-navy-100 bg-white px-5 py-3 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
      />
      {units.length === 0 && <p className="mt-6 text-muted">No topics match &ldquo;{query}&rdquo;.</p>}
      <div className="mt-8 space-y-8">
        {units.map(([unitName, items]) => (
          <section key={unitName}>
            <h2 className="font-display text-xl font-semibold text-navy">{unitName}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/learn/${subject}/${t.unit}/${t.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm shadow-sm hover:border-gold"
                  >
                    <span className="font-medium text-ink">{t.title}</span>
                    <span className="flex shrink-0 gap-1">
                      {t.foundation && (
                        <span className="rounded bg-navy px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-white">F</span>
                      )}
                      {t.higher && (
                        <span className="rounded bg-gold px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-navy">H</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
