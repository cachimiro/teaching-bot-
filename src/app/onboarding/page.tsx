import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, year_group, target_grade, learning_style, interests, about_me")
    .eq("user_id", userId)
    .single();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-navy">Let&apos;s get to know you</h1>
      <p className="mt-2 text-muted">
        This helps your tutor explain things the way that works for you. You can change it any time.
      </p>
      <div className="mt-8 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <ProfileForm
          from="onboarding"
          next={typeof next === "string" && next.startsWith("/learn") ? next : "/learn"}
          values={profile ?? { display_name: null, year_group: null, target_grade: null, learning_style: [], interests: null, about_me: null }}
        />
      </div>
    </div>
  );
}
