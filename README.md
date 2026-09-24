# Virtus AI Tutor

A paid GCSE tutor that sits alongside [virtusacademy.co.uk](https://virtusacademy.co.uk). A student opens any
of the 783 topics and the tutor already knows that topic's revision notes, worksheets and mark schemes.
It explains simply, adapts to the student, quizzes them, and runs mock exam questions marked against
the Virtus mark schemes. Students can type or talk.

Design: [docs/superpowers/specs/2026-09-24-virtus-ai-tutor-design.md](docs/superpowers/specs/2026-09-24-virtus-ai-tutor-design.md)

## Stack

- Next.js 16 (App Router), Tailwind 4
- Supabase: Auth, Postgres, row-level security
- Claude Sonnet 5 (`claude-sonnet-5`) for the tutor, with prompt caching
- Deepgram Nova-3 (speech-to-text) and Aura-2 (text-to-speech, British voice)

## Credits

1 credit = 1p of real provider cost. Students get 50 credits a day (1,500 a month on the £53 plan), reset at
midnight UK time. When they run out, they wait for the reset or top up (£5 = 300 credits); auto top-up is
optional and capped per month. Constants live in `src/lib/credits/pricing.ts`.

Measured on Sonnet 5: opening a topic costs about 1.4 credits (writing the topic to the cache); each
follow-up message about 0.35 credits.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in.
3. Create the database schema: run `supabase/migrations/20260924000000_init.sql` against the project
   (Supabase SQL editor, `supabase db push`, or the Supabase MCP).
4. Import the content from virtusacademy.co.uk and load it:
   ```bash
   npx tsx scripts/import-content.ts     # writes data/content/*.json (re-runnable; --force to refresh)
   npx tsx scripts/seed-topics.mts       # upserts into the topics table
   ```
5. In Supabase Auth → URL configuration, set the Site URL and add `<site>/auth/callback` as a redirect URL.
6. `npm run dev`

## Linking from the Virtus site

Tutor URLs mirror the Virtus topic URLs. On any Virtus topic page, link to:

```
https://<tutor-domain>/learn/<same path>
e.g. https://<tutor-domain>/learn/biology/ecology/abiotic-and-biotic-factors
```

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests plus database tests (the migration runs in PGlite, no Docker needed) |
| `npx tsx scripts/try-tutor.mts B076 learn` | Two real tutor turns on one topic, printing usage and credits (~2p) |

## Not built yet

- Stripe: the £53 subscription and real card charging for top-ups (`PAYMENTS_MODE=simulated` grants credits for now)
- Parental consent flow for under-13s, admin dashboard, multi-topic full mock papers
