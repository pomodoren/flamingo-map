import { UPCOMING_STATUSES } from "./config.js";

export function parseIsoDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function countInclusiveDays(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate || startDate);

  if (!start || !end || end < start) return 1;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function getProtestDayCount(protest) {
  const explicit = Number(protest?.protestDays);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return countInclusiveDays(protest?.startDate || protest?.date, protest?.endDate);
}

function safeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeProtest(row, index = 0, fallbackCityId = "") {
  if (!row || typeof row !== "object") return null;

  const id = String(
    row.id || row.protest_id || `${fallbackCityId || "protest"}-${index + 1}`
  ).trim();
  const title = String(row.title || row.name || "Untitled protest").trim();
  const startDate = String(row.startDate || row.start_date || row.date || "").trim();
  const endDate = String(row.endDate || row.end_date || startDate).trim();
  const participantsValue = row.participants == null ? "" : String(row.participants).trim();

  const protest = {
    id,
    cityId: String(row.cityId || row.city_id || fallbackCityId || "").trim(),
    title,
    startDate,
    endDate,
    status: String(row.status || "completed").trim().toLowerCase(),
    importance: String(row.importance || "normal").trim().toLowerCase(),
    description: String(row.description || "").trim(),
    location: String(row.location || "").trim(),
    participants: participantsValue || null,
    source: String(row.source || "").trim(),
    sourceUrl: safeUrl(row.sourceUrl || row.source_url || row.url),
  };

  protest.protestDays = getProtestDayCount({
    ...protest,
    protestDays: row.protestDays ?? row.protest_days,
  });

  return protest;
}

export function normalizeLocation(location) {
  if (!location || typeof location !== "object") return null;

  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lon ?? location.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const id = String(
    location.id || location.city_id || location.city || `${latitude}-${longitude}`
  );

  const protests = Array.isArray(location.protests)
    ? location.protests
        .map((protest, index) => normalizeProtest(protest, index, id))
        .filter(Boolean)
    : [];

  const calculatedDayCount = protests.reduce(
    (total, protest) => total + getProtestDayCount(protest),
    0
  );

  return {
    id,
    title: String(location.title || location.city || "Unknown city"),
    city: String(location.city || location.title || ""),
    country: String(location.country || ""),
    latitude,
    longitude,
    cityUrl: String(location.cityUrl || location.city_url || location.url || ""),
    instagramUrl: String(
      location.instagramUrl || location.instagram_url || location.instagram || ""
    ),
    facebookUrl: String(
      location.facebookUrl || location.facebook_url || location.facebook || ""
    ),
    protests,
    protestGroupCount: protests.length,
    // Always derive this from the date ranges. This avoids stale precomputed values.
    protestCount: calculatedDayCount,
    markerStatus: String(location.markerStatus || location.marker_status || ""),
    hasUpcoming: protests.some(protest => UPCOMING_STATUSES.has(protest.status)),
  };
}
