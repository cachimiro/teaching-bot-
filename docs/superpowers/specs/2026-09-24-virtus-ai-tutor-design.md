# Virtus AI Tutor — Design

Date: 2026-09-24 · Status: approved in conversation ("do what you recommend")

## Goal

A paid AI tutor that sits alongside virtusacademy.co.uk. A student clicks "Ask the AI tutor" on any
topic page and lands in a chat that already knows that topic's notes, worksheets and mark schemes.
The tutor explains in simple terms, adapts to the student, quizzes them, and runs mock exam
questions marked against the Virtus mark schemes. Students can type or talk.

## Commercial constraints (agreed)

| Item | Value |
|---|---|
| Subscription | £53/month per student (≈ £43 net after VAT and Stripe) |
| Max provider cost per student | £15/month (≈ 65% margin) |
| Credit unit | 1 credit = 1p of real provider cost (Claude + Deepgram), metered from actual usage |
| Included allowance | 1,500 credits/month, released as **50 credits/day**, resets at midnight Europe/London, no rollover |
| Top-up | £5 pack = 300 credits (cost + 25% margin after VAT and Stripe fee). Manual top-ups in any number of packs. Top-up credits do not expire and are spent only after the daily allowance |
| Auto top-up | Optional; buys one £5 pack whenever the student runs dry, capped by a parent-set monthly limit |

## Scope of this build (phase 1)

1. **Content import** — all 783 topics from `/search-index.json`, each topic page's notes
   (`section#onpage-content`), and the Foundation/Higher worksheet and mark scheme PDFs (text extracted).
2. **Tutor** — topic-aware chat with three modes (Learn, Quiz, Mock exam), adaptive learner profile, voice in/out.
3. **Credits** — daily allowance, top-up wallet, auto top-up with monthly cap, hard stop with a clear message.
4. **Accounts** — Supabase Auth email + password; onboarding captures year group, target grade, learning preferences;
   exam board and tier captured per subject.

Out of scope (later phases): Stripe subscription and real card charging (top-ups run in `simulated`
payment mode until then), parental consent flow, multi-topic full mock papers, admin dashboard.

## Architecture

- **Next.js 16 (App Router) on Vercel.** Topic URLs mirror the Virtus site: the Virtus page
  `/biology/ecology/abiotic-and-biotic-factors` links to `<tutor-domain>/learn/biology/ecology/abiotic-and-biotic-factors`.
- **Supabase** (London region): Auth, Postgres (content, profiles, conversations, credits). All credit
  mutations happen in Postgres functions so they are atomic.
- **Claude Sonnet 5** (`claude-sonnet-5`) via `@anthropic-ai/sdk`, streaming, effort `medium`
  (Mock marking uses `high`).
- **Deepgram**: Nova-3 (`en-GB`) pre-recorded speech-to-text; Aura-2 text-to-speech. Proxied through our API
  so keys never reach the browser.

### Knowledge strategy — "load the topic" (approach A)

When a conversation starts, the server loads that topic's notes and the student's tier's worksheet
and mark scheme into the system prompt. Prompt caching makes every later turn read that block at
10% of the input price. No vector search. A Postgres full-text search over topic titles/notes lets the
tutor answer "which topic is this?" by linking to the right topic page.

System prompt layout (stable → volatile, for cache hits):
1. Tutor persona and pedagogy (identical for everyone)
2. Topic pack: notes + worksheet + mark scheme for the chosen tier ← cache breakpoint
3. Learner profile (board, tier, target grade, preferences, recent learner notes) and mode instructions
4. Conversation messages ← automatic cache breakpoint on the latest turn

### Adaptive teaching

- Onboarding: year group, target grade, how they like things explained (step-by-step, examples first,
  analogies, short and direct), confidence.
- The tutor has one tool, `save_learner_note`, to record strengths, struggles, misconceptions and preferences.
  The most recent notes (≤ 20) are injected into every conversation, across topics.
- Voice mode tells the tutor to keep spoken replies short (≈ 600–800 characters) and free of tables/LaTeX.

### Modes

- **Learn** — explain simply, check understanding with one question at a time, build up.
- **Quiz** — quick-fire questions drawn from and styled on the worksheet; immediate feedback.
- **Mock** — exam-style questions with mark allocations for the student's board and tier; student answers;
  tutor marks strictly against the mark scheme, shows marks awarded per point, and gives an examiner tip.

### Credits flow

1. Before a model call: `credit_status(user)` → if available < 1 credit and auto top-up is not possible → 402 with
   `{reason: "daily_limit", resetsAt}`.
2. After the call: compute cost in pence from real usage (input, cache write, cache read, output tokens; audio
   seconds; TTS characters) → `consume_credits(user, credits, meta)` deducts from today's allowance first, then the top-up
   wallet. If the wallet would go negative and auto top-up is on and under the monthly cap, it buys a pack first.
   A single message may overdraw by at most its own cost (never blocks mid-answer).
3. The UI shows today's remaining allowance, top-up balance and the reset time.

Pricing constants live in `src/lib/credits/pricing.ts` (Sonnet 5 $2/$10 per MTok, cache read 10%, 5-minute cache
write 125%; Deepgram Nova-3 $0.0043/min, Aura-2 $0.030 per 1k chars; USD→GBP 0.80 conservative).

### Safety (students are mostly 14–16)

- Stays on GCSE learning; declines unrelated or inappropriate requests kindly.
- Teaches rather than doing homework wholesale: guides to the answer, shows method.
- Safeguarding: if a student discloses harm or distress, respond with care, suggest a trusted adult, and give
  Childline (0800 1111, childline.org.uk). Never ask for personal details.
- `refusal` stop reason and API errors surface as a friendly message; no credits charged for failed calls.
- Privacy policy must disclose that voice audio is processed by Deepgram and text by Anthropic.

## Data model (Postgres)

`topics` · `profiles` · `subject_settings` (board/tier per subject) · `conversations` · `messages` ·
`learner_notes` · `daily_usage` · `wallets` · `topups` · `usage_events` — see `supabase/migrations/`.
Row-level security: students read/write only their own rows; `topics` is readable by all signed-in users;
credit tables are written only through `security definer` functions called with the service role.

## Error handling

- Anthropic 429/5xx: SDK retries (2), then "The tutor is busy, try again in a moment" — no charge.
- Deepgram failure: fall back to typing, show a toast; no charge.
- Credit exhaustion mid-stream is impossible by design (pre-check + allowed overdraw of one message).

## Revision 1 (2026-09-24): teaching quality and voice conversation

**Teaching.** The persona prompt is rewritten around the evidence: worked examples then fading, retrieval,
dual coding, self-explanation, Rosenshine, EEF feedback guidance, and AI-tutor trials (Kestin 2025; Bastani 2025).
Learning-style matching is not supported by evidence (Pashler 2008), so "What helps you understand?" is a starting
point only; every student gets words plus visuals, and a new `interests` field personalises examples.
Rules: replies usually 40–120 words (voice ≤ 60), one idea and one question, first words already teaching (no stock
openers), name at most once per conversation, answer direct questions directly, a real "explain it differently"
routine, hints before answers only for assessed questions, one mock question part at a time with M/A/B marking.
The tutor can draw Mermaid diagrams (flowchart, xychart, pie), rendered client-side; unfenced diagrams are auto-fenced.
`scripts/eval-tutor.mts` runs 11 scripted conversations and flags length, name repeats, filler, emoji and LaTeX misuse.

**Voice.** Hands-free conversation: the browser streams mic audio (16 kHz PCM via an AudioWorklet) straight to
Deepgram Nova-3 live using a 30-second token from `POST /api/voice/session` (needs a Deepgram key with Member
permission), with the topic's key terms boosted. Words appear as spoken; ~2.5 s of silence sends; the tutor's reply is
spoken sentence by sentence while it is still being written (streamed MP3 via Media Source Extensions, full-clip
fallback), then listening resumes. 20 s of silence ends the conversation. Mic time is charged via
`voice_sessions`, capped by the server's own clock. One player instance means one voice at a time; replays come
from an in-memory cache and are not charged again. TTS charges run after the response via `after()`.

## Revision 2 (2026-09-24): maths visuals — "say less, show more"

- **Working-out board** (` ```steps `): one line per step, `LaTeX maths | one spoken-style sentence`. Rendered as a
  numbered whiteboard (plain-text lines, e.g. French verb building, are detected and not rendered as maths). In voice,
  `speechPlan()` turns a reply into prefix-stable segments: prose sentences, then one segment per step tagged with
  its step, so each step highlights while its sentence is spoken and later steps are dimmed.
- **Graphs** (` ```graph `, JSON): up to 3 functions, `params` become sliders, `mark` asks the app to find and label
  roots, turning points, y-intercepts and intersections (touching roots included), `data` for science graphs.
  Drawn as our own SVG from a safe expression parser (`src/lib/maths/expression.ts`, no eval); live root readout
  under the sliders.
- **Prompt**: maths is taught with a worked example on a board first (even for "I don't get X"), words kept short;
  in voice, all maths goes on the board and prose stays ≲ 50 words. Mermaid remains for flowcharts and pie charts.
- **Speech**: maths read in words ("x equals minus 5 plus or minus 1 over 2", "the square root of 3").

## Revision 3 (2026-09-24): interactive lessons, pictures for every subject

Everything the tutor shows is a fenced block in its reply, rendered by `CodeBlock` in `src/components/markdown.tsx`:

| Block | What the student gets |
|---|---|
| `steps` | Working-out board; `[[answer]]` gaps become answer boxes (inline, or numbered boxes with inputs below when the gap sits inside a fraction or root) |
| `graph` | Interactive SVG graph: functions with sliders, or data as line / scatter / bar chart |
| `quiz`, `order`, `explore` | Quick check, put-in-order, "what happens if" formula explorer (LaTeX Greek like `\rho` accepted) |
| `diagram` | Ready-made interactive diagram (below); `mode` labelled / blank / quiz (tap-the-part labelling quiz) |
| `sketch` | Tutor-drawn labelled diagram for anything else (below) |
| `mermaid` | Flowcharts and pie charts |
| `lesson` | Lesson stage marker (hidden; drives the chat's sticky progress bar) |
| `note` | Hidden learner note, saved server-side (replaces the old save-note tool) |

Activity results (quiz, order, gaps, labelling quiz) come back to the tutor as the student's next message.

**Ready-made diagrams** (`src/lib/diagrams/registry.ts`). The prompt's catalogue is generated from the registry, so
adding an entry makes it available to the tutor. Entry modules are plain (no `"use client"`) so the server can read
their names and options; components live in `src/components/diagrams/`.
- Biology (parts diagrams with highlight and labelling quiz): animal cell, plant cell, bacterial cell, heart, leaf.
- Chemistry: atom / ion for elements 1–20 (dot-and-cross ions), UK periodic table (groups 1–7 and 0, tap for
  details), particles in solids / liquids / gases (animated, with a heating slider).
- Physics: transverse / longitudinal wave (sliders, v = fλ), series / parallel circuit (live currents and p.d.s),
  forces and resultant (F = ma), EM spectrum (tap a band for uses and dangers).
A fence named after a diagram (` ```wave `) is treated as that diagram.

**Sketches** (`/api/sketch`, `src/lib/sketch/`). Spec `{title, labels, detail}`. Cache key = SHA-256 of the
normalised title + sorted labels, so the same drawing is reused whatever the wording. Drawn once with Opus 5
(low effort, adaptive thinking; compared with Sonnet 5 and other settings: 13–23 s, 2–6p each), labels placed by our
code in two collision-free columns (`layoutLabels`), checked server-side (`isSafeSvg`), stored in `public.sketches`
with its topic, sanitised again in the browser (DOMPurify), and label columns moved clear of the drawing after
render. Only the first request pays; concurrent requests for the same drawing share one generation. Each topic's
prompt lists the sketches already drawn for it so the tutor reuses them (instant and free).

**No tools.** With tools available the tutor often called one part-way through a reply where a picture belonged
(measured 4–6 of 8 turns) and the picture was lost. Topic links are now `/learn/find?q=…&s=…` (redirects to a clear
match, otherwise lists matches) and learner notes are ` ```note ` blocks. Every turn is one model call. Conversations
stored with tool blocks still replay (tools sent with `tool_choice: none`).

**Full lessons.** Six stages (hook, explain, check, example, try, recap). The server reads the current stage from the
history and adds a one-line reminder to the uncached learner block each turn; the chat shows one sticky progress bar
from the latest stage seen, so an occasional missing marker doesn't matter.

**Science: show the thing.** "Why/how" questions are answered directly with a picture; boards are for calculations
only (worded boards are flagged by the eval).

## Testing

- Unit (Vitest, 242 tests): pricing/cost maths, credit allocation logic, prompt builder, content import helpers,
  activities and gaps, graphs, speech planning, diagrams (geometry checks: labels inside the frame, no crossing
  leader lines), sketch safety/keys/label layout, notes, turn handling.
- Migrations: applied in PGlite (`supabase/migrations.test.ts`).
- Tutor eval (`scripts/eval-tutor.mts`, real API): ~40 scripted conversations across every subject, activity,
  picture, lesson and voice case, with automatic flags (length, name repeats, filler, invalid blocks, missing
  expected picture or activity, worded boards, phantom pictures, lesson stage order, guessed links).
- Browser (dev only `/dev/gallery`): every block type rendered and exercised; chat flows on the dev and production
  builds.
