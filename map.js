import { DATA_URL } from "./js/config.js";
import { normalizeLocation } from "./js/protest-data.js";
import { calculateProtestStatistics } from "./js/protest-stats.js";

/* =========================================================
   DOM elements
   ========================================================= */

const mapElement = document.getElementById("map");

const popupElement = document.getElementById("popup");
const popupContentElement = document.getElementById("popup-content");
const popupCloserElement = document.getElementById("popup-closer");

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


/* =========================================================
   Dedicated mobile popup
   ========================================================= */

const mobilePopupElement = document.createElement("div");

mobilePopupElement.id = "mobile-popup";
mobilePopupElement.className = "mobile-popup";
mobilePopupElement.hidden = true;

mobilePopupElement.innerHTML = `
  <div
    class="mobile-popup-backdrop"
    data-mobile-popup-close
  ></div>

  <section
    class="mobile-popup-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mobile-popup-title"
  >
    <div
      class="mobile-popup-handle"
      aria-hidden="true"
    ></div>

    <button
      class="popup-closer mobile-popup-closer"
      type="button"
      aria-label="Close city details"
      data-mobile-popup-close
    >
      ×
    </button>

    <div
      id="mobile-popup-content"
      class="mobile-popup-content"
    ></div>
  </section>
`;

document.body.appendChild(mobilePopupElement);

const mobilePopupContentElement = document.getElementById(
  "mobile-popup-content"
);

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
      String(protest.status || "").toLowerCase() === "active"
  );

  const hasConfirmed = protests.some(protest =>
    ["confirmed", "planned"].includes(
      String(protest.status || "").toLowerCase()
    )
  );

  const hasTentative = protests.some(
    protest =>
      String(protest.status || "").toLowerCase() ===
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
  const count = Number(feature.get("protestCount")) || 1;
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
   Desktop OpenLayers popup
   ========================================================= */

const popupOverlay = new ol.Overlay({
  element: popupElement,
  positioning: "bottom-center",
  stopEvent: true,
  offset: [0, -12],

  autoPan: {
    animation: {
      duration: 200,
    },
  },
});

map.addOverlay(popupOverlay);

/* =========================================================
   Utilities
   ========================================================= */

function isMobileViewport() {
  return window.matchMedia(
    "(max-width: 700px)"
  ).matches;
}

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
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(date);
}

function normalizeStatus(value) {
  return String(value || "completed")
    .trim()
    .toLowerCase();
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

  if (
    !cityUrl &&
    !instagramUrl &&
    !facebookUrl
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
              aria-label="Open ${city} community page"
              title="Community page"
            >
              <span aria-hidden="true">↗</span>
              <span>Community</span>
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
              aria-label="${city} on Instagram"
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
              aria-label="${city} on Facebook"
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
    </div>
  `;
}

function getStatusLabel(status) {
  const labels = {
    confirmed: "Confirmed",
    planned: "Upcoming",
    active: "Happening now",
    tentative: "Not confirmed",
    completed: "Past protest",
    cancelled: "Cancelled",
  };

  return labels[status] || status;
}

function renderProtestItem(protest) {
  const title = escapeHtml(
    protest.title || "Untitled protest"
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
      ${
        isUpcoming
          ? `
            <div class="upcoming-badge">
              ${
                status === "active"
                  ? "Live"
                  : statusLabel
              }
            </div>
          `
          : ""
      }

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

      ${
        sourceUrl
          ? `
            <a
              href="${sourceUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${source ? `Source: ${source} →` : "View source →"}
            </a>
          `
          : source
            ? `<p class="protest-source">Source: ${source}</p>`
            : ""
      }
    </article>
  `;
}

function sortProtests(protests) {
  const statusOrder = {
    active: 0,
    confirmed: 1,
    planned: 1,
    tentative: 2,
    completed: 3,
    cancelled: 4,
  };

  return protests
    .slice()
    .sort((first, second) => {
      const firstStatus = normalizeStatus(
        first.status
      );

      const secondStatus = normalizeStatus(
        second.status
      );

      const firstOrder =
        statusOrder[firstStatus] ?? 99;

      const secondOrder =
        statusOrder[secondStatus] ?? 99;

      if (firstOrder !== secondOrder) {
        return firstOrder - secondOrder;
      }

      return String(first.startDate || first.date || "")
        .localeCompare(
          String(second.startDate || second.date || "")
        );
    });
}

function buildPopupHtml(
  feature,
  mobile = false
) {
  const city = escapeHtml(
    feature.get("city") ||
    feature.get("title") ||
    "Unknown city"
  );

  const country = escapeHtml(
    feature.get("country")
  );

  const protests =
    feature.get("protests") || [];

  const sortedProtests =
    sortProtests(protests);

  const protestItems =
    sortedProtests
      .map(renderProtestItem)
      .join("");

  const cityLinks =
    buildCityLinks(feature, city);

  return `
    <p class="popup-type">
      Protest city
    </p>

    <div class="popup-city-header">
      <div>
        <h3
          ${
            mobile
              ? 'id="mobile-popup-title"'
              : ""
          }
        >
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
      ${protests.length}
      ${
        protests.length === 1
          ? "protest"
          : "protests"
      }
    </p>

    <div class="protest-list">
      ${
        protestItems ||
        `
          <p class="upcoming-empty">
            No protests have been added.
          </p>
        `
      }
    </div>
  `;
}

/* =========================================================
   Popup opening and closing
   ========================================================= */

function openMobilePopup(feature) {
  if (!mobilePopupContentElement) {
    return;
  }

  popupOverlay.setPosition(undefined);

  if (popupElement) {
    popupElement.hidden = true;
  }

  mobilePopupContentElement.innerHTML =
    buildPopupHtml(feature, true);

  mobilePopupElement.hidden = false;

  requestAnimationFrame(() => {
    mobilePopupElement.classList.add(
      "is-open"
    );

    document.body.classList.add(
      "mobile-popup-open"
    );

    const closeButton =
      mobilePopupElement.querySelector(
        ".mobile-popup-closer"
      );

    closeButton?.focus({
      preventScroll: true,
    });
  });
}

function openDesktopPopup(feature) {
  closeMobilePopup();

  if (
    !popupContentElement ||
    !popupElement
  ) {
    return;
  }

  popupContentElement.innerHTML =
    buildPopupHtml(feature, false);

  popupElement.hidden = false;

  popupOverlay.setPositioning(
    "bottom-center"
  );

  popupOverlay.setOffset([
    0,
    -12,
  ]);

  popupOverlay.setPosition(
    feature
      .getGeometry()
      .getCoordinates()
  );
}

function openPopup(feature) {
  if (isMobileViewport()) {
    openMobilePopup(feature);
    return;
  }

  openDesktopPopup(feature);
}

function closeMobilePopup() {
  mobilePopupElement.classList.remove(
    "is-open"
  );

  mobilePopupElement.hidden = true;

  if (mobilePopupContentElement) {
    mobilePopupContentElement.innerHTML = "";
  }

  document.body.classList.remove(
    "mobile-popup-open"
  );
}

function closePopup() {
  popupOverlay.setPosition(undefined);

  if (popupElement) {
    popupElement.hidden = true;
  }

  closeMobilePopup();
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
        No upcoming protests have been added.
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
            "
            type="button"
            data-upcoming-index="${index}"
          >
            <p class="upcoming-card-date">
              ${
                date ||
                "Date to be confirmed"
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

  const locations =
    data
      .map(normalizeLocation)
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
      : "Open map filters"
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

popupCloserElement?.addEventListener(
  "click",
  closePopup
);

mobilePopupElement.addEventListener(
  "click",
  event => {
    const closeTarget =
      event.target.closest(
        "[data-mobile-popup-close]"
      );

    if (closeTarget) {
      closeMobilePopup();
    }
  }
);

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      closePopup();
    }
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
        ? "Show upcoming protests"
        : "Hide upcoming protests"
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

    if (isMobileViewport()) {
      popupOverlay.setPosition(
        undefined
      );

      if (popupElement) {
        popupElement.hidden = true;
      }
    } else {
      closeMobilePopup();
    }
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
