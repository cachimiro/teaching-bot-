const GRACE_SECONDS = 2;
const UNREPORTED_CAP_SECONDS = 120;

/**
 * Seconds of live listening to charge for. The client reports how long the mic was streaming;
 * the server's own clock caps it, so a student can't claim more (or dodge charges entirely by
 * never reporting: abandoned sessions are billed on server time, up to 2 minutes).
 */
export function billableSeconds(reported: number | null, startedAt: Date, now: Date): number {
  const elapsed = Math.max((now.getTime() - startedAt.getTime()) / 1000, 0);
  if (reported === null) return Math.min(elapsed, UNREPORTED_CAP_SECONDS);
  return Math.min(Math.max(reported, 0), elapsed + GRACE_SECONDS);
}
