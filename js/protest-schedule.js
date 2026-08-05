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

export function normalizeStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  // An empty status means the protest is completed.
  return normalized || "completed";
}

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

// Splits protest days into "actual" (already confirmed/active/tentative/
// completed) and "planned" (status: planned) so that planned protests don't
// inflate the main count shown on the map — they're surfaced separately
// instead, since counting them together can be misleading.
export function countProtestDaysBySchedule(protests) {
  return protests.reduce(
    (totals, protest) => {
      const days = countInclusiveDaysBetweenDates(
        getProtestStartDate(protest),
        getProtestEndDate(protest)
      );

      if (normalizeStatus(protest.status) === "planned") {
        totals.planned += days;
      } else {
        totals.actual += days;
      }

      return totals;
    },
    { actual: 0, planned: 0 }
  );
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
