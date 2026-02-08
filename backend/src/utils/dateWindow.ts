export function formatDateUtcYYYYMMDD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const start = startOfUtcDay(date);
  return new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + days,
    ),
  );
}

export function utcDayRangeWindow(
  windowDays: number,
  now = new Date(),
): {
  start: Date;
  endExclusive: Date;
  dates: string[];
} {
  const todayStart = startOfUtcDay(now);
  const start = addUtcDays(todayStart, -(windowDays - 1));
  const endExclusive = addUtcDays(todayStart, 1);

  const dates: string[] = [];
  for (let i = 0; i < windowDays; i += 1) {
    dates.push(formatDateUtcYYYYMMDD(addUtcDays(start, i)));
  }

  return { start, endExclusive, dates };
}
