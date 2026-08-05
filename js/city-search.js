import { citySearchElement, citySearchResultsElement } from "./dom-refs.js";
import { escapeHtml } from "./text-format.js";
import { source, map } from "./map-instance.js";

/*
 * The "jump to a city" search box floating over the map: querying cities,
 * rendering the dropdown, keyboard navigation, and panning to a result.
 */

export const MAX_CITY_SEARCH_RESULTS = 8;

export let citySearchResults = [];
export let citySearchActiveIndex = -1;

export function getSearchableCities() {
  return source
    .getFeatures()
    .filter(
      feature => (feature.get("protests") || []).length > 0
    );
}

export function matchesCityQuery(feature, query) {
  const haystack = [
    feature.get("city"),
    feature.get("title"),
    feature.get("country"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function hideCitySearchResults() {
  if (!citySearchResultsElement) {
    return;
  }

  citySearchResultsElement.hidden = true;
  citySearchResultsElement.innerHTML = "";
  citySearchResults = [];
  citySearchActiveIndex = -1;

  citySearchElement?.setAttribute(
    "aria-expanded",
    "false"
  );

  citySearchElement?.removeAttribute(
    "aria-activedescendant"
  );
}

export function renderCitySearchResults(features) {
  if (!citySearchResultsElement) {
    return;
  }

  citySearchResults = features;
  citySearchActiveIndex = -1;

  if (features.length === 0) {
    citySearchResultsElement.innerHTML = `
      <li class="city-search-empty">
        Nuk u gjet asnjë qytet.
      </li>
    `;
  } else {
    citySearchResultsElement.innerHTML = features
      .map((feature, index) => {
        const city = escapeHtml(
          feature.get("city") ||
          feature.get("title") ||
          "Qytet i panjohur"
        );

        const country = escapeHtml(
          feature.get("country")
        );

        return `
          <li role="presentation">
            <button
              type="button"
              class="city-search-result"
              role="option"
              id="city-search-result-${index}"
              data-city-search-index="${index}"
            >
              <span class="city-search-result-name">
                ${city}
              </span>

              ${
                country
                  ? `
                    <span class="city-search-result-meta">
                      ${country}
                    </span>
                  `
                  : ""
              }
            </button>
          </li>
        `;
      })
      .join("");
  }

  citySearchResultsElement.hidden = false;

  citySearchElement?.setAttribute(
    "aria-expanded",
    "true"
  );
}

export function setCitySearchActiveIndex(index) {
  if (!citySearchResultsElement) {
    return;
  }

  const options =
    citySearchResultsElement.querySelectorAll(
      ".city-search-result"
    );

  options.forEach(option =>
    option.classList.remove("is-active")
  );

  citySearchActiveIndex = index;

  const activeOption = options[index];

  if (!activeOption) {
    citySearchElement?.removeAttribute(
      "aria-activedescendant"
    );
    return;
  }

  activeOption.classList.add("is-active");

  activeOption.scrollIntoView({
    block: "nearest",
  });

  citySearchElement?.setAttribute(
    "aria-activedescendant",
    activeOption.id
  );
}

// `onOpen` is the app's `openPopup` — injected rather than imported to
// avoid a circular dependency (map.js imports this module).
export function panToCitySearchFeature(feature, onOpen) {
  const coordinates = feature
    .getGeometry()
    .getCoordinates();

  map.getView().animate({
    center: coordinates,

    zoom: Math.max(
      map.getView().getZoom() || 4,
      8
    ),

    duration: 500,
  });

  onOpen(feature);
}

export function selectCitySearchResult(index, onOpen) {
  const feature = citySearchResults[index];

  if (!feature) {
    return;
  }

  panToCitySearchFeature(feature, onOpen);

  if (citySearchElement) {
    citySearchElement.value = "";
  }

  hideCitySearchResults();
  citySearchElement?.blur();
}
