/*
 * Status normalization and date/schedule math for individual protests —
 * used by the marker rendering, the city popup, and the upcoming list.
 *
 * Note: this duplicates some date parsing that `protest-data.js` already
 * does (`parseIsoDate`/`countInclusiveDays` there vs. `parseProtestDate`/
 * `countInclusiveDaysBetweenDates` here). They aren't identical — this
 * version also falls back to `new Date(text)` for non-ISO strings — so
 * they weren't merged as part of this reorganization to avoid changing
 * behavior; worth consolidating later if that fallback turns out unused.
 */

export function parseProtestDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  // YYYY-MM-DD
  const isoMatch = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (isoMatch) {
    return new Date(
      Date.UTC(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3])
      )
    );
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

export function getProtestStartDate(protest) {
  return parseProtestDate(
    protest.startDate ||
    protest.start_date ||
    protest.date
  );
}

export function getProtestEndDate(protest) {
  return parseProtestDate(
    protest.endDate ||
    protest.end_date ||
    protest.startDate ||
    protest.start_date ||
    protest.date
  );
}

export function sortProtests(protests) {
  return [...protests].sort(
    (first, second) => {
      const firstDate =
        getProtestStartDate(first)?.getTime() ?? 0;

      const secondDate =
        getProtestStartDate(second)?.getTime() ?? 0;

      // Newest first.
      return secondDate - firstDate;
    }
  );
}

export function countInclusiveDaysBetweenDates(startDate, endDate) {
  if (!startDate) return 1;

  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );

  const effectiveEnd = endDate || startDate;

  const end = Date.UTC(
    effectiveEnd.getUTCFullYear(),
    effectiveEnd.getUTCMonth(),
    effectiveEnd.getUTCDate()
  );

  if (end < start) return 1;

  return (
    Math.floor(
      (end - start) / (24 * 60 * 60 * 1000)
    ) + 1
  );
}

// Splits protest days into "actual" (days up to and including today) and
// "planned" (days still ahead) so that only what's genuinely still
// ahead inflates the "planned" count — see splitProtestDays() below.
export function countProtestDaysBySchedule(protests) {
  return protests.reduce(
    (totals, protest) => {
      const { actual, planned } = splitProtestDays(protest);

      totals.actual += actual;
      totals.planned += planned;

      return totals;
    },
    { actual: 0, planned: 0 }
  );
}

// Splits a single protest's day range into "actual" and "planned" days,
// purely by date: days up to and including today count as "actual", the
// remaining days ahead as "planned". This matters for an in-progress
// ("active") range like "7 Aug – 31 Aug" viewed on the 9th — the 7th–9th
// already happened, the rest haven't yet.
export function splitProtestDays(protest) {
  const start = getProtestStartDate(protest);
  const end = getProtestEndDate(protest);
  const totalDays = countInclusiveDaysBetweenDates(start, end);

  if (!start) {
    return { actual: totalDays, planned: 0 };
  }

  const todayKey = getDateKeyInTimeZone(new Date());
  const startKey = getDateKeyInTimeZone(start);

  // Hasn't started yet — nothing has happened, every day is still ahead.
  if (startKey > todayKey) {
    return { actual: 0, planned: totalDays };
  }

  const elapsedDays = countInclusiveDaysBetweenDates(
    start,
    parseProtestDate(todayKey)
  );

  const actual = Math.min(elapsedDays, totalDays);

  return {
    actual,
    planned: totalDays - actual,
  };
}

const CENTRAL_EUROPE_TIMEZONE = "Europe/Berlin";

export function getDateKeyInTimeZone(
  date,
  timeZone = CENTRAL_EUROPE_TIMEZONE
) {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getProtestDateKey(value) {
  if (!value) return "";

  const text = String(value).trim();
  const isoMatch = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (isoMatch) {
    return [
      isoMatch[1],
      isoMatch[2].padStart(2, "0"),
      isoMatch[3].padStart(2, "0"),
    ].join("-");
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? ""
    : getDateKeyInTimeZone(parsed);
}

export function isProtestToday(protest) {
  const today = getDateKeyInTimeZone(new Date());
  const start = getProtestDateKey(
    protest.startDate ||
    protest.start_date ||
    protest.date
  );
  const end = getProtestDateKey(
    protest.endDate ||
    protest.end_date ||
    protest.startDate ||
    protest.start_date ||
    protest.date
  );

  return Boolean(
    start &&
    today >= start &&
    today <= (end || start)
  );
}

// Status is deliberately derived at render time, so it stays current without
// a spreadsheet status column or a fresh data import at midnight.
export function getEffectiveStatus(protest) {
  const start = getProtestDateKey(
    protest.startDate ||
    protest.start_date ||
    protest.date
  );
  const end = getProtestDateKey(
    protest.endDate ||
    protest.end_date ||
    protest.startDate ||
    protest.start_date ||
    protest.date
  );

  if (!start) return "completed";

  const today = getDateKeyInTimeZone(new Date());

  if ((end || start) < today) return "completed";
  if (start > today) return "planned";
  return "active";
}
