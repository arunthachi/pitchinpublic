export interface MomentumDay {
  date: string;
  active: boolean;
  isToday: boolean;
}

export function toUtcDateKey(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function startOfUtcDay(value: Date) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function getUtcDateKeyDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return toUtcDateKey(date);
}

export function buildRecentMomentumDays(activeDates: Iterable<string>, dayCount = 7): MomentumDay[] {
  const activeSet = activeDates instanceof Set ? activeDates : new Set(activeDates);
  const today = startOfUtcDay(new Date());

  return Array.from({ length: dayCount }, (_, index) => {
    const offset = dayCount - 1 - index;
    const date = addUtcDays(today, -offset);
    const key = toUtcDateKey(date);

    return {
      date: key,
      active: activeSet.has(key),
      isToday: offset === 0,
    };
  });
}

export function getConsecutiveRun(activeDates: Set<string>, startOffset = 0) {
  let run = 0;

  for (let offset = startOffset; offset < 370; offset += 1) {
    if (!activeDates.has(getUtcDateKeyDaysAgo(offset))) break;
    run += 1;
  }

  return run;
}

export function getLongestRun(activeDates: Set<string>) {
  const dates = Array.from(activeDates).sort();
  let longest = 0;
  let current = 0;
  let previousTime: number | null = null;

  for (const dateKey of dates) {
    const time = new Date(`${dateKey}T00:00:00.000Z`).getTime();

    if (previousTime === null || time - previousTime === 86400000) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    previousTime = time;
  }

  return longest;
}
