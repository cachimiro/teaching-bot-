import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Mimics the parts of Supabase the migrations rely on: auth.users, auth.uid(),
// the anon/authenticated/service_role roles, and Supabase's default grants.
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");
const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
const DAY = "2026-09-24";

let db: PGlite;

async function consume(user: string, credits: number, day = DAY, allowance = 50) {
  const { rows } = await db.query<{ from_daily: string; from_wallet: string; daily_used: string; wallet_balance: string }>(
    `select * from public.consume_credits($1, $2, $3, $4, 'chat', null, '{}')`,
    [user, day, allowance, credits],
  );
  const r = rows[0];
  return {
    fromDaily: Number(r.from_daily),
    fromWallet: Number(r.from_wallet),
    dailyUsed: Number(r.daily_used),
    wallet: Number(r.wallet_balance),
  };
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'a@x.test'), ('${BOB}', 'b@x.test')`);
  await db.exec(`insert into public.topics (id, subject, unit, unit_name, slug, title, url)
                 values ('B076', 'biology', 'ecology', 'Ecology', 'abiotic-and-biotic-factors',
                         'Abiotic and Biotic Factors', '/biology/ecology/abiotic-and-biotic-factors')`);
});

describe("new user bootstrap", () => {
  it("creates a profile and an empty wallet", async () => {
    const { rows } = await db.query<{ n: number }>(
      `select (select count(*) from public.profiles where user_id = $1)::int +
              (select count(*) from public.wallets where user_id = $1 and balance = 0)::int as n`,
      [ALICE],
    );
    expect(rows[0].n).toBe(2);
  });
});

describe("consume_credits", () => {
  it("spends today's allowance first", async () => {
    expect(await consume(ALICE, 10)).toEqual({ fromDaily: 10, fromWallet: 0, dailyUsed: 10, wallet: 0 });
  });

  it("spills over into the wallet once the allowance is used up", async () => {
    await consume(ALICE, 45);
    expect(await consume(ALICE, 8)).toEqual({ fromDaily: 5, fromWallet: 3, dailyUsed: 50, wallet: -3 });
  });

  it("gives a fresh allowance on a new day", async () => {
    await consume(ALICE, 50);
    expect(await consume(ALICE, 4, "2026-09-25")).toMatchObject({ fromDaily: 4, fromWallet: 0 });
  });

  it("keeps each student's allowance separate", async () => {
    await consume(ALICE, 50);
    expect(await consume(BOB, 5)).toMatchObject({ fromDaily: 5, fromWallet: 0 });
  });

  it("records a usage event", async () => {
    await consume(ALICE, 2.5);
    const { rows } = await db.query<{ credits: string }>(`select credits from public.usage_events where user_id = $1`, [ALICE]);
    expect(rows.map((r) => Number(r.credits))).toEqual([2.5]);
  });

  it("rejects negative charges", async () => {
    await expect(consume(ALICE, -1)).rejects.toThrow(/non-negative/);
  });
});

describe("grant_topup and credit_status", () => {
  it("adds top-up credits to the wallet and counts auto top-up spend for the month", async () => {
    await db.query(`select public.grant_topup($1, 'auto', 1, 500, 300, 'sim_1')`, [ALICE]);
    await db.query(`select public.grant_topup($1, 'manual', 2, 1000, 600, 'sim_2')`, [ALICE]);
    await consume(ALICE, 60);

    const { rows } = await db.query<Record<string, unknown>>(
      `select * from public.credit_status($1, $2, '2026-09-01T00:00:00Z')`,
      [ALICE, DAY],
    );
    expect(Number(rows[0].daily_used)).toBe(50);
    expect(Number(rows[0].wallet_balance)).toBe(890);
    expect(rows[0].auto_spent_pence).toBe(500); // manual top-ups don't count toward the auto cap
    expect(rows[0].monthly_cap_pence).toBe(2000);
    expect(rows[0].auto_topup).toBe(false);
  });
});

describe("row-level security", () => {
  async function asUser(user: string, sql: string) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
    try {
      return await db.query<Record<string, unknown>>(sql);
    } finally {
      await db.exec(`reset role;`);
    }
  }

  it("hides other students' conversations", async () => {
    await db.exec(`insert into public.conversations (user_id, topic_id, mode, tier, exam_board)
                   values ('${BOB}', 'B076', 'learn', 'higher', 'AQA')`);
    const { rows } = await asUser(ALICE, `select * from public.conversations`);
    expect(rows).toHaveLength(0);
  });

  it("stops students granting themselves credits", async () => {
    await expect(asUser(ALICE, `select public.grant_topup('${ALICE}', 'admin', 1, 0, 9999, null)`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("stops students changing their own subscription status", async () => {
    await expect(
      asUser(ALICE, `update public.profiles set subscription_status = 'active' where user_id = '${ALICE}'`),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets students update their learning preferences", async () => {
    await asUser(ALICE, `update public.profiles set target_grade = '7' where user_id = '${ALICE}'`);
    const { rows } = await db.query<{ target_grade: string }>(`select target_grade from public.profiles where user_id = $1`, [ALICE]);
    expect(rows[0].target_grade).toBe("7");
  });
});
