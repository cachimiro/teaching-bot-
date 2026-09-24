import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tier, TierDocs } from "@/lib/content/types";
import type { ExamBoard, Learner, Mode, TopicPack } from "./prompt";
import { parseSketchSpec, type SketchSpec } from "@/lib/sketch/spec";
import type { LearnerNote } from "./notes";
import type { StoredMessage } from "./turn";

const NOTES_IN_PROMPT = 20;
const MAX_TOPIC_SKETCHES = 8;

type TopicRow = {
  id: string;
  subject: string;
  unit: string;
  unit_name: string;
  slug: string;
  title: string;
  url: string;
  boards: string[];
  has_foundation: boolean;
  has_higher: boolean;
  intro: string;
  notes: string;
  foundation: TierDocs | null;
  higher: TierDocs | null;
  related: { title: string; url: string }[];
};

export type Topic = TopicPack & {
  unit: string;
  slug: string;
  intro: string;
  hasFoundation: boolean;
  hasHigher: boolean;
  related: { title: string; url: string }[];
};

function toTopic(r: TopicRow): Topic {
  return {
    id: r.id,
    subject: r.subject,
    unit: r.unit,
    unitName: r.unit_name,
    slug: r.slug,
    title: r.title,
    url: r.url,
    boards: r.boards,
    intro: r.intro,
    notes: r.notes,
    foundation: r.foundation,
    higher: r.higher,
    hasFoundation: r.has_foundation,
    hasHigher: r.has_higher,
    related: r.related,
  };
}

const TOPIC_COLUMNS =
  "id, subject, unit, unit_name, slug, title, url, boards, has_foundation, has_higher, intro, notes, foundation, higher, related";

export async function getTopicByPath(db: SupabaseClient, subject: string, unit: string, slug: string) {
  const { data } = await db
    .from("topics")
    .select(TOPIC_COLUMNS)
    .match({ subject, unit, slug })
    .maybeSingle<TopicRow>();
  return data ? toTopic(data) : null;
}

export async function getTopicById(db: SupabaseClient, id: string) {
  const { data } = await db.from("topics").select(TOPIC_COLUMNS).eq("id", id).maybeSingle<TopicRow>();
  return data ? toTopic(data) : null;
}

export type SubjectSetting = { examBoard: ExamBoard; tier: Tier };

export async function getSubjectSetting(db: SupabaseClient, userId: string, subject: string): Promise<SubjectSetting | null> {
  const { data } = await db
    .from("subject_settings")
    .select("exam_board, tier")
    .match({ user_id: userId, subject })
    .maybeSingle<{ exam_board: ExamBoard; tier: Tier }>();
  return data ? { examBoard: data.exam_board, tier: data.tier } : null;
}

/** Everything about the student except the per-subject board and tier. */
export type LearnerProfile = Omit<Learner, "examBoard" | "tier">;

export async function getLearnerProfile(db: SupabaseClient, userId: string): Promise<LearnerProfile> {
  const [{ data: profile }, { data: notes }] = await Promise.all([
    db
      .from("profiles")
      .select("display_name, year_group, target_grade, learning_style, interests, about_me")
      .eq("user_id", userId)
      .single(),
    db
      .from("learner_notes")
      .select("kind, note, topics(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(NOTES_IN_PROMPT),
  ]);
  return {
    displayName: profile?.display_name ?? null,
    yearGroup: profile?.year_group ?? null,
    targetGrade: profile?.target_grade ?? null,
    learningStyle: profile?.learning_style ?? [],
    interests: profile?.interests ?? null,
    aboutMe: profile?.about_me ?? null,
    notes: (notes ?? []).map((n) => ({
      kind: n.kind as string,
      note: n.note as string,
      topicTitle: (n.topics as unknown as { title: string } | null)?.title ?? null,
    })),
  };
}

export type Conversation = { id: string; mode: Mode; tier: Tier; examBoard: ExamBoard };

export async function createConversation(
  admin: SupabaseClient,
  userId: string,
  topicId: string,
  mode: Mode,
  setting: SubjectSetting,
): Promise<Conversation> {
  const { data, error } = await admin
    .from("conversations")
    .insert({ user_id: userId, topic_id: topicId, mode, tier: setting.tier, exam_board: setting.examBoard })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, mode, tier: setting.tier, examBoard: setting.examBoard };
}

/** The student's conversation, or null if it doesn't exist or isn't theirs. */
export async function getConversation(admin: SupabaseClient, userId: string, id: string) {
  const { data } = await admin
    .from("conversations")
    .select("id, mode, tier, exam_board, topic_id")
    .match({ id, user_id: userId })
    .maybeSingle();
  return data
    ? { id: data.id as string, mode: data.mode as Mode, tier: data.tier as Tier, examBoard: data.exam_board as ExamBoard, topicId: data.topic_id as string }
    : null;
}

/** Full message history in exact API shape, oldest first. */
export async function loadHistory(admin: SupabaseClient, conversationId: string): Promise<Anthropic.MessageParam[]> {
  const { data, error } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({ role: m.role, content: m.content }));
}

export async function saveMessages(admin: SupabaseClient, conversationId: string, userId: string, messages: StoredMessage[]) {
  const { error } = await admin.from("messages").insert(
    messages.map((m) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: m.role,
      content: m.content,
      display_text: m.displayText,
    })),
  );
  if (error) throw error;
  await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function saveLearnerNotes(admin: SupabaseClient, userId: string, topicId: string, notes: LearnerNote[]) {
  if (notes.length === 0) return;
  const { error } = await admin.from("learner_notes").insert(notes.map(({ kind, note }) => ({ user_id: userId, kind, note, topic_id: topicId })));
  if (error) throw error;
}

/** Drawings already made for this topic, most used first, so the tutor can reuse them exactly. */
export async function getTopicSketches(admin: SupabaseClient, topicId: string): Promise<SketchSpec[]> {
  const { data, error } = await admin
    .from("sketches")
    .select("spec")
    .eq("topic_id", topicId)
    .not("spec", "is", null)
    .order("uses", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(MAX_TOPIC_SKETCHES);
  if (error) throw error;
  return (data ?? []).map((r) => parseSketchSpec(r.spec)).filter((s): s is SketchSpec => s !== null);
}

export type TopicMatch = { title: string; subject: string; unitName: string; path: string };

/** Topics matching a few keywords, best first: titles containing every keyword, then the rest. */
export async function searchTopics(db: SupabaseClient, query: string, subject?: string): Promise<TopicMatch[]> {
  const { data, error } = await db
    .from("topics")
    .select("title, subject, unit, slug, unit_name")
    .textSearch("search", query, { type: "websearch", config: "english" })
    .limit(20);
  if (error) throw error;
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const score = (t: { title: string; subject: string }) =>
    (words.every((w) => t.title.toLowerCase().includes(w)) ? 2 : 0) + (t.subject === subject ? 1 : 0);
  return (data ?? [])
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ t }) => ({ title: t.title, subject: t.subject, unitName: t.unit_name, path: `/learn/${t.subject}/${t.unit}/${t.slug}` }));
}
