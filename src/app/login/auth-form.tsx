"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const input =
  "mt-1 w-full rounded-xl border border-navy-100 bg-white px-4 py-3 text-ink shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";

export function AuthForm({ mode, next }: { mode: "signin" | "signup"; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "signup" ? signUp : signIn, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-navy">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
          className={input}
        />
      </label>
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.message && <p className="rounded-xl bg-navy-50 px-4 py-3 text-sm text-navy">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-600 disabled:opacity-60"
      >
        {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-navy underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/login?mode=signup&next=${encodeURIComponent(next)}`} className="font-semibold text-navy underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
