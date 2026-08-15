import { getProtestDayCount } from "./protest-data.js";
import { splitProtestDays } from "./protest-schedule.js";

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
      // Days that already happened count as actual even for an
      // in-progress "planned" range — only the days still ahead count
      // as planned. See splitProtestDays() for why.
      const { actual, planned } = splitProtestDays(protest);

      stats.actualDays += actual;
      stats.plannedDays += planned;

      if (protest.importance === "major" || protest.major === true) {
        stats.majorDays += getProtestDayCount(protest);
      }
    }
  }

  return stats;
}
