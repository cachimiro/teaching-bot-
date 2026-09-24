import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import "katex/dist/katex.min.css";
import "./globals.css";
import { getUserId } from "@/lib/supabase/server";
import { CreditPill } from "@/components/credit-pill";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Virtus AI Tutor",
  description: "Your personal GCSE tutor: simple explanations, quizzes and mock exams marked against Virtus mark schemes.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const userId = await getUserId();
  return (
    <html lang="en-GB" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
            <Link href={userId ? "/learn" : "/"} className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold tracking-tight text-navy">Virtus</span>
              <span className="rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-navy">
                AI Tutor
              </span>
            </Link>
            {userId ? (
              <nav className="ml-auto flex items-center gap-2 text-sm font-medium sm:gap-4">
                <Link href="/learn" className="rounded-full px-3 py-2 text-ink/80 hover:bg-paper">
                  Subjects
                </Link>
                <CreditPill />
                <Link href="/account" className="rounded-full px-3 py-2 text-ink/80 hover:bg-paper">
                  Account
                </Link>
              </nav>
            ) : (
              <nav className="ml-auto flex items-center gap-2 text-sm font-medium">
                <Link href="/login" className="rounded-full px-4 py-2 text-navy hover:bg-paper">
                  Log in
                </Link>
                <Link href="/login?mode=signup" className="rounded-full bg-navy px-4 py-2 text-white hover:bg-navy-600">
                  Get started
                </Link>
              </nav>
            )}
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
