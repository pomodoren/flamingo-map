import { escapeHtml, safeUrl, formatDate } from "./text-format.js";
import {
  getEffectiveStatus,
  sortProtests,
  countProtestDaysBySchedule,
} from "./protest-schedule.js";
import { getDriveGalleryUrl } from "./media-gallery.js";

/*
 * HTML string builders for the city detail dialog (the popup that opens
 * when you click a marker, a city-search result, or an upcoming card).
 */

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

export function getStatusLabel(status) {
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

export function renderProtestItem(protest) {
  const title = escapeHtml(
    protest.title || "Protestë pa titull"
  );

  const startDate = formatDate(protest.startDate || protest.date);
  const endDate = formatDate(protest.endDate);
  const date =
    endDate && endDate !== startDate
      ? `${startDate} – ${endDate}`
      : startDate;

  const status = getEffectiveStatus(protest);

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

export function buildPopupHtml(feature) {
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

  const { actual: actualDayCount, planned: plannedDayCount } =
    countProtestDaysBySchedule(protests);

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
      ${actualDayCount}
      ${
        actualDayCount === 1
          ? "protestë"
          : "protesta"
      }
      ${
        plannedDayCount > 0
          ? `
            <span class="popup-count-planned">
              + ${plannedDayCount} të ardhshme
            </span>
          `
          : ""
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
