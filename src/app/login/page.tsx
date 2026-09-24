import { AuthForm } from "./auth-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "signin";
  const next = typeof params.next === "string" ? params.next : "/learn";
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-navy">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-muted">
        {mode === "signup" ? "Get started with your AI GCSE tutor." : "Log in to carry on learning."}
      </p>
      <AuthForm mode={mode} next={next} />
    </div>
  );
}
