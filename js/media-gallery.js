import {
  cityDetailsDialogContentElement,
  cityDetailsGalleryElement,
  cityDetailsGalleryExternalElement,
  cityDetailsGalleryFrameElement,
  cityDetailsGalleryTitleElement,
  cityDetailsDialogElement,
} from "./dom-refs.js";
import { escapeHtml, safeUrl } from "./text-format.js";

export function getDriveFolderId(value) {
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

export function getDriveGalleryUrl(city) {
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

export function openMediaGallery(city) {
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

export function closeMediaGallery({ restoreFocus = false } = {}) {
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
