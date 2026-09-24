import { redirect } from "next/navigation";
import { createAdminClient, createClient, getUserId } from "@/lib/supabase/server";
import { getCreditStatus } from "@/lib/credits/service";
import { PLAN } from "@/lib/credits/pricing";
import { deleteLearnerNote } from "@/lib/profile-actions";
import { signOut } from "@/app/login/actions";
import { SUBJECT_NAMES } from "@/lib/tutor/prompt";
import { ProfileForm } from "@/components/profile-form";
import { SubjectSetup } from "@/components/subject-setup";
import { CreditsPanel } from "./credits-panel";

export default async function AccountPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();

  const [status, { data: profile }, { data: settings }, { data: notes }] = await Promise.all([
    getCreditStatus(createAdminClient(), userId),
    supabase
      .from("profiles")
      .select("display_name, year_group, target_grade, learning_style, interests, about_me")
      .eq("user_id", userId)
      .single(),
    supabase.from("subject_settings").select("subject, exam_board, tier"),
    supabase.from("learner_notes").select("id, kind, note, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  const section = "rounded-2xl border border-navy-100 bg-white p-6 shadow-sm";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-navy">Your account</h1>

      <section id="credits" className={section}>
        <h2 className="font-display text-xl font-semibold text-navy">Study credits</h2>
        <CreditsPanel initial={status} pack={PLAN.topupPack} />
      </section>

      <section id="subjects" className={section}>
        <h2 className="font-display text-xl font-semibold text-navy">Exam boards and tiers</h2>
        <p className="mt-1 text-sm text-muted">Set when you first open a topic in each subject.</p>
        <div className="mt-4 space-y-5">
          {(settings ?? []).length === 0 && <p className="text-sm text-muted">None yet.</p>}
          {(settings ?? []).map((s) => (
            <SubjectSetup
              key={s.subject}
              compact
              subject={s.subject}
              subjectName={SUBJECT_NAMES[s.subject] ?? s.subject}
              boards={["AQA", "Edexcel", "OCR"]}
              initial={{ examBoard: s.exam_board, tier: s.tier }}
            />
          ))}
        </div>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-semibold text-navy">How you like to learn</h2>
        <div className="mt-4">
          <ProfileForm
            from="account"
            values={profile ?? { display_name: null, year_group: null, target_grade: null, learning_style: [], interests: null, about_me: null }}
          />
        </div>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-semibold text-navy">What your tutor remembers</h2>
        <p className="mt-1 text-sm text-muted">Notes your tutor has made to help future lessons. Remove any you don&apos;t want.</p>
        <ul className="mt-4 divide-y divide-navy-50">
          {(notes ?? []).length === 0 && <li className="py-2 text-sm text-muted">Nothing yet.</li>}
          {(notes ?? []).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <span>
                <span className="mr-2 rounded bg-navy-50 px-1.5 py-0.5 text-xs font-semibold capitalize text-navy">{n.kind}</span>
                {n.note}
              </span>
              <form action={deleteLearnerNote}>
                <input type="hidden" name="id" value={n.id} />
                <button className="text-xs font-semibold text-muted hover:text-red-700">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut}>
        <button className="rounded-full border border-navy-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-paper">
          Log out
        </button>
      </form>
    </div>
  );
}
