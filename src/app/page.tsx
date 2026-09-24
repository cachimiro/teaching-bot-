import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";

const FEATURES = [
  { title: "Explains it simply", body: "Stuck on a topic? The tutor breaks it down step by step, in plain English, and checks you've got it." },
  { title: "Learns how you learn", body: "Examples first, analogies, short answers: it adapts to you and remembers what you find tricky." },
  { title: "Quizzes and mock exams", body: "Exam-style questions for your board and tier, marked against the Virtus mark schemes." },
  { title: "Talk or type", body: "Ask out loud and hear the answer back, or type. Whatever works for you." },
];

export default async function Home() {
  if (await getUserId()) redirect("/learn");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold-700">Virtus Academy</p>
        <h1 className="font-display mt-3 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Your personal GCSE tutor, on every topic.
        </h1>
        <p className="mt-5 text-lg text-muted">
          783 topics across Maths, Statistics, Biology, Chemistry, Physics, Computer Science and French, for AQA,
          Edexcel and OCR. Open any topic and the tutor already knows the notes, worksheets and mark schemes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login?mode=signup" className="rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-600">
            Start learning
          </Link>
          <Link href="/login" className="rounded-full border border-navy-200 bg-white px-6 py-3 font-semibold text-navy hover:bg-paper">
            I already have an account
          </Link>
        </div>
      </section>
      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-navy">{f.title}</h2>
            <p className="mt-2 text-muted">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
