import { getProtestDayCount } from "./protest-data.js";

function normalizeStatus(value) {
  const status = String(value || "completed").trim().toLowerCase();
  return status === "planned" ? "planned" : status;
}

export function calculateProtestStatistics(features) {
  const stats = {
    cities: features.length,
    protestDays: 0,
    confirmedDays: 0,
    tentativeDays: 0,
    completedDays: 0,
    majorDays: 0,
  };

  for (const feature of features) {
    const protests = feature.get("protests") || [];

    for (const protest of protests) {
      const days = getProtestDayCount(protest);
      const status = normalizeStatus(protest.status);

      stats.protestDays += days;

      if (["confirmed", "planned", "active"].includes(status)) {
        stats.confirmedDays += days;
      } else if (status === "tentative") {
        stats.tentativeDays += days;
      } else if (status === "completed") {
        stats.completedDays += days;
      }

      if (protest.importance === "major" || protest.major === true) {
        stats.majorDays += days;
      }
    }
  }

  return stats;
}
