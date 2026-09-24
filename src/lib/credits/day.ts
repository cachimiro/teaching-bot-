const TZ = "Europe/London";

/** YYYY-MM-DD for the given instant in UK local time. The daily allowance is keyed on this. */
export function londonDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(at);
}

/** Offset of UK local time from UTC at the given instant, in minutes (0 or 60). */
function londonOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")!.value; // "GMT" or "GMT+1"
  const m = name.match(/GMT([+-]\d+)?/);
  return m?.[1] ? Number(m[1]) * 60 : 0;
}

/** The instant of UK-local midnight at the start of the given calendar date. */
function londonMidnight(year: number, monthIndex: number, day: number): Date {
  const utcMidnight = new Date(Date.UTC(year, monthIndex, day));
  // Clocks change at 01:00 UTC, so the offset an hour before UTC midnight is the one in force at local midnight.
  const offset = londonOffsetMinutes(new Date(utcMidnight.getTime() - 60 * 60 * 1000));
  return new Date(utcMidnight.getTime() - offset * 60 * 1000);
}

/** The instant the daily allowance next resets (next midnight in UK local time). */
export function nextLondonMidnight(at: Date = new Date()): Date {
  const [y, mo, d] = londonDay(at).split("-").map(Number);
  return londonMidnight(y, mo - 1, d + 1);
}

/** Start of the current UK calendar month; the parent's auto top-up cap resets here. */
export function londonMonthStart(at: Date = new Date()): Date {
  const [y, mo] = londonDay(at).split("-").map(Number);
  return londonMidnight(y, mo - 1, 1);
}
