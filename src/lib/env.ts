function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

/** Read lazily so `next build` works without secrets present. */
export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  deepgramApiKey: () => required("DEEPGRAM_API_KEY"),
  deepgramVoice: () => process.env.DEEPGRAM_VOICE ?? "aura-2-pandora-en",
  /** "simulated" grants top-ups without charging a card (until Stripe is wired up). */
  paymentsMode: () => (process.env.PAYMENTS_MODE ?? "simulated") as "simulated" | "stripe",
};
