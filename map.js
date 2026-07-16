const DATA_URL = "./data/locations.json";

const mapElement = document.getElementById("map");
const popupElement = document.getElementById("popup");
const popupContentElement = document.getElementById("popup-content");
const popupCloserElement = document.getElementById("popup-closer");
const messageElement = document.getElementById("map-message");

const searchElement = document.getElementById("search");
const clearSearchElement = document.getElementById("clear-search");

const visibleCountElement = document.getElementById("visible-count");
const panelElement = document.getElementById("map-panel");
const panelToggleElement = document.getElementById("toggle-panel");

const typeFilters = Array.from(
  document.querySelectorAll(".type-filter")
);

const statusFilters = Array.from(
  document.querySelectorAll(".status-filter")
);

const source = new ol.source.Vector();

const styleCache = new Map();

function getMarkerStyle(feature) {

    const count = feature.get("protestCount") || 1;
    const hasUpcoming = feature.get("hasUpcoming");

    const radius = Math.min(
        28,
        7 + Math.sqrt(count) * 4
    );

    const cacheKey = `${count}-${hasUpcoming}`;

    if (styleCache.has(cacheKey)) {
        return styleCache.get(cacheKey);
    }

    const styles = [];

    //
    // Yellow outer ring
    //

    if (hasUpcoming) {

        styles.push(
            new ol.style.Style({

                image: new ol.style.Circle({

                    radius: radius + 5,

                    fill: new ol.style.Fill({
                        color: "rgba(0,0,0,0)"
                    }),

                    stroke: new ol.style.Stroke({
                        color: "#FFD54A",
                        width: 5
                    })

                })

            })
        );

    }

    //
    // Red circle
    //

    styles.push(

        new ol.style.Style({

            image: new ol.style.Circle({

                radius,

                fill: new ol.style.Fill({
                    color: "#D72657"
                }),

                stroke: new ol.style.Stroke({
                    color: "white",
                    width: 2
                })

            }),

            text: new ol.style.Text({

                text: String(count),

                font: "bold 13px sans-serif",

                fill: new ol.style.Fill({
                    color: "white"
                })

            })

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
      '© <a href="https://www.openstreetmap.org/copyright" ' +
      'target="_blank" rel="noopener">' +
      "OpenStreetMap contributors</a>",

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
  autoPan: {
    animation: {
      duration: 200,
    },
  },
});

map.addOverlay(popupOverlay);

function selectedValues(elements) {
  return new Set(
    elements
      .filter(element => element.checked)
      .map(element => element.value)
  );
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
      protest.date,
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
  const selectedStatuses = selectedValues(statusFilters);

  const searchText = searchElement
    ? searchElement.value.trim().toLowerCase()
    : "";

  const protests = feature.get("protests") || [];

  const hasMatchingStatus = protests.some(protest =>
    selectedStatuses.has(protest.status)
  );

  return (
    hasMatchingStatus &&
    matchesSearch(feature, searchText)
  );
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

  visibleCountElement.textContent = String(visibleCount);
  closePopup();
}

function fitToVisibleFeatures() {
  const visibleFeatures = source
    .getFeatures()
    .filter(feature => feature.get("mapVisible") !== false);

  if (visibleFeatures.length === 0) {
    return;
  }

  const extent = ol.extent.createEmpty();

  visibleFeatures.forEach(feature => {
    ol.extent.extend(
      extent,
      feature.getGeometry().getExtent()
    );
  });

  map.getView().fit(extent, {
    padding: [70, 70, 70, 70],
    maxZoom: 11,
    duration: 350,
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function safeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value, window.location.href);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.href;
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
  const protestCount = protests.length;

  const protestItems = protests
    .slice()
    .sort((first, second) => {
      return String(second.date).localeCompare(
        String(first.date)
      );
    })
    .map(protest => {
      const title = escapeHtml(protest.title);
      const date = formatDate(protest.date);
      const status = escapeHtml(protest.status);
      const description = escapeHtml(protest.description);
      const url = safeUrl(protest.url);

      return `
        <article class="protest-item">
          <h4>${title}</h4>

          <div class="protest-item-meta">
            ${date ? `<span>${date}</span>` : ""}
            ${status ? `<span>${status}</span>` : ""}
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

  popupContentElement.innerHTML = `
    <p class="popup-type">Protest city</p>

    <h3>${city}</h3>

    ${
      country
        ? `<p class="popup-meta">${country}</p>`
        : ""
    }

    <p class="popup-count">
      ${protestCount}
      ${protestCount === 1 ? "protest" : "protests"}
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
  messageElement.textContent = message;
  messageElement.hidden = false;
}

function hideMessage() {
  messageElement.hidden = true;
  messageElement.textContent = "";
}

function normalizeLocation(location, index) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    console.warn(
      `Skipping location ${index + 1}: invalid coordinates.`,
      location
    );

    return null;
  }

  const protests = Array.isArray(location.protests)
    ? location.protests.map((protest, protestIndex) => ({
        id:
          String(protest.id || "") ||
          `${location.id}-protest-${protestIndex + 1}`,

        title: String(
          protest.title || `Protest ${protestIndex + 1}`
        ),

        date: String(protest.date || ""),

        status: String(
          protest.status || "completed"
        ).toLowerCase(),

        description: String(protest.description || ""),

        url: String(protest.url || ""),
      }))
    : [];

  return {
      id: location.id,
      city: location.city,
      country: location.country,
      latitude,
      longitude,
      protests,
      protestCount: protests.length,
      hasUpcoming: protests.some(
        protest =>
          protest.status === "planned" ||
          protest.status === "active"
      )
  };
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

  applyFilters();
  fitToVisibleFeatures();
}

map.on("singleclick", event => {
  const feature = map.forEachFeatureAtPixel(
    event.pixel,
    candidate => {
      if (candidate.get("mapVisible") === false) {
        return undefined;
      }

      return candidate;
    }
  );

  if (!feature) {
    closePopup();
    return;
  }

  openPopup(feature);
});

map.on("pointermove", event => {
  if (event.dragging) {
    return;
  }

  const hasFeature = map.hasFeatureAtPixel(event.pixel, {
    layerFilter: layer => layer === locationLayer,
  });

  map.getTargetElement().style.cursor = hasFeature
    ? "pointer"
    : "";
});

popupCloserElement.addEventListener("click", closePopup);

typeFilters.forEach(element => {
  element.addEventListener("change", applyFilters);
});

statusFilters.forEach(element => {
  element.addEventListener("change", applyFilters);
});

if (searchElement) {
  searchElement.addEventListener("input", applyFilters);

  searchElement.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      fitToVisibleFeatures();
    }
  });
}

if (clearSearchElement && searchElement) {
  clearSearchElement.addEventListener("click", () => {
    searchElement.value = "";
    applyFilters();
    fitToVisibleFeatures();
    searchElement.focus();
  });
}

if (popupCloserElement) {
  popupCloserElement.addEventListener("click", closePopup);
}

if (panelToggleElement && panelElement) {
  panelToggleElement.addEventListener("click", () => {
    const isHidden = panelElement.classList.toggle("is-hidden");

    panelToggleElement.setAttribute(
      "aria-expanded",
      String(!isHidden)
    );

    window.setTimeout(() => map.updateSize(), 0);
  });
}

loadLocations().catch(error => {
  console.error(error);

  showMessage(
    "The map loaded, but the location data could not be read."
  );
});
