import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SUBJECT_NAMES } from "@/lib/tutor/prompt";
import { TopicBrowser, type TopicListItem } from "./topic-browser";

export default async function SubjectPage({ params }: PageProps<"/learn/[subject]">) {
  const { subject } = await params;
  const name = SUBJECT_NAMES[subject];
  if (!name) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("topics")
    .select("id, unit, unit_name, slug, title, has_foundation, has_higher")
    .eq("subject", subject)
    .order("unit_name")
    .order("title");

  const topics: TopicListItem[] = (data ?? []).map((t) => ({
    id: t.id,
    unit: t.unit,
    unitName: t.unit_name,
    slug: t.slug,
    title: t.title,
    foundation: t.has_foundation,
    higher: t.has_higher,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-sm text-muted">
        <Link href="/learn" className="hover:text-navy">
          Subjects
        </Link>{" "}
        / <span className="text-ink">{name}</span>
      </nav>
      <h1 className="font-display mt-3 text-3xl font-bold text-navy">GCSE {name}</h1>
      <TopicBrowser subject={subject} topics={topics} />
    </div>
  );
}
