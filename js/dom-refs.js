/*
 * Every DOM element the app reads or writes to, looked up once here so
 * the rest of the code just imports the reference it needs instead of
 * repeating `document.getElementById(...)` everywhere.
 */

export const mapElement = document.getElementById("map");

export const cityDetailsDialogElement = document.getElementById(
  "city-details-dialog"
);
export const cityDetailsDialogContentElement = document.getElementById(
  "city-details-dialog-content"
);
export const cityDetailsGalleryElement = document.getElementById(
  "city-details-gallery"
);
export const cityDetailsGalleryTitleElement = document.getElementById(
  "city-details-gallery-title"
);
export const cityDetailsGalleryFrameElement = document.getElementById(
  "city-details-gallery-frame"
);
export const cityDetailsGalleryExternalElement = document.getElementById(
  "city-details-gallery-external"
);

export const messageElement = document.getElementById("map-message");

export const visibleCountElement = document.getElementById("visible-count");
export const protestCountElement = document.getElementById("protest-count");
export const plannedCountElement = document.getElementById("planned-count");
export const majorCountElement = document.getElementById("major-count");

export const panelElement = document.getElementById("map-panel");
export const sidebarHandleElement = document.getElementById("sidebar-handle");
export const closePanelElement = document.getElementById("close-panel");

export const upcomingRailElement = document.getElementById("upcoming-rail");
export const upcomingListElement = document.getElementById("upcoming-list");
export const upcomingToggleElement = document.getElementById("toggle-upcoming");
export const upcomingCountElement = document.getElementById("upcoming-count");

export const statusFilters = Array.from(
  document.querySelectorAll(".status-filter")
);

export const citySearchElement = document.getElementById("city-search");
export const citySearchResultsElement = document.getElementById(
  "city-search-results"
);

export const openSubmitDialogButton = document.getElementById(
  "open-submit-dialog"
);
export const submitProtestDialogElement = document.getElementById(
  "submit-protest-dialog"
);
export const submitFormFrameElement = document.getElementById(
  "submit-form-frame"
);
export const submitFormEmptyElement = document.getElementById(
  "submit-form-empty"
);
