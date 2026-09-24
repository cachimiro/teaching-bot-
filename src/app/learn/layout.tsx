import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";

/** Every /learn page needs a signed-in, onboarded student. */
export default async function LearnLayout({ children }: LayoutProps<"/learn">) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("onboarded").eq("user_id", userId).single();
  if (!data?.onboarded) redirect("/onboarding");
  return children;
}
