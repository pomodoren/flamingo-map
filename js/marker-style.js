import {
  normalizeStatus,
  countProtestDaysBySchedule,
} from "./protest-schedule.js";

/*
 * Everything to do with how a city marker looks on the map: its status
 * (which drives color), and the ol.style.Style array showing the count
 * (with a raised "+N planned" suffix when relevant).
 */

// Protests belonging to a city, narrowed down to whichever statuses are
// currently checked in the "Statusi" filter. Every city in the real data
// that has a planned protest also has a completed one, so filtering by
// city visibility alone never hid anything — the marker itself (count,
// size, color) needs to be computed from this filtered subset too.
export function getFilteredProtests(feature, selectedStatuses) {
  const protests = feature.get("protests") || [];

  if (selectedStatuses.size === 0) {
    return protests;
  }

  return protests.filter(protest =>
    selectedStatuses.has(
      normalizeStatus(protest.status)
    )
  );
}

export function getMarkerStatus(feature, selectedStatuses) {
  const protests = getFilteredProtests(feature, selectedStatuses);

  const hasMajor = protests.some(
    protest =>
      protest.importance === "major" ||
      protest.major === true
  );

  const hasActive = protests.some(
    protest =>
      normalizeStatus(protest.status) === "active"
  );

  const hasConfirmed = protests.some(protest =>
    ["confirmed", "planned"].includes(
      normalizeStatus(protest.status)
    )
  );

  const hasTentative = protests.some(
    protest =>
      normalizeStatus(protest.status) ===
      "tentative"
  );

  if (hasActive) {
    return "active";
  }

  if (hasConfirmed) {
    return "confirmed";
  }

  if (hasTentative) {
    return "tentative";
  }

  if (hasMajor) {
    return "major";
  }

  return "completed";
}

const MARKER_MAIN_FONT =
  "700 13px Inter, system-ui, sans-serif";
const MARKER_SUP_FONT =
  "700 10px Inter, system-ui, sans-serif";

// Offscreen canvas used only to measure text widths so the main count
// and the "+planned" suffix can be laid out and centered precisely,
// however many digits either one has.
const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d");

function measureTextWidth(text, font) {
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

const styleCache = new Map();

export function getMarkerStyle(feature, selectedStatuses) {
  const protests = getFilteredProtests(feature, selectedStatuses);
  const { actual, planned } =
    countProtestDaysBySchedule(protests);
  const count = Math.max(1, actual + planned);
  const markerStatus =
    feature.get("markerStatus") ||
    getMarkerStatus(feature, selectedStatuses);

  const radius = Math.min(
    28,
    7 + Math.sqrt(count) * 4
  );

  // Planned days are shown as a raised "+N" suffix (e.g. "3 ⁺2") so they
  // read as an addendum rather than being folded into the main count.
  // It's rendered as its own text layer (not tiny Unicode superscript
  // glyphs) so it stays legible even for two-digit values like "+30".
  const mainLabel = String(actual);
  const supLabel = planned > 0 ? `+${planned}` : "";

  const cacheKey = `${mainLabel}${supLabel}-${markerStatus}`;

  if (styleCache.has(cacheKey)) {
    return styleCache.get(cacheKey);
  }

  const markerColors = {
    active: "#22c55e",
    confirmed: "#22c55e",
    tentative: "#facc15",
    completed: "#d72657",
    major: "#8e1539",
  };

  const ringColors = {
    active: "#16a34a",
    confirmed: "#16a34a",
    tentative: "#eab308",
  };

  const fillColor =
    markerColors[markerStatus] || "#d72657";

  const styles = [];

  if (
    markerStatus === "active" ||
    markerStatus === "confirmed" ||
    markerStatus === "tentative"
  ) {
    styles.push(
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: radius + 5,

          fill: new ol.style.Fill({
            color: "rgba(0, 0, 0, 0)",
          }),

          stroke: new ol.style.Stroke({
            color: ringColors[markerStatus],
            width: 5,
          }),
        }),
      })
    );
  }

  const textFill = new ol.style.Fill({
    color: "#ffffff",
  });

  const textStroke = new ol.style.Stroke({
    color: "rgba(0, 0, 0, 0.22)",
    width: 2,
  });

  // Center the main count and the "+planned" suffix as one block, using
  // measured widths so it lines up correctly no matter how many digits
  // either piece has.
  const mainWidth = measureTextWidth(
    mainLabel,
    MARKER_MAIN_FONT
  );

  const supWidth = supLabel
    ? measureTextWidth(supLabel, MARKER_SUP_FONT)
    : 0;

  const gap = supLabel ? 2 : 0;
  const blockWidth = mainWidth + gap + supWidth;
  const blockStartX = -blockWidth / 2;

  styles.push(
    new ol.style.Style({
      image: new ol.style.Circle({
        radius,

        fill: new ol.style.Fill({
          color: fillColor,
        }),

        stroke: new ol.style.Stroke({
          color: "#ffffff",
          width: 2.5,
        }),
      }),

      text: new ol.style.Text({
        text: mainLabel,
        font: MARKER_MAIN_FONT,
        offsetX:
          blockStartX + mainWidth / 2,
        fill: textFill,
        stroke: textStroke,
      }),
    })
  );

  if (supLabel) {
    styles.push(
      new ol.style.Style({
        text: new ol.style.Text({
          text: supLabel,
          font: MARKER_SUP_FONT,
          offsetX:
            blockStartX +
            mainWidth +
            gap +
            supWidth / 2,
          offsetY: -5,
          fill: textFill,
          stroke: textStroke,
        }),
      })
    );
  }

  styleCache.set(cacheKey, styles);

  return styles;
}

export function clearMarkerStyleCache() {
  styleCache.clear();
}
