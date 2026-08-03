import { DATA_URL } from "./js/config.js";
import { normalizeLocation } from "./js/protest-data.js";
import { calculateProtestStatistics } from "./js/protest-stats.js";

/* =========================================================
   DOM elements
   ========================================================= */

const mapElement = document.getElementById("map");
const cityDetailsDialogElement = document.getElementById(
  "city-details-dialog"
);
const cityDetailsDialogContentElement = document.getElementById(
  "city-details-dialog-content"
);
const cityDetailsGalleryElement = document.getElementById(
  "city-details-gallery"
);
const cityDetailsGalleryTitleElement = document.getElementById(
  "city-details-gallery-title"
);
const cityDetailsGalleryFrameElement = document.getElementById(
  "city-details-gallery-frame"
);
const cityDetailsGalleryExternalElement = document.getElementById(
  "city-details-gallery-external"
);

const messageElement = document.getElementById("map-message");
const searchElement = document.getElementById("search");

const visibleCountElement = document.getElementById("visible-count");
const protestCountElement = document.getElementById("protest-count");
const confirmedCountElement = document.getElementById("confirmed-count");
const tentativeCountElement = document.getElementById("tentative-count");
const completedCountElement = document.getElementById("completed-count");
const majorCountElement = document.getElementById("major-count");

const panelElement = document.getElementById("map-panel");
const sidebarHandleElement = document.getElementById("sidebar-handle");
const closePanelElement = document.getElementById("close-panel");

const upcomingRailElement = document.getElementById("upcoming-rail");
const upcomingListElement = document.getElementById("upcoming-list");
const upcomingToggleElement = document.getElementById("toggle-upcoming");

const statusFilters = Array.from(
  document.querySelectorAll(".status-filter")
);

let cityDetailsDialogTrigger = null;
let activeCityDetails = null;

/* =========================================================
   OpenLayers map
   ========================================================= */

const source = new ol.source.Vector();
const styleCache = new Map();

function getMarkerStatus(feature) {
  const protests = feature.get("protests") || [];

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

function getMarkerStyle(feature) {
  const protests = feature.get("protests") || [];
  const count = Math.max(1, countProtestDays(protests));
  const markerStatus =
    feature.get("markerStatus") ||
    getMarkerStatus(feature);

  const radius = Math.min(
    28,
    7 + Math.sqrt(count) * 4
  );

  const cacheKey = `${count}-${markerStatus}`;

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
        text: String(count),
        font: "700 13px Inter, system-ui, sans-serif",

        fill: new ol.style.Fill({
          color: "#ffffff",
        }),

        stroke: new ol.style.Stroke({
          color: "rgba(0, 0, 0, 0.22)",
          width: 2,
        }),
      }),
    })
  );

  styleCache.set(cacheKey, styles);

  return styles;
}

const locationLayer = new ol.layer.Vector({
  source,
  style: feature => getMarkerStyle(feature),
});



const baseMapLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

    attributions:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',

    crossOrigin: "anonymous",
    maxZoom: 19,
  }),
});

const map = new ol.Map({
  target: mapElement,

  layers: [
    baseMapLayer,
    locationLayer,
  ],

  view: new ol.View({
    center: ol.proj.fromLonLat([
      14.5,
      45.5,
    ]),

    zoom: 4,
    minZoom: 2,
    maxZoom: 19,
  }),
});

/* =========================================================
   Utilities
   ========================================================= */

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]
  );
}

function safeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(
      value,
      window.location.href
    );

    return ["http:", "https:"].includes(
      url.protocol
    )
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const normalizedValue = String(value).trim();

  const date = new Date(
    `${normalizedValue}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(normalizedValue);
  }

  return new Intl.DateTimeFormat(
    "sq-AL",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(date);
}

function normalizeStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  // An empty status means the protest is completed.
  return normalized || "completed";
}

function selectedValues(elements) {
  return new Set(
    elements
      .filter(element => element.checked)
      .map(element => element.value)
  );
}

/* =========================================================
   Popup rendering
   ========================================================= */

function buildCityLinks(feature, city) {
  const cityUrl = safeUrl(
    feature.get("cityUrl")
  );

  const instagramUrl = safeUrl(
    feature.get("instagramUrl")
  );

  const facebookUrl = safeUrl(
    feature.get("facebookUrl")
  );

  const hasGallery = Boolean(
    getDriveGalleryUrl({
      driveGalleryUrl: feature.get("driveGalleryUrl"),
    })
  );

  if (
    !cityUrl &&
    !instagramUrl &&
    !facebookUrl &&
    !hasGallery
  ) {
    return "";
  }

  return `
    <div class="community-socials">
      ${
        cityUrl
          ? `
            <a
              class="social-link social-city"
              href="${cityUrl}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hap faqen e komunitetit ${city}"
              title="Faqja e komunitetit"
            >
              <span aria-hidden="true">↗</span>
              <span>Komuniteti</span>
            </a>
          `
          : ""
      }

      ${
        instagramUrl
          ? `
            <a
              class="social-link social-instagram"
              href="${instagramUrl}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="${city} në Instagram"
              title="Instagram"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="5"
                ></rect>

                <circle
                  cx="12"
                  cy="12"
                  r="4"
                ></circle>

                <circle
                  cx="17.5"
                  cy="6.5"
                  r="1"
                  class="social-icon-fill"
                ></circle>
              </svg>

              <span>Instagram</span>
            </a>
          `
          : ""
      }

      ${
        facebookUrl
          ? `
            <a
              class="social-link social-facebook"
              href="${facebookUrl}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="${city} në Facebook"
              title="Facebook"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M14 8h3V4h-3c-3.3 0-5 2-5 5v3H6v4h3v8h4v-8h3.2l.8-4H13V9c0-.7.3-1 1-1z"
                  class="social-icon-fill"
                ></path>
              </svg>

              <span>Facebook</span>
            </a>
          `
          : ""
      }

      ${
        hasGallery
          ? `
            <button
              class="social-link social-gallery"
              type="button"
              data-city-gallery-open
              aria-label="Shiko fotot nga protestat në ${city}"
              title="Shiko fotot"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4h12a2 2 0 0 1 2 2v10"></path>
                <rect x="3" y="7" width="16" height="13" rx="2"></rect>
                <circle cx="8.5" cy="11.5" r="1.5"></circle>
                <path d="m5 18 4-4 3 3 2-2 3 3"></path>
              </svg>
              <span>Shiko fotot</span>
            </button>
          `
          : ""
      }
    </div>
  `;
}

function getStatusLabel(status) {
  const labels = {
    confirmed: "E konfirmuar",
    planned: "E ardhshme",
    active: "Në zhvillim",
    tentative: "E pakonfirmuar",
    completed: "E përfunduar",
    cancelled: "E anuluar",
  };

  return labels[status] || status;
}

function renderProtestItem(protest) {
  const title = escapeHtml(
    protest.title || "Protestë pa titull"
  );

  const startDate = formatDate(protest.startDate || protest.date);
  const endDate = formatDate(protest.endDate);
  const date =
    endDate && endDate !== startDate
      ? `${startDate} – ${endDate}`
      : startDate;

  const status = normalizeStatus(
    protest.status
  );

  const safeStatus = escapeHtml(status);

  const statusLabel = escapeHtml(
    getStatusLabel(status)
  );

  const description = escapeHtml(
    protest.description
  );

  const location = escapeHtml(
    protest.location
  );

  const isMajor =
    protest.importance === "major" ||
    protest.major === true;

  const participants =
    protest.participants === null ||
    protest.participants === undefined
      ? ""
      : String(protest.participants).trim();

  const sourceUrl = safeUrl(
    protest.sourceUrl || protest.url
  );

  const source = escapeHtml(protest.source);

  const isUpcoming = [
    "confirmed",
    "planned",
    "active",
    "tentative",
  ].includes(status);

  return `
    <article
      class="
        protest-item
        protest-item-${safeStatus}
        ${isUpcoming ? "protest-item-upcoming" : ""}
        ${isMajor ? "protest-item-major" : ""}
      "
    >

      <h4>${title}</h4>

      <div class="protest-item-meta">
        ${
          date
            ? `<span>${date}</span>`
            : ""
        }

        <span
          class="
            protest-status
            protest-status-${safeStatus}
          "
        >
          ${statusLabel}
        </span>

        ${
          location
            ? `<span>${location}</span>`
            : ""
        }

        ${
          participants
            ? `<span>${escapeHtml(participants)} participants</span>`
            : ""
        }
      </div>

      ${
        description
          ? `<p>${description}</p>`
          : ""
      }
      <br>
      ${
        sourceUrl
          ? `
            <a
              href="${sourceUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${source ? `Burimi: ${source} →` : "View source →"}
            </a>
          `
          : source
            ? `<p class="protest-source">Burimi: ${source}</p>`
            : ""
      }
    </article>
  `;
}

function parseProtestDate(value) {
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

function getProtestStartDate(protest) {
  return parseProtestDate(
    protest.startDate ||
    protest.start_date ||
    protest.date
  );
}

function getProtestEndDate(protest) {
  return parseProtestDate(
    protest.endDate ||
    protest.end_date ||
    protest.startDate ||
    protest.start_date ||
    protest.date
  );
}

function sortProtests(protests) {
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

function countInclusiveDays(startDate, endDate) {
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

function countProtestDays(protests) {
  return protests.reduce(
    (total, protest) => {
      return (
        total +
        countInclusiveDays(
          getProtestStartDate(protest),
          getProtestEndDate(protest)
        )
      );
    },
    0
  );
}

const CENTRAL_EUROPE_TIMEZONE = "Europe/Berlin";

function getDateKeyInTimeZone(
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

function getProtestDateKey(value) {
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

function isProtestToday(protest) {
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

function buildPopupHtml(feature) {
  const city = escapeHtml(
    feature.get("city") ||
    feature.get("title") ||
    "Qytet i panjohur"
  );

  const country = escapeHtml(
    feature.get("country")
  );

  const protests =
    feature.get("protests") || [];

  const sortedProtests =
    sortProtests(protests);

  const protestDayCount =
    countProtestDays(protests);

  const protestItems =
    sortedProtests
      .map(renderProtestItem)
      .join("");

  const cityLinks =
    buildCityLinks(feature, city);

  return `
    <div class="city-details-view-header">
      <p class="popup-type">
        Qytet proteste
      </p>

      <button
        class="popup-closer city-details-view-close"
        type="button"
        aria-label="Mbyll detajet e qytetit"
        data-city-details-dialog-close
      >
        ×
      </button>
    </div>

    <div class="popup-city-header">
      <div>
        <h3 id="city-details-dialog-title">
          ${city}
        </h3>

        ${
          country
            ? `
              <p class="popup-meta">
                ${country}
              </p>
            `
            : ""
        }
      </div>

      ${cityLinks}
    </div>

    <p class="popup-count">
      ${protestDayCount}
      ${
        protestDayCount === 1
          ? "protestë"
          : "protesta"
      }
    </p>

    <div class="protest-list">
      ${
        protestItems ||
        `
          <p class="upcoming-empty">
            Nuk janë shtuar protesta.
          </p>
        `
      }
    </div>
  `;
}

/* =========================================================
   Popup opening and closing
   ========================================================= */

function openCityDetailsDialog(feature) {
  if (
    !(cityDetailsDialogElement instanceof HTMLDialogElement) ||
    !cityDetailsDialogContentElement
  ) {
    return;
  }

  closeMediaGallery();

  activeCityDetails = {
    city: feature.get("city"),
    title: feature.get("title"),
    driveGalleryUrl: feature.get("driveGalleryUrl") || "",
  };

  cityDetailsDialogContentElement.innerHTML =
    buildPopupHtml(feature);

  cityDetailsDialogTrigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  if (!cityDetailsDialogElement.open) {
    cityDetailsDialogElement.showModal();
  }

  requestAnimationFrame(() => {
    cityDetailsDialogElement.classList.add(
      "is-open"
    );
  });
}

function openPopup(feature) {
  openCityDetailsDialog(feature);
}

function closeCityDetailsDialog() {
  if (!(cityDetailsDialogElement instanceof HTMLDialogElement)) {
    return;
  }

  cityDetailsDialogElement.classList.remove(
    "is-open"
  );

  if (cityDetailsDialogElement.open) {
    cityDetailsDialogElement.close();
  }
}

function closePopup() {
  closeMediaGallery();
  closeCityDetailsDialog();
}

/* =========================================================
   Search and filters
   ========================================================= */

function matchesSearch(
  feature,
  searchText
) {
  if (!searchText) {
    return true;
  }

  const protests =
    feature.get("protests") || [];

  const values = [
    feature.get("title"),
    feature.get("city"),
    feature.get("country"),

    ...protests.flatMap(protest => [
      protest.title,
      protest.description,
      protest.location,
      protest.startDate,
      protest.endDate,
      protest.status,
    ]),
  ];

  return values.some(value =>
    String(value || "")
      .toLowerCase()
      .includes(searchText)
  );
}

function featureIsVisible(feature) {
  const selectedStatuses =
    selectedValues(statusFilters);

  const searchText =
    searchElement?.value
      .trim()
      .toLowerCase() || "";

  const protests =
    feature.get("protests") || [];

  const hasMatchingStatus =
    selectedStatuses.size === 0 ||
    protests.some(protest =>
      selectedStatuses.has(
        normalizeStatus(protest.status)
      )
    );

  return (
    hasMatchingStatus &&
    matchesSearch(feature, searchText)
  );
}

function applyFilters() {
  let visibleCount = 0;

  source
    .getFeatures()
    .forEach(feature => {
      const visible =
        featureIsVisible(feature);

      feature.setStyle(
        visible
          ? null
          : new ol.style.Style({})
      );

      feature.set(
        "mapVisible",
        visible
      );

      if (visible) {
        visibleCount += 1;
      }
    });

  if (visibleCountElement) {
    visibleCountElement.textContent =
      String(visibleCount);
  }

  closePopup();
}

function fitToVisibleFeatures() {
  const visibleFeatures =
    source
      .getFeatures()
      .filter(
        feature =>
          feature.get("mapVisible") !==
          false
      );

  if (visibleFeatures.length === 0) {
    return;
  }

  const extent =
    ol.extent.createEmpty();

  visibleFeatures.forEach(feature => {
    ol.extent.extend(
      extent,
      feature
        .getGeometry()
        .getExtent()
    );
  });

  map.getView().fit(extent, {
    padding: [
      70,
      70,
      70,
      70,
    ],

    maxZoom: 11,
    duration: 350,
  });
}

/* =========================================================
   Statistics
   ========================================================= */

function updateStatistics(features) {
  const stats = calculateProtestStatistics(features);

  if (visibleCountElement) {
    visibleCountElement.textContent = String(stats.cities);
  }

  if (protestCountElement) {
    protestCountElement.textContent = String(stats.protestDays);
  }

  if (confirmedCountElement) {
    confirmedCountElement.textContent = String(stats.confirmedDays);
  }

  if (tentativeCountElement) {
    tentativeCountElement.textContent = String(stats.tentativeDays);
  }

  if (completedCountElement) {
    completedCountElement.textContent = String(stats.completedDays);
  }

  if (majorCountElement) {
    majorCountElement.textContent = String(stats.majorDays);
  }
}

/* =========================================================
   Upcoming protests
   ========================================================= */

function getUpcomingProtests() {
  const upcoming = [];

  source
    .getFeatures()
    .forEach(feature => {
      const city =
        feature.get("city") || "";

      const country =
        feature.get("country") || "";

      const protests =
        feature.get("protests") || [];

      protests.forEach(protest => {
        const status =
          normalizeStatus(
            protest.status
          );

        if (
          ![
            "planned",
            "confirmed",
            "active",
            "tentative",
          ].includes(status)
        ) {
          return;
        }

        upcoming.push({
          ...protest,
          status,
          city,
          country,
          feature,
        });
      });
    });

  return upcoming.sort(
    (first, second) => {
      if (!(first.startDate || first.date)) {
        return 1;
      }

      if (!(second.startDate || second.date)) {
        return -1;
      }

      return String(first.startDate || first.date)
        .localeCompare(
          String(second.startDate || second.date)
        );
    }
  );
}

function renderUpcomingProtests() {

  if (!upcomingListElement) {
    return;
  }

  const upcoming =
    getUpcomingProtests();

  if (upcoming.length === 0) {
    upcomingListElement.innerHTML = `
      <p class="upcoming-empty">
        Nuk janë shtuar protesta të ardhshme.
      </p>
    `;

    return;
  }

  upcomingListElement.innerHTML =
    upcoming
      .map((protest, index) => {
        const title = escapeHtml(
          protest.title ||
          "Untitled protest"
        );

        const city = escapeHtml(
          protest.city
        );

        const country = escapeHtml(
          protest.country
        );

        const date = formatDate(
          protest.startDate || protest.date
        );

        const status =
          normalizeStatus(
            protest.status
          );

        const statusLabel =
          escapeHtml(
            getStatusLabel(status)
          );

        const place = [
          city,
          country,
        ]
          .filter(Boolean)
          .join(", ");

        const isMajor =
          protest.importance === "major" ||
          protest.major === true;

        const isToday =
          isProtestToday(protest);

        return `
          <button
            class="
              upcoming-card
              upcoming-card-${status}
              ${
                isMajor
                  ? "upcoming-card-major"
                  : ""
              }
              ${
                isToday
                  ? "upcoming-card-today"
                  : ""
              }
            "
            type="button"
            data-upcoming-index="${index}"
          >
            ${
              isToday
                ? `
                  <span class="upcoming-card-today-label">
                    Sot
                  </span>
                `
                : ""
            }

            <p class="upcoming-card-date">
              ${
                date ||
                "Data do të konfirmohet"
              }
            </p>

            <h3>${title}</h3>

            ${
              place
                ? `
                  <p class="upcoming-card-place">
                    ${place}
                  </p>
                `
                : ""
            }

            <span class="upcoming-card-status">
              ${statusLabel}
            </span>
          </button>
        `;
      })
      .join("");

  upcomingListElement
    .querySelectorAll(
      ".upcoming-card"
    )
    .forEach((button, index) => {
      button.addEventListener(
        "click",
        () => {
          const protest =
            upcoming[index];

          if (!protest) {
            return;
          }

          const feature =
            protest.feature;

          const coordinates =
            feature
              .getGeometry()
              .getCoordinates();

          map.getView().animate({
            center: coordinates,

            zoom: Math.max(
              map
                .getView()
                .getZoom() || 4,
              8
            ),

            duration: 500,
          });

          openPopup(feature);
        }
      );
    });
}

/* =========================================================
   Data loading
   ========================================================= */

function showMessage(message) {
  if (!messageElement) {
    return;
  }

  messageElement.textContent =
    message;

  messageElement.hidden = false;
}

function hideMessage() {
  if (!messageElement) {
    return;
  }

  messageElement.hidden = true;
}

async function loadLocations() {
  hideMessage();

  const response = await fetch(
    DATA_URL,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "The data file must contain a JSON array."
    );
  }

  const locations = data
    .map(rawLocation => {
      const location = normalizeLocation(rawLocation);

      if (!location) {
        return null;
      }

      /*
       * Preserve the city-level Google Drive gallery URL. The data
       * normalizer may not know this optional field yet.
       */
      location.driveGalleryUrl =
        rawLocation.driveGalleryUrl ??
        rawLocation.drive_gallery_url ??
        rawLocation.driveFolderUrl ??
        rawLocation.drive_folder_url ??
        rawLocation.galleryUrl ??
        rawLocation.gallery_url ??
        location.driveGalleryUrl ??
        "";

      const rawProtests = Array.isArray(rawLocation?.protests)
        ? rawLocation.protests
        : [];

      location.protests = (location.protests || []).map((protest, index) => {
        const rawProtest = rawProtests.find(item =>
          String(item?.id ?? "") === String(protest?.id ?? "")
        ) || rawProtests[index] || {};

        return {
          ...protest,
          sourceUrl:
            rawProtest.sourceUrl ??
            rawProtest.source_url ??
            protest.sourceUrl ??
            "",
        };
      });

      return location;
    })
    .filter(Boolean);

  const features =
    locations.map(location => {
      const feature =
        new ol.Feature({
          geometry:
            new ol.geom.Point(
              ol.proj.fromLonLat([
                location.longitude,
                location.latitude,
              ])
            ),

          ...location,
        });

      feature.setId(location.id);

      return feature;
    });

  source.clear();
  source.addFeatures(features);

  styleCache.clear();
  locationLayer.changed();

  updateStatistics(features);
  applyFilters();
  fitToVisibleFeatures();
  renderUpcomingProtests();
}

/* =========================================================
   Sidebar
   ========================================================= */

function setSidebar(open) {
  if (
    !panelElement ||
    !sidebarHandleElement
  ) {
    return;
  }

  panelElement.classList.toggle(
    "is-closed",
    !open
  );

  sidebarHandleElement.classList.toggle(
    "is-panel-open",
    open
  );

  sidebarHandleElement.setAttribute(
    "aria-expanded",
    String(open)
  );

  sidebarHandleElement.setAttribute(
    "aria-label",
    open
      ? "Close map filters"
      : "Hap filtrat e hartës"
  );

  window.setTimeout(
    () => map.updateSize(),
    280
  );
}

/* =========================================================
   Event listeners
   ========================================================= */

sidebarHandleElement?.addEventListener(
  "click",
  () => {
    const shouldOpen =
      panelElement?.classList.contains(
        "is-closed"
      ) ?? true;

    setSidebar(shouldOpen);
  }
);

closePanelElement?.addEventListener(
  "click",
  () => setSidebar(false)
);

cityDetailsDialogElement?.addEventListener(
  "click",
  event => {
    const closeTarget =
      event.target instanceof Element
        ? event.target.closest(
            "[data-city-details-dialog-close]"
          )
        : null;

    const galleryOpenTarget =
      event.target instanceof Element
        ? event.target.closest("[data-city-gallery-open]")
        : null;

    const galleryBackTarget =
      event.target instanceof Element
        ? event.target.closest("[data-city-gallery-back]")
        : null;

    if (galleryOpenTarget) {
      openMediaGallery(activeCityDetails);
      return;
    }

    if (galleryBackTarget) {
      closeMediaGallery({ restoreFocus: true });
      return;
    }

    if (
      closeTarget ||
      event.target === cityDetailsDialogElement
    ) {
      closeCityDetailsDialog();
    }
  }
);

cityDetailsDialogElement?.addEventListener(
  "close",
  () => {
    cityDetailsDialogElement.classList.remove(
      "is-open"
    );

    if (cityDetailsDialogContentElement) {
      cityDetailsDialogContentElement.innerHTML = "";
    }

    closeMediaGallery();
    activeCityDetails = null;

    cityDetailsDialogTrigger?.focus({
      preventScroll: true,
    });

    cityDetailsDialogTrigger = null;
  }
);

statusFilters.forEach(element => {
  element.addEventListener(
    "change",
    applyFilters
  );
});

searchElement?.addEventListener(
  "input",
  applyFilters
);

searchElement?.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      fitToVisibleFeatures();
    }
  }
);

upcomingToggleElement?.addEventListener(
  "click",
  () => {
    const collapsed =
      upcomingRailElement
        ?.classList
        .toggle("is-collapsed");

    upcomingToggleElement.setAttribute(
      "aria-expanded",
      String(!collapsed)
    );

    upcomingToggleElement.setAttribute(
      "aria-label",
      collapsed
        ? "Shfaq protestat e ardhshme"
        : "Fshih protestat e ardhshme"
    );
  }
);

map.on(
  "singleclick",
  event => {
    const feature =
      map.forEachFeatureAtPixel(
        event.pixel,
        candidate =>
          candidate.get(
            "mapVisible"
          ) === false
            ? undefined
            : candidate
      );

    if (feature) {
      openPopup(feature);
    } else {
      closePopup();
    }
  }
);

map.on(
  "pointermove",
  event => {
    if (event.dragging) {
      return;
    }

    const hasFeature =
      map.hasFeatureAtPixel(
        event.pixel,
        {
          layerFilter:
            layer =>
              layer ===
              locationLayer,
        }
      );

    map
      .getTargetElement()
      .style
      .cursor =
        hasFeature
          ? "pointer"
          : "";
  }
);

window.addEventListener(
  "resize",
  () => {
    map.updateSize();
  }
);

/* =========================================================
   Start
   ========================================================= */

loadLocations().catch(error => {
  console.error(error);

  showMessage(
    "The map loaded, but the location data could not be read."
  );
});


function getDriveFolderId(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const folderMatch = text.match(
    /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/i
  );

  if (folderMatch) {
    return folderMatch[1];
  }

  const embeddedMatch = text.match(
    /embeddedfolderview\?id=([a-zA-Z0-9_-]+)/i
  );

  if (embeddedMatch) {
    return embeddedMatch[1];
  }

  // Also accept a plain Drive folder ID in the data field.
  return /^[a-zA-Z0-9_-]{10,}$/.test(text)
    ? text
    : "";
}

function getDriveGalleryUrl(city) {
  const rawUrl =
    city?.driveGalleryUrl ||
    city?.drive_gallery_url ||
    city?.driveFolderUrl ||
    city?.drive_folder_url ||
    city?.galleryUrl ||
    city?.gallery_url ||
    "";

  const folderId = getDriveFolderId(rawUrl);

  return folderId
    ? `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`
    : "";
}

function openMediaGallery(city) {
  const viewerUrl = getDriveGalleryUrl(city);

  if (!viewerUrl) {
    closeMediaGallery();
    return;
  }

  if (
    !cityDetailsGalleryElement ||
    !cityDetailsGalleryTitleElement ||
    !cityDetailsGalleryFrameElement ||
    !cityDetailsDialogContentElement
  ) {
    return;
  }

  const cityName =
    city.city ||
    city.title ||
    "Flamingo";

  cityDetailsGalleryTitleElement.textContent =
    `Fotot · ${cityName}`;

  cityDetailsGalleryFrameElement.innerHTML = `
    <iframe
      class="drive-gallery-frame"
      src="${escapeHtml(viewerUrl)}"
      title="Fotot e protestave në ${escapeHtml(cityName)}"
      loading="eager"
      allowfullscreen
    ></iframe>
  `;

  const externalUrl = safeUrl(
    city.driveGalleryUrl || city.drive_gallery_url || ""
  );

  if (cityDetailsGalleryExternalElement) {
    cityDetailsGalleryExternalElement.hidden = !externalUrl;
    cityDetailsGalleryExternalElement.href = externalUrl || "#";
  }

  cityDetailsDialogContentElement.hidden = true;
  cityDetailsGalleryElement.hidden = false;
  cityDetailsDialogElement?.classList.add("is-gallery-view");
  cityDetailsDialogElement?.setAttribute(
    "aria-labelledby",
    "city-details-gallery-title"
  );

  cityDetailsGalleryElement
    .querySelector("[data-city-gallery-back]")
    ?.focus({ preventScroll: true });
}

function closeMediaGallery({ restoreFocus = false } = {}) {
  if (cityDetailsGalleryElement) {
    cityDetailsGalleryElement.hidden = true;
  }

  if (cityDetailsGalleryFrameElement) {
    // Removing the iframe stops Drive from continuing to load in the background.
    cityDetailsGalleryFrameElement.innerHTML = "";
  }

  if (cityDetailsDialogContentElement) {
    cityDetailsDialogContentElement.hidden = false;
  }

  cityDetailsDialogElement?.classList.remove("is-gallery-view");
  cityDetailsDialogElement?.setAttribute(
    "aria-labelledby",
    "city-details-dialog-title"
  );

  if (restoreFocus) {
    cityDetailsDialogContentElement
      ?.querySelector("[data-city-gallery-open]")
      ?.focus({ preventScroll: true });
  }
}
