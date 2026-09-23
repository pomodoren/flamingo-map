import {
  photoGalleryElement,
  photoGalleryFiltersElement,
  photoGalleryListElement,
  photoGalleryToggleElement,
} from "./dom-refs.js";
import { escapeHtml, formatDate } from "./text-format.js";
import { getMediaType } from "./photo-viewer.js";
import { source } from "./map-instance.js";

/*
 * The "Fotot" drawer on the right: every protest that has photos in
 * data/media.json, newest first, with a city filter. Thumbnails open the
 * full-screen viewer (photo-viewer.js) through [data-photo-open].
 */

let entries = [];
let activeCity = "";
let onOpenCity = () => {};

export function formatProtestDate(protest) {
  const startDate = formatDate(protest.startDate || protest.date);
  const endDate = formatDate(protest.endDate);

  return endDate && endDate !== startDate
    ? `${startDate} – ${endDate}`
    : startDate;
}

function collectEntries() {
  return source
    .getFeatures()
    .flatMap(feature =>
      (feature.get("protests") || [])
        .filter(protest => protest.media?.length)
        .map(protest => ({
          feature,
          protest,
          city: feature.get("city") || feature.get("title") || "",
        }))
    )
    .sort((first, second) =>
      String(second.protest.startDate || "").localeCompare(
        String(first.protest.startDate || "")
      )
    );
}

// Shared by the drawer thumbnails and the protest "Shiko fotot" button.
export function photoOpenAttributes(protest, city, index = 0) {
  const date = formatProtestDate(protest);

  return `
    data-photo-open
    data-photo-media="${escapeHtml(JSON.stringify(protest.media))}"
    data-photo-index="${index}"
    data-photo-title="${escapeHtml(protest.title || "Protestë")}"
    data-photo-subtitle="${escapeHtml([city, date].filter(Boolean).join(" · "))}"
    data-photo-source="${escapeHtml(protest.sourceUrl || "")}"
  `;
}

function renderThumb(src, index, entry) {
  const type = getMediaType(src);
  const label = `${type === "video" ? "Video" : "Foto"} ${index + 1}`;

  const media =
    type === "image"
      ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />`
      : `<video src="${escapeHtml(src)}#t=0.1" muted playsinline preload="metadata" tabindex="-1"></video>`;

  return `
    <button
      class="photo-thumb is-${type}"
      type="button"
      aria-label="${escapeHtml(`${label}, ${entry.protest.title || ""}`)}"
      ${photoOpenAttributes(entry.protest, entry.city, index)}
    >
      ${media}
    </button>
  `;
}

function renderFilters() {
  const counts = new Map();

  entries.forEach(({ city, protest }) => {
    counts.set(city, (counts.get(city) || 0) + protest.media.length);
  });

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

  const chips = [
    ["", "Të gjitha", total],
    ...[...counts.entries()].sort(([first], [second]) =>
      first.localeCompare(second)
    ).map(([city, count]) => [city, city, count]),
  ];

  photoGalleryFiltersElement.hidden = counts.size < 2;
  photoGalleryFiltersElement.innerHTML = chips
    .map(([value, label, count]) => `
      <button
        class="photo-gallery-filter"
        type="button"
        data-photo-gallery-city-filter="${escapeHtml(value)}"
        aria-pressed="${value === activeCity}"
      >
        ${escapeHtml(label)}
        <span>${count}</span>
      </button>
    `)
    .join("");
}

function renderList() {
  const visible = entries.filter(
    entry => !activeCity || entry.city === activeCity
  );

  if (!visible.length) {
    photoGalleryListElement.innerHTML = `
      <p class="upcoming-empty">Nuk ka ende foto.</p>
    `;
    return;
  }

  photoGalleryListElement.innerHTML = visible
    .map(entry => {
      const index = entries.indexOf(entry);
      const date = formatProtestDate(entry.protest);

      return `
        <article class="photo-gallery-protest">
          <header class="photo-gallery-protest-header">
            <p class="photo-gallery-protest-meta">
              <button
                class="photo-gallery-city"
                type="button"
                data-photo-gallery-entry="${index}"
                title="Shfaq ${escapeHtml(entry.city)} në hartë"
              >${escapeHtml(entry.city)}</button>
              ${date ? `<span>${escapeHtml(date)}</span>` : ""}
            </p>

            <h3>${escapeHtml(entry.protest.title || "Protestë")}</h3>
          </header>

          <div class="photo-gallery-grid">
            ${entry.protest.media
              .map((src, mediaIndex) => renderThumb(src, mediaIndex, entry))
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderPhotoGallery(openCity) {
  if (
    !photoGalleryElement ||
    !photoGalleryListElement ||
    !photoGalleryFiltersElement ||
    !photoGalleryToggleElement
  ) {
    return;
  }

  onOpenCity = openCity || onOpenCity;
  entries = collectEntries();

  if (!entries.some(entry => entry.city === activeCity)) {
    activeCity = "";
  }

  const mediaCount = entries.reduce(
    (total, entry) => total + entry.protest.media.length,
    0
  );

  // Nothing to show until photos are added to media/protests/.
  photoGalleryToggleElement.hidden = mediaCount === 0;
  photoGalleryToggleElement.querySelector(
    "[data-photo-gallery-count]"
  ).textContent = String(mediaCount);

  if (mediaCount === 0) {
    setPhotoGalleryOpen(false);
  }

  renderFilters();
  renderList();
}

export function setPhotoGalleryOpen(open) {
  if (!photoGalleryElement || !photoGalleryToggleElement) {
    return;
  }

  photoGalleryElement.hidden = !open;
  photoGalleryToggleElement.setAttribute("aria-expanded", String(open));
  photoGalleryToggleElement.classList.toggle("is-active", open);

  if (open) {
    photoGalleryElement
      .querySelector("[data-photo-gallery-close]")
      ?.focus({ preventScroll: true });
  }
}

photoGalleryToggleElement?.addEventListener("click", () => {
  setPhotoGalleryOpen(photoGalleryElement.hidden);
});

photoGalleryElement?.addEventListener("click", event => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const filter = event.target.closest("[data-photo-gallery-city-filter]");
  const cityButton = event.target.closest("[data-photo-gallery-entry]");

  if (filter) {
    activeCity = filter.dataset.photoGalleryCityFilter;
    renderFilters();
    renderList();
    photoGalleryListElement.scrollTop = 0;
  } else if (cityButton) {
    const entry = entries[Number(cityButton.dataset.photoGalleryEntry)];

    if (entry) {
      onOpenCity(entry.feature);
    }
  } else if (event.target.closest("[data-photo-gallery-close]")) {
    setPhotoGalleryOpen(false);
    photoGalleryToggleElement.focus({ preventScroll: true });
  }
});

photoGalleryElement?.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    setPhotoGalleryOpen(false);
    photoGalleryToggleElement.focus({ preventScroll: true });
  }
});
