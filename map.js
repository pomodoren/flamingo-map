const DATA_URL = "./data/locations.json";

const mapElement = document.getElementById("map");
const popupElement = document.getElementById("popup");
const popupContentElement = document.getElementById("popup-content");
const popupCloserElement = document.getElementById("popup-closer");
const messageElement = document.getElementById("map-message");
const searchElement = document.getElementById("search");
const visibleCountElement = document.getElementById("visible-count");
const panelElement = document.getElementById("map-panel");
const sidebarHandleElement = document.getElementById("sidebar-handle");
const closePanelElement = document.getElementById("close-panel");
const statusFilters = Array.from(document.querySelectorAll(".status-filter"));

const source = new ol.source.Vector();
const styleCache = new Map();

function getMarkerStyle(feature) {
  const count = Number(feature.get("protestCount")) || 1;
  const hasUpcoming = Boolean(feature.get("hasUpcoming"));
  const radius = Math.min(28, 7 + Math.sqrt(count) * 4);
  const cacheKey = `${count}-${hasUpcoming}`;

  if (styleCache.has(cacheKey)) {
    return styleCache.get(cacheKey);
  }

  const styles = [];

  if (hasUpcoming) {
    styles.push(new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius + 5,
        fill: new ol.style.Fill({ color: "rgba(0, 0, 0, 0)" }),
        stroke: new ol.style.Stroke({ color: "#f3c84b", width: 5 }),
      }),
    }));
  }

  styles.push(new ol.style.Style({
    image: new ol.style.Circle({
      radius,
      fill: new ol.style.Fill({ color: "#d72657" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 2.5 }),
    }),
    text: new ol.style.Text({
      text: String(count),
      font: "700 13px Inter, system-ui, sans-serif",
      fill: new ol.style.Fill({ color: "#ffffff" }),
      stroke: new ol.style.Stroke({ color: "rgba(0,0,0,.22)", width: 2 }),
    }),
  }));

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
    attributions: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    crossOrigin: "anonymous",
    maxZoom: 19,
  }),
});

const map = new ol.Map({
  target: mapElement,
  layers: [baseMapLayer, locationLayer],
  view: new ol.View({
    center: ol.proj.fromLonLat([14.5, 45.5]),
    zoom: 4,
    minZoom: 2,
    maxZoom: 19,
  }),
});

const popupOverlay = new ol.Overlay({
  element: popupElement,
  positioning: "bottom-center",
  stopEvent: true,
  offset: [0, -12],
  autoPan: { animation: { duration: 200 } },
});

map.addOverlay(popupOverlay);

function selectedValues(elements) {
  return new Set(elements.filter(element => element.checked).map(element => element.value));
}

function matchesSearch(feature, searchText) {
  if (!searchText) {
    return true;
  }

  const protests = feature.get("protests") || [];
  const values = [
    feature.get("title"),
    feature.get("city"),
    feature.get("country"),
    ...protests.flatMap(protest => [
      protest.title,
      protest.description,
      protest.location,
      protest.date,
      protest.status,
    ]),
  ];

  return values.some(value => String(value || "").toLowerCase().includes(searchText));
}

function featureIsVisible(feature) {
  const selectedStatuses = selectedValues(statusFilters);
  const searchText = searchElement?.value.trim().toLowerCase() || "";
  const protests = feature.get("protests") || [];
  const hasMatchingStatus = protests.some(protest => selectedStatuses.has(protest.status));

  return hasMatchingStatus && matchesSearch(feature, searchText);
}

function applyFilters() {
  let visibleCount = 0;

  source.getFeatures().forEach(feature => {
    const visible = featureIsVisible(feature);
    feature.setStyle(visible ? null : new ol.style.Style({}));
    feature.set("mapVisible", visible);

    if (visible) {
      visibleCount += 1;
    }
  });

  if (visibleCountElement) {
    visibleCountElement.textContent = String(visibleCount);
  }

  closePopup();
}

function fitToVisibleFeatures() {
  const visibleFeatures = source.getFeatures().filter(feature => feature.get("mapVisible") !== false);

  if (visibleFeatures.length === 0) {
    return;
  }

  const extent = ol.extent.createEmpty();
  visibleFeatures.forEach(feature => ol.extent.extend(extent, feature.getGeometry().getExtent()));

  map.getView().fit(extent, {
    padding: [70, 70, 70, 70],
    maxZoom: 11,
    duration: 350,
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function safeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function openPopup(feature) {
  const city = escapeHtml(feature.get("city"));
  const country = escapeHtml(feature.get("country"));
  const protests = feature.get("protests") || [];

  const cityUrl = safeUrl(feature.get("cityUrl"));
  const instagramUrl = safeUrl(feature.get("instagramUrl"));
  const facebookUrl = safeUrl(feature.get("facebookUrl"));

  const isMobile = window.matchMedia("(max-width: 700px)").matches;

  if (isMobile) {
    popupOverlay.setPositioning("center-center");
    popupOverlay.setOffset([0, 0]);
  } else {
    popupOverlay.setPositioning("bottom-center");
    popupOverlay.setOffset([0, -12]);
  }

  popupElement.hidden = false;

  popupOverlay.setPosition(
    feature.getGeometry().getCoordinates()
  );

  const cityLinks = `
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
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5"></rect>
                <circle cx="12" cy="12" r="4"></circle>
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
              <svg viewBox="0 0 24 24" aria-hidden="true">
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

  const protestItems = protests
    .slice()
    .sort((first, second) => {
      const statusOrder = {
        active: 0,
        planned: 1,
        completed: 2,
        cancelled: 3,
      };

      const firstOrder =
        statusOrder[first.status] ?? 99;

      const secondOrder =
        statusOrder[second.status] ?? 99;

      if (firstOrder !== secondOrder) {
        return firstOrder - secondOrder;
      }

      return String(first.date || "").localeCompare(
        String(second.date || "")
      );
    })
    .map(protest => {
      const title = escapeHtml(protest.title);
      const date = formatDate(protest.date);
      const status = String(
        protest.status || "completed"
      ).toLowerCase();

      const safeStatus = escapeHtml(status);
      const description = escapeHtml(protest.description);
      const location = escapeHtml(protest.location);

      const participants =
        Number.isFinite(Number(protest.participants)) &&
        protest.participants !== ""
          ? Number(protest.participants)
          : null;

      const url = safeUrl(protest.url);

      const isUpcoming =
        status === "planned" ||
        status === "active";

      const statusLabel = {
        planned: "Upcoming",
        active: "Happening now",
        completed: "Past protest",
        cancelled: "Cancelled",
      }[status] || safeStatus;

      return `
        <article
          class="
            protest-item
            protest-item-${safeStatus}
            ${isUpcoming ? "protest-item-upcoming" : ""}
          "
        >
          ${
            isUpcoming
              ? `
                <div class="upcoming-badge">
                  ${status === "active" ? "Live" : "Upcoming"}
                </div>
              `
              : ""
          }

          <h4>${title}</h4>

          <div class="protest-item-meta">
            ${date ? `<span>${date}</span>` : ""}
            ${
              status
                ? `
                  <span class="protest-status protest-status-${safeStatus}">
                    ${statusLabel}
                  </span>
                `
                : ""
            }
            ${location ? `<span>${location}</span>` : ""}
            ${
              participants !== null
                ? `<span>${participants} participants</span>`
                : ""
            }
          </div>

          ${
            description
              ? `<p>${description}</p>`
              : ""
          }

          ${
            url
              ? `
                <a
                  href="${url}"
                  target="_parent"
                  rel="noopener"
                >
                  View protest →
                </a>
              `
              : ""
          }
        </article>
      `;
    })
    .join("");

  const socialLinks = `
    <div class="community-socials">
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
                  ry="5"
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

  popupContentElement.innerHTML = `
    <p class="popup-type">Protest city</p>

    <div class="popup-city-header">
      <div>
        <h3>${city || "Unknown city"}</h3>
        ${country ? `<p class="popup-meta">${country}</p>` : ""}
      </div>

      ${cityLinks}
    </div>

    <p class="popup-count">
      ${protests.length}
      ${protests.length === 1 ? "protest" : "protests"}
    </p>

    <div class="protest-list">
      ${protestItems}
    </div>
  `;

  popupElement.hidden = false;

  popupOverlay.setPosition(
    feature.getGeometry().getCoordinates()
  );
}

function closePopup() {
  popupOverlay.setPosition(undefined);
  popupElement.hidden = true;
}

function showMessage(message) {
  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.hidden = false;
}

function hideMessage() {
  if (!messageElement) {
    return;
  }

  messageElement.hidden = true;
  messageElement.textContent = "";
}

function normalizeLocation(location, index) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    console.warn(`Skipping location ${index + 1}: invalid coordinates.`, location);
    return null;
  }

  const id = String(location.id || `city-${index + 1}`);
  const protests = Array.isArray(location.protests)
    ? location.protests.map((protest, protestIndex) => ({
        id: String(protest.id || `${id}-protest-${protestIndex + 1}`),
        title: String(protest.title || `Protest ${protestIndex + 1}`),
        date: String(protest.date || ""),
        status: String(protest.status || "completed").toLowerCase(),
        description: String(protest.description || ""),
        url: String(protest.url || ""),
        location: String(protest.location || ""),
        participants: protest.participants ?? "",
      }))
    : [];

  return {
    id,
    title: String(location.title || location.city || "Unknown city"),
    city: String(location.city || location.title || ""),
    country: String(location.country || ""),
    latitude,
    longitude,

    cityUrl: String(
      location.cityUrl ||
      location.city_url ||
      location.url ||
      ""
    ),

    instagramUrl: String(
      location.instagramUrl ||
      location.instagram_url ||
      location.instagram ||
      ""
    ),

    facebookUrl: String(
      location.facebookUrl ||
      location.facebook_url ||
      location.facebook ||
      ""
    ),

    protests,
    protestCount: protests.length,

    hasUpcoming: protests.some(protest =>
      ["confirmed", "planned", "active", "tentative"].includes(
        protest.status
      )
    ),
  };
}

async function loadLocations() {
  hideMessage();

  const response = await fetch(DATA_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("The data file must contain a JSON array.");
  }

  const features = data
    .map(normalizeLocation)
    .filter(Boolean)
    .map(location => {
      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([location.longitude, location.latitude])),
        ...location,
      });

      feature.setId(location.id);
      return feature;
    });

  source.clear();
  source.addFeatures(features);
  applyFilters();
  fitToVisibleFeatures();
}

function setSidebar(open) {
  if (!panelElement || !sidebarHandleElement) {
    return;
  }

  panelElement.classList.toggle("is-closed", !open);
  sidebarHandleElement.classList.toggle("is-panel-open", open);
  sidebarHandleElement.setAttribute("aria-expanded", String(open));
  sidebarHandleElement.setAttribute(
    "aria-label",
    open ? "Close map filters" : "Open map filters"
  );

  window.setTimeout(() => map.updateSize(), 280);
}

sidebarHandleElement?.addEventListener("click", () => {
  const open = panelElement?.classList.contains("is-closed") ?? true;
  setSidebar(open);
});

closePanelElement?.addEventListener("click", () => setSidebar(false));
popupCloserElement?.addEventListener("click", closePopup);
statusFilters.forEach(element => element.addEventListener("change", applyFilters));

searchElement?.addEventListener("input", applyFilters);
searchElement?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    fitToVisibleFeatures();
  }
});

map.on("singleclick", event => {
  const feature = map.forEachFeatureAtPixel(event.pixel, candidate => (
    candidate.get("mapVisible") === false ? undefined : candidate
  ));

  if (feature) {
    openPopup(feature);
  } else {
    closePopup();
  }
});

map.on("pointermove", event => {
  if (event.dragging) {
    return;
  }

  const hasFeature = map.hasFeatureAtPixel(event.pixel, {
    layerFilter: layer => layer === locationLayer,
  });

  map.getTargetElement().style.cursor = hasFeature ? "pointer" : "";
});

window.addEventListener("resize", () => map.updateSize());

loadLocations().catch(error => {
  console.error(error);
  showMessage("The map loaded, but the location data could not be read.");
});

const upcomingRailElement =
  document.getElementById("upcoming-rail");

const upcomingListElement =
  document.getElementById("upcoming-list");

const upcomingToggleElement =
  document.getElementById("toggle-upcoming");

const upcomingPreviousElement =
  document.getElementById("upcoming-previous");

const upcomingNextElement =
  document.getElementById("upcoming-next");

function getUpcomingProtests() {
  const upcoming = [];

  source.getFeatures().forEach(feature => {
    const city = feature.get("city") || "";
    const country = feature.get("country") || "";
    const protests = feature.get("protests") || [];

    protests.forEach(protest => {
      if (
        protest.status !== "planned" &&
        protest.status !== "active"
      ) {
        return;
      }

      upcoming.push({
        ...protest,
        city,
        country,
        feature,
      });
    });
  });

  return upcoming.sort((first, second) => {
    if (!first.date) {
      return 1;
    }

    if (!second.date) {
      return -1;
    }

    return String(first.date).localeCompare(
      String(second.date)
    );
  });
}

function renderUpcomingProtests() {
  if (!upcomingListElement) {
    return;
  }

  const upcoming = getUpcomingProtests();

  if (upcoming.length === 0) {
    upcomingListElement.innerHTML = `
      <p class="upcoming-empty">
        No upcoming protests have been added.
      </p>
    `;

    return;
  }

  upcomingListElement.innerHTML = upcoming
    .map((protest, index) => {
      const title = escapeHtml(protest.title);
      const city = escapeHtml(protest.city);
      const country = escapeHtml(protest.country);
      const date = formatDate(protest.date);
      const status = escapeHtml(protest.status);

      const place = [city, country]
        .filter(Boolean)
        .join(", ");

      return `
        <button
          class="upcoming-card"
          type="button"
          data-upcoming-index="${index}"
        >
          <p class="upcoming-card-date">
            ${date || "Date to be confirmed"}
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
            ${status}
          </span>
        </button>
      `;
    })
    .join("");

  upcomingListElement
    .querySelectorAll(".upcoming-card")
    .forEach((button, index) => {
      button.addEventListener("click", () => {
        const protest = upcoming[index];

        if (!protest) {
          return;
        }

        const feature = protest.feature;

        map.getView().animate({
          center: feature
            .getGeometry()
            .getCoordinates(),

          zoom: Math.max(
            map.getView().getZoom() || 4,
            8
          ),

          duration: 500,
        });

        openPopup(feature);
      });
    });
}

async function loadLocations() {
  hideMessage();

  const response = await fetch(DATA_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("The data file must contain a JSON array.");
  }

  const locations = data
    .map(normalizeLocation)
    .filter(Boolean);

  const features = locations.map(location => {
    const feature = new ol.Feature({
      geometry: new ol.geom.Point(
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
  updateStatistics(features);

  applyFilters();
  fitToVisibleFeatures();
  renderUpcomingProtests();
}

loadLocations().catch(error => {
  console.error(error);

  showMessage(
    "The map loaded, but the location data could not be read."
  );
});

upcomingToggleElement?.addEventListener(
  "click",
  () => {
    const collapsed =
      upcomingRailElement?.classList.toggle(
        "is-collapsed"
      );

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

upcomingPreviousElement?.addEventListener(
  "click",
  () => {
    upcomingListElement?.scrollBy({
      left: -260,
      behavior: "smooth",
    });
  }
);

upcomingNextElement?.addEventListener(
  "click",
  () => {
    upcomingListElement?.scrollBy({
      left: 260,
      behavior: "smooth",
    });
  }
);


function updateStatistics(features) {

    const visibleCities = features.length;

    let totalProtests = 0;
    let confirmed = 0;
    let tentative = 0;
    let completed = 0;
    let major = 0;

    features.forEach(feature => {

        const protests = feature.get("protests") || [];

        totalProtests += protests.length;

        protests.forEach(protest => {

            switch ((protest.status || "").toLowerCase()) {

                case "confirmed":
                case "planned":
                case "active":
                    confirmed++;
                    break;

                case "tentative":
                    tentative++;
                    break;

                case "completed":
                    completed++;
                    break;

            }

            if (
                protest.importance === "major" ||
                protest.major === true
            ) {
                major++;
            }

        });

    });

    visibleCountElement.textContent = visibleCities;

    document.getElementById("protest-count").textContent =
        totalProtests;

    document.getElementById("confirmed-count").textContent =
        confirmed;

    document.getElementById("tentative-count").textContent =
        tentative;

    document.getElementById("completed-count").textContent =
        completed;

    document.getElementById("major-count").textContent =
        major;

}