import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getSubjectSetting, getTopicByPath } from "@/lib/tutor/data";
import { SUBJECT_NAMES, type Mode } from "@/lib/tutor/prompt";
import { TutorChat, type ChatMessage, type ModeThreads } from "@/components/tutor-chat";
import { SubjectSetup } from "@/components/subject-setup";

const MODES: Mode[] = ["learn", "quiz", "mock"];

export default async function TopicPage({ params, searchParams }: PageProps<"/learn/[subject]/[unit]/[topic]">) {
  const [{ subject, unit, topic: slug }, query] = await Promise.all([params, searchParams]);
  const userId = (await getUserId())!;
  const supabase = await createClient();
  const topic = await getTopicByPath(supabase, subject, unit, slug);
  if (!topic) notFound();

  const setting = await getSubjectSetting(supabase, userId, subject);
  const initialMode: Mode = MODES.includes(query.mode as Mode) ? (query.mode as Mode) : "learn";

  // Resume the latest conversation in each mode.
  const threads: ModeThreads = { learn: null, quiz: null, mock: null };
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, mode")
    .eq("topic_id", topic.id)
    .order("updated_at", { ascending: false });
  for (const c of convs ?? []) threads[c.mode as Mode] ??= { id: c.id, messages: [] };
  const ids = MODES.map((m) => threads[m]?.id).filter(Boolean) as string[];
  if (ids.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, role, display_text")
      .in("conversation_id", ids)
      .not("display_text", "is", null)
      .order("id");
    for (const m of msgs ?? []) {
      const thread = MODES.map((mode) => threads[mode]).find((t) => t?.id === m.conversation_id);
      thread?.messages.push({ role: m.role, text: m.display_text } as ChatMessage);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-6 sm:px-6">
      <nav className="text-sm text-muted">
        <Link href="/learn" className="hover:text-navy">
          Subjects
        </Link>{" "}
        /{" "}
        <Link href={`/learn/${subject}`} className="hover:text-navy">
          {SUBJECT_NAMES[subject]}
        </Link>{" "}
        / <span className="text-ink">{topic.unitName}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">{topic.title}</h1>
        <a
          href={`https://virtusacademy.co.uk${topic.url}`}
          target="_blank"
          rel="noopener"
          className="text-sm font-medium text-navy-400 underline"
        >
          Notes &amp; worksheets on Virtus
        </a>
      </div>

      {setting ? (
        <TutorChat
          topicId={topic.id}
          topicTitle={topic.title}
          setting={setting}
          subjectName={SUBJECT_NAMES[subject]}
          initialMode={initialMode}
          initialThreads={threads}
        />
      ) : (
        <SubjectSetup
          subject={subject}
          subjectName={SUBJECT_NAMES[subject]}
          boards={(topic.boards.length ? topic.boards : ["AQA", "Edexcel", "OCR"]) as ("AQA" | "Edexcel" | "OCR")[]}
        />
      )}
    </div>
  );
}
