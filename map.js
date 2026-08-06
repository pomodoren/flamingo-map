import { DATA_URL } from "./js/config.js";
import { normalizeLocation } from "./js/protest-data.js";
import { calculateProtestStatistics } from "./js/protest-stats.js";
import { selectedValues } from "./js/dom-helpers.js";
import {
  cityDetailsDialogElement,
  cityDetailsDialogContentElement,
  messageElement,
  visibleCountElement,
  protestCountElement,
  plannedCountElement,
  majorCountElement,
  panelElement,
  sidebarHandleElement,
  closePanelElement,
  upcomingRailElement,
  upcomingToggleElement,
  statusFilters,
  citySearchElement,
  citySearchResultsElement,
  openSubmitDialogButton,
  submitProtestDialogElement,
} from "./js/dom-refs.js";
import { source, locationLayer, map } from "./js/map-instance.js";
import { getFilteredProtests, clearMarkerStyleCache } from "./js/marker-style.js";
import { buildPopupHtml } from "./js/popup.js";
import { openMediaGallery, closeMediaGallery } from "./js/media-gallery.js";
import { renderUpcomingProtests } from "./js/upcoming.js";
import { openSubmitDialog, closeSubmitDialog } from "./js/submit-dialog.js";
import {
  MAX_CITY_SEARCH_RESULTS,
  citySearchResults,
  citySearchActiveIndex,
  getSearchableCities,
  matchesCityQuery,
  hideCitySearchResults,
  renderCitySearchResults,
  setCitySearchActiveIndex,
  selectCitySearchResult,
} from "./js/city-search.js";

let cityDetailsDialogTrigger = null;
let activeCityDetails = null;

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
   Filters
   ========================================================= */

function featureIsVisible(feature) {
  const selectedStatuses = selectedValues(statusFilters);
  return getFilteredProtests(feature, selectedStatuses).length > 0;
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
    visibleCountElement.textContent = String(stats.cities ?? 0);
  }

  if (protestCountElement) {
    protestCountElement.textContent = String(stats.actualDays ?? 0);
  }

  if (plannedCountElement) {
    plannedCountElement.textContent = String(stats.plannedDays ?? 0);
  }

  if (majorCountElement) {
    majorCountElement.textContent = String(stats.majorDays ?? 0);
  }
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

  clearMarkerStyleCache();
  locationLayer.changed();

  updateStatistics(features);
  applyFilters();
  fitToVisibleFeatures();
  renderUpcomingProtests(openPopup);
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

// The "Shto një protestë" control is a plain link to the spreadsheet for
// now (see index.html), not a dialog trigger — so it isn't wired to
// openSubmitDialog. Re-enable this once js/submit-dialog.js's embedded
// form is ready:
//
// openSubmitDialogButton?.addEventListener("click", openSubmitDialog);

submitProtestDialogElement?.addEventListener(
  "click",
  event => {
    const closeTarget =
      event.target instanceof Element
        ? event.target.closest(
            "[data-submit-dialog-close]"
          )
        : null;

    if (
      closeTarget ||
      event.target === submitProtestDialogElement
    ) {
      closeSubmitDialog();
    }
  }
);

submitProtestDialogElement?.addEventListener(
  "close",
  () => {
    submitProtestDialogElement.classList.remove(
      "is-open"
    );
  }
);

statusFilters.forEach(element => {
  element.addEventListener(
    "change",
    applyFilters
  );
});

citySearchElement?.addEventListener(
  "input",
  () => {
    const query = citySearchElement.value
      .trim()
      .toLowerCase();

    if (!query) {
      hideCitySearchResults();
      return;
    }

    const matches = getSearchableCities()
      .filter(feature =>
        matchesCityQuery(feature, query)
      )
      .slice(0, MAX_CITY_SEARCH_RESULTS);

    renderCitySearchResults(matches);
  }
);

citySearchElement?.addEventListener(
  "keydown",
  event => {
    if (citySearchResultsElement?.hidden) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      const nextIndex =
        citySearchActiveIndex + 1 >=
        citySearchResults.length
          ? 0
          : citySearchActiveIndex + 1;

      setCitySearchActiveIndex(nextIndex);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      const nextIndex =
        citySearchActiveIndex - 1 < 0
          ? citySearchResults.length - 1
          : citySearchActiveIndex - 1;

      setCitySearchActiveIndex(nextIndex);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      selectCitySearchResult(
        citySearchActiveIndex >= 0
          ? citySearchActiveIndex
          : 0,
        openPopup
      );
      return;
    }

    if (event.key === "Escape") {
      hideCitySearchResults();
    }
  }
);

citySearchResultsElement?.addEventListener(
  "click",
  event => {
    const target = event.target.closest(
      "[data-city-search-index]"
    );

    if (!target) {
      return;
    }

    selectCitySearchResult(
      Number(target.dataset.citySearchIndex),
      openPopup
    );
  }
);

document.addEventListener(
  "click",
  event => {
    if (
      citySearchResultsElement &&
      !citySearchResultsElement.hidden &&
      !event.target.closest(".city-search")
    ) {
      hideCitySearchResults();
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
