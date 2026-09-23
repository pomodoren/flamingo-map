import { photoViewerElement } from "./dom-refs.js";
import { safeUrl } from "./text-format.js";

/*
 * Full-screen photo viewer. Opened by any button with [data-photo-open]
 * (the photo drawer's thumbnails and the "Shiko fotot" button on each
 * protest), which carries what to show as data attributes:
 *
 *   data-photo-media     JSON list of file paths from data/media.json
 *   data-photo-index     item to start at (default 0)
 *   data-photo-title     protest title
 *   data-photo-subtitle  city and date
 *   data-photo-source    original post URL, linked as "Postimi ↗"
 */

const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v)$/i;
const SWIPE_DISTANCE = 50;

let viewer = null;

export function getMediaType(src) {
  return VIDEO_EXTENSION.test(src) ? "video" : "image";
}

export function createMediaElement(src, { thumbnail = false } = {}) {
  if (getMediaType(src) === "image") {
    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.decoding = "async";

    if (thumbnail) {
      image.loading = "lazy";
    }

    return image;
  }

  const video = document.createElement("video");
  video.playsInline = true;

  if (thumbnail) {
    // Seeking a hair past 0 makes browsers paint the first frame.
    video.src = `${src}#t=0.1`;
    video.muted = true;
    video.preload = "metadata";
    video.tabIndex = -1;
  } else {
    video.src = src;
    video.controls = true;
    video.preload = "auto";
  }

  return video;
}

function query(selector) {
  return photoViewerElement?.querySelector(selector);
}

function render() {
  const { items, index } = viewer;
  const count = items.length;

  const media = createMediaElement(items[index]);
  media.className = "photo-viewer-media";
  query("[data-photo-viewer-media]").replaceChildren(media);

  query("[data-photo-viewer-counter]").textContent =
    count > 1 ? `${index + 1} / ${count}` : "";
  query("[data-photo-viewer-prev]").hidden = count < 2;
  query("[data-photo-viewer-next]").hidden = count < 2;
  query("[data-photo-viewer-prev]").disabled = index <= 0;
  query("[data-photo-viewer-next]").disabled = index >= count - 1;

  query("[data-photo-viewer-thumbs]")
    .querySelectorAll("[data-photo-viewer-thumb]")
    .forEach((thumb, thumbIndex) => {
      const selected = thumbIndex === index;
      thumb.classList.toggle("is-selected", selected);
      thumb.setAttribute("aria-current", selected ? "true" : "false");

      if (selected) {
        thumb.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
}

function renderThumbnails() {
  const thumbs = query("[data-photo-viewer-thumbs]");

  thumbs.replaceChildren(
    ...viewer.items.map((src, index) => {
      const type = getMediaType(src);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `photo-thumb is-${type}`;
      button.dataset.photoViewerThumb = String(index);
      button.setAttribute(
        "aria-label",
        `${type === "video" ? "Video" : "Foto"} ${index + 1}`
      );
      button.append(createMediaElement(src, { thumbnail: true }));
      return button;
    })
  );

  thumbs.hidden = viewer.items.length < 2;
}

function select(index) {
  if (!viewer || index < 0 || index >= viewer.items.length) {
    return;
  }

  viewer.index = index;
  render();
}

export function openPhotoViewer(trigger) {
  if (!(photoViewerElement instanceof HTMLDialogElement)) {
    return;
  }

  let items = [];

  try {
    items = JSON.parse(trigger?.dataset.photoMedia || "[]")
      .filter(src => typeof src === "string" && src);
  } catch {
    items = [];
  }

  if (!items.length) {
    return;
  }

  const startIndex = Math.min(
    Math.max(Number(trigger.dataset.photoIndex) || 0, 0),
    items.length - 1
  );

  viewer = { trigger, items, index: startIndex };

  query("[data-photo-viewer-title]").textContent =
    trigger.dataset.photoTitle || "Fotot";
  query("[data-photo-viewer-subtitle]").textContent =
    trigger.dataset.photoSubtitle || "";

  const externalUrl = safeUrl(trigger.dataset.photoSource);
  const external = query("[data-photo-viewer-external]");
  external.hidden = !externalUrl;
  external.href = externalUrl || "#";

  renderThumbnails();
  render();

  if (!photoViewerElement.open) {
    photoViewerElement.showModal();
  }

  query("[data-photo-viewer-close]")?.focus({ preventScroll: true });
}

photoViewerElement?.addEventListener("close", () => {
  if (!viewer) {
    return;
  }

  const { trigger } = viewer;
  viewer = null;

  // Dropping the media stops videos from playing or loading.
  query("[data-photo-viewer-media]").replaceChildren();
  query("[data-photo-viewer-thumbs]").replaceChildren();

  if (trigger.isConnected) {
    trigger.focus({ preventScroll: true });
  }
});

photoViewerElement?.addEventListener("click", event => {
  if (!(event.target instanceof Element) || !viewer) {
    return;
  }

  const thumb = event.target.closest("[data-photo-viewer-thumb]");

  if (thumb) {
    select(Number(thumb.dataset.photoViewerThumb));
  } else if (event.target.closest("[data-photo-viewer-prev]")) {
    select(viewer.index - 1);
  } else if (event.target.closest("[data-photo-viewer-next]")) {
    select(viewer.index + 1);
  } else if (event.target.closest("[data-photo-viewer-close]")) {
    photoViewerElement.close();
  }
});

photoViewerElement?.addEventListener("keydown", event => {
  if (!viewer || event.target instanceof HTMLVideoElement) {
    return;
  }

  if (event.key === "ArrowLeft") {
    select(viewer.index - 1);
  } else if (event.key === "ArrowRight") {
    select(viewer.index + 1);
  }
});

// Swipe left/right on the photo to page through it on touch screens.
let swipeStartX = null;

photoViewerElement?.addEventListener("pointerdown", event => {
  swipeStartX =
    event.pointerType === "touch" &&
    event.target instanceof Element &&
    event.target.closest("[data-photo-viewer-media]")
      ? event.clientX
      : null;
});

photoViewerElement?.addEventListener("pointerup", event => {
  if (swipeStartX === null || !viewer) {
    return;
  }

  const distance = event.clientX - swipeStartX;
  swipeStartX = null;

  if (Math.abs(distance) >= SWIPE_DISTANCE) {
    select(viewer.index + (distance < 0 ? 1 : -1));
  }
});

document.addEventListener("click", event => {
  const trigger =
    event.target instanceof Element
      ? event.target.closest("[data-photo-open]")
      : null;

  if (trigger) {
    openPhotoViewer(trigger);
  }
});
