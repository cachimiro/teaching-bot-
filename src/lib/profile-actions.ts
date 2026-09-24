"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";
import { LEARNING_STYLES } from "@/lib/tutor/prompt";

export type FormState = { error?: string; saved?: boolean };

const Profile = z.object({
  display_name: z.string().trim().max(40).optional(),
  year_group: z.coerce.number().int().min(7).max(13),
  target_grade: z.string().trim().max(10).optional(),
  learning_style: z.array(z.enum(Object.keys(LEARNING_STYLES) as [string, ...string[]])).max(6),
  interests: z.string().trim().max(200).optional(),
  about_me: z.string().trim().max(300).optional(),
});

/** Onboarding and account page: how the student wants to be taught. */
export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const parsed = Profile.safeParse({
    display_name: form.get("display_name") || undefined,
    year_group: form.get("year_group"),
    target_grade: form.get("target_grade") || undefined,
    learning_style: form.getAll("learning_style"),
    interests: form.get("interests") || undefined,
    about_me: form.get("about_me") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, onboarded: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { error: "Couldn't save that. Please try again." };

  if (form.get("from") === "onboarding") redirect(String(form.get("next") || "/learn"));
  revalidatePath("/account");
  return { saved: true };
}

const SubjectSetting = z.object({
  subject: z.string().min(1).max(40),
  exam_board: z.enum(["AQA", "Edexcel", "OCR"]),
  tier: z.enum(["foundation", "higher"]),
});

export async function saveSubjectSetting(_: FormState, form: FormData): Promise<FormState> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const parsed = SubjectSetting.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Pick your exam board and tier." };

  const supabase = await createClient();
  const { error } = await supabase.from("subject_settings").upsert({ user_id: userId, ...parsed.data });
  if (error) return { error: "Couldn't save that. Please try again." };
  revalidatePath("/learn", "layout");
  revalidatePath("/account");
  return { saved: true };
}

const TopupSettings = z.object({
  auto_topup: z.boolean(),
  monthly_topup_cap_pence: z.coerce.number().int().min(0).max(100000),
});

export async function saveTopupSettings(_: FormState, form: FormData): Promise<FormState> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const parsed = TopupSettings.safeParse({
    auto_topup: form.get("auto_topup") === "on",
    monthly_topup_cap_pence: form.get("monthly_topup_cap_pence"),
  });
  if (!parsed.success) return { error: "Choose a monthly limit." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { error: "Couldn't save that. Please try again." };
  revalidatePath("/account");
  return { saved: true };
}

export async function deleteLearnerNote(form: FormData) {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const supabase = await createClient();
  await supabase.from("learner_notes").delete().eq("id", id);
  revalidatePath("/account");
}
