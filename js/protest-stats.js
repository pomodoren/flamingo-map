import { getProtestDayCount } from "./protest-data.js";
import { getEffectiveStatus } from "./protest-schedule.js";

export function calculateProtestStatistics(features) {
  const stats = {
    cities: features.length,
    // Days already confirmed/active/tentative/completed — the headline
    // number. Planned days are tracked separately below so they don't
    // inflate it, matching how the map markers split "actual" vs "planned".
    actualDays: 0,
    plannedDays: 0,
    majorDays: 0,
  };

  for (const feature of features) {
    const protests = feature.get("protests") || [];

    for (const protest of protests) {
      const days = getProtestDayCount(protest);
      const status = getEffectiveStatus(protest);

      if (status === "planned") {
        stats.plannedDays += days;
      } else {
        stats.actualDays += days;
      }

      if (protest.importance === "major" || protest.major === true) {
        stats.majorDays += days;
      }
    }
  }

  return stats;
}
