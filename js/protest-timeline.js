/*
 * Weekly timeline chart in the sidebar: how many protests were happening
 * in each week (Monday–Sunday). A multi-day protest counts once in every
 * week it overlaps. Bars are stacked into "actual" (already happened) and
 * "planned" (still ahead), by date — the same split as the stats above it.
 */

import {
  getProtestStartDate,
  getProtestEndDate,
  getDateKeyInTimeZone,
  parseProtestDate,
} from "./protest-schedule.js";
import { escapeHtml } from "./text-format.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const CHART_HEIGHT = 96;
const AXIS_HEIGHT = 18;
const BAR_GAP = 2;

const monthFormatter = new Intl.DateTimeFormat("sq", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function startOfWeek(date) {
  const day = date.getUTCDay();
  const offset = (day + 6) % 7; // Monday = 0

  return new Date(date.getTime() - offset * DAY_MS);
}

export function calculateWeeklyProtests(features) {
  const today = parseProtestDate(getDateKeyInTimeZone(new Date()));
  const weeks = new Map();

  for (const feature of features) {
    for (const protest of feature.get("protests") || []) {
      const start = getProtestStartDate(protest);

      if (!start) {
        continue;
      }

      const rawEnd = getProtestEndDate(protest) || start;
      const end = rawEnd < start ? start : rawEnd;

      for (
        let week = startOfWeek(start);
        week <= end;
        week = new Date(week.getTime() + WEEK_MS)
      ) {
        const key = week.getTime();
        const bucket = weeks.get(key) ?? { actual: 0, planned: 0 };

        // First day of this protest that falls inside the week.
        const firstDayInWeek = start > week ? start : week;
        const isPlanned = firstDayInWeek > today;

        bucket[isPlanned ? "planned" : "actual"] += 1;
        weeks.set(key, bucket);
      }
    }
  }

  if (weeks.size === 0) {
    return [];
  }

  // Fill in empty weeks so gaps in activity read as gaps.
  const keys = [...weeks.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const result = [];

  for (let key = first; key <= last; key += WEEK_MS) {
    const bucket = weeks.get(key) ?? { actual: 0, planned: 0 };

    result.push({
      weekStart: new Date(key),
      ...bucket,
      total: bucket.actual + bucket.planned,
    });
  }

  return result;
}

function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);

  return `${monthFormatter.format(weekStart)} – ${monthFormatter.format(weekEnd)}`;
}

// Round the y-axis top up to an even number so the midline is a whole number.
function niceMax(value) {
  return Math.max(4, Math.ceil(value / 2) * 2);
}

function buildBarPath(x, y, width, height, roundTop) {
  if (height <= 0) return "";

  const r = roundTop ? Math.min(3, width / 2, height) : 0;

  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    r ? `Q${x},${y} ${x + r},${y}` : "",
    `H${x + width - r}`,
    r ? `Q${x + width},${y} ${x + width},${y + r}` : "",
    `V${y + height}`,
    "Z",
  ].join("");
}

export function renderProtestTimeline(container, features) {
  if (!container) return;

  const weeks = calculateWeeklyProtests(features);

  if (weeks.length === 0) {
    container.innerHTML =
      '<p class="timeline-empty">Nuk ka ende të dhëna.</p>';
    return;
  }

  const width = container.clientWidth || 264;
  const max = niceMax(Math.max(...weeks.map(week => week.total)));
  const slot = width / weeks.length;
  const barWidth = Math.max(2, slot - BAR_GAP);
  const scale = value => (value / max) * CHART_HEIGHT;

  const bars = weeks
    .map((week, index) => {
      const x = index * slot + (slot - barWidth) / 2;
      const actualHeight = scale(week.actual);
      const plannedHeight = scale(week.planned);
      const actualY = CHART_HEIGHT - actualHeight;
      // 2px surface gap between the stacked segments.
      const gap = week.actual && week.planned ? BAR_GAP : 0;
      const plannedY = actualY - plannedHeight;

      return `
        <g class="timeline-bar" data-week-index="${index}">
          <rect class="timeline-hit" x="${index * slot}" y="0"
            width="${slot}" height="${CHART_HEIGHT}"></rect>
          <path class="timeline-actual"
            d="${buildBarPath(x, actualY, barWidth, actualHeight, !week.planned)}"></path>
          <path class="timeline-planned"
            d="${buildBarPath(x, plannedY, barWidth, Math.max(0, plannedHeight - gap), true)}"></path>
        </g>`;
    })
    .join("");

  const firstLabel = monthFormatter.format(weeks[0].weekStart);
  const lastLabel = monthFormatter.format(weeks.at(-1).weekStart);
  const hasPlanned = weeks.some(week => week.planned > 0);

  const tableRows = weeks
    .map(week => `
      <tr>
        <th scope="row">${escapeHtml(formatWeekRange(week.weekStart))}</th>
        <td>${week.actual}</td>
        <td>${week.planned}</td>
      </tr>`)
    .join("");

  container.innerHTML = `
    <div class="timeline-chart">
      <svg class="timeline-svg" width="${width}"
        height="${CHART_HEIGHT + AXIS_HEIGHT}"
        viewBox="0 0 ${width} ${CHART_HEIGHT + AXIS_HEIGHT}"
        aria-hidden="true">
        <line class="timeline-grid" x1="0" x2="${width}" y1="0.5" y2="0.5"></line>
        <line class="timeline-grid" x1="0" x2="${width}"
          y1="${CHART_HEIGHT / 2}" y2="${CHART_HEIGHT / 2}"></line>
        ${bars}
        <line class="timeline-baseline" x1="0" x2="${width}"
          y1="${CHART_HEIGHT + 0.5}" y2="${CHART_HEIGHT + 0.5}"></line>
        <text class="timeline-axis" x="0" y="${CHART_HEIGHT + 13}">${escapeHtml(firstLabel)}</text>
        <text class="timeline-axis" x="${width}" y="${CHART_HEIGHT + 13}"
          text-anchor="end">${escapeHtml(lastLabel)}</text>
      </svg>
      <span class="timeline-max">${max}</span>
      <span class="timeline-mid">${max / 2}</span>
      <div class="timeline-tooltip" hidden></div>
    </div>

    <div class="timeline-legend">
      <span><span class="status-dot status-completed" aria-hidden="true"></span>Të ndodhura</span>
      ${hasPlanned
        ? '<span><span class="status-dot status-planned" aria-hidden="true"></span>Të planifikuara</span>'
        : ""}
    </div>

    <table class="visually-hidden">
      <caption>Protesta në javë</caption>
      <thead>
        <tr><th scope="col">Java</th><th scope="col">Të ndodhura</th><th scope="col">Të planifikuara</th></tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`;

  const chart = container.querySelector(".timeline-chart");
  const tooltip = container.querySelector(".timeline-tooltip");

  const hideTooltip = () => {
    tooltip.hidden = true;
    chart.querySelector(".is-active")?.classList.remove("is-active");
  };

  chart.addEventListener("pointermove", event => {
    const bar = event.target.closest?.("[data-week-index]");

    if (!bar) {
      hideTooltip();
      return;
    }

    const index = Number(bar.dataset.weekIndex);
    const week = weeks[index];

    chart.querySelector(".is-active")?.classList.remove("is-active");
    bar.classList.add("is-active");

    tooltip.innerHTML = `
      <strong>${escapeHtml(formatWeekRange(week.weekStart))}</strong>
      <span><span class="status-dot status-completed"></span>Të ndodhura <b>${week.actual}</b></span>
      ${week.planned
        ? `<span><span class="status-dot status-planned"></span>Të planifikuara <b>${week.planned}</b></span>`
        : ""}`;
    tooltip.hidden = false;

    // Keep the tooltip inside the chart horizontally.
    const center = index * slot + slot / 2;
    const tooltipWidth = tooltip.offsetWidth;
    const left = Math.min(
      Math.max(0, center - tooltipWidth / 2),
      width - tooltipWidth
    );

    tooltip.style.left = `${left}px`;
  });

  chart.addEventListener("pointerleave", hideTooltip);
}
