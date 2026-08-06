import { upcomingListElement, upcomingCountElement } from "./dom-refs.js";
import { escapeHtml, formatDate } from "./text-format.js";
import { normalizeStatus, isProtestToday } from "./protest-schedule.js";
import { getStatusLabel } from "./popup.js";
import { source, map } from "./map-instance.js";
import { getProtestDayCount } from "./protest-data.js";

/*
 * The "Protestat e ardhshme" rail: every planned/confirmed/active/
 * tentative protest across all cities, newest-first, independent of the
 * map's status filter.
 */

export function getUpcomingProtests() {
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

// `onOpen` is the app's `openPopup` — injected rather than imported to
// avoid a circular dependency (map.js imports this module).
export function renderUpcomingProtests(onOpen) {
  if (!upcomingListElement) {
    return;
  }

  const upcoming =
    getUpcomingProtests();

  if (upcomingCountElement) {
    // Count days, not entries — a single protest spanning several days
    // (or with an explicit protestDays override) should add that many,
    // matching how the sidebar's "Ditë protestash" stat is computed.
    const upcomingDays = upcoming.reduce(
      (total, protest) => total + getProtestDayCount(protest),
      0
    );

    upcomingCountElement.textContent =
      String(upcomingDays);
  }

  if (upcoming.length === 0) {
    upcomingListElement.innerHTML = `
      <p class="upcoming-empty">
        Nuk janë shtuar protesta të ardhshme.
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

        // Multi-day protests (e.g. "7 gusht 2026 – 31 gusht 2026") were
        // silently truncated to just the start date here, making a
        // 25-day protest look like a single day in the rail even though
        // it was already counted correctly in the badge/stats totals.
        const startDate = formatDate(
          protest.startDate || protest.date
        );

        const endDate = formatDate(protest.endDate);

        const date =
          endDate && endDate !== startDate
            ? `${startDate} – ${endDate}`
            : startDate;

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

        const isToday =
          isProtestToday(protest);

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
              ${
                isToday
                  ? "upcoming-card-today"
                  : ""
              }
            "
            type="button"
            data-upcoming-index="${index}"
          >
            ${
              isToday
                ? `
                  <span class="upcoming-card-today-label">
                    Sot
                  </span>
                `
                : ""
            }

            <p class="upcoming-card-date">
              ${
                date ||
                "Data do të konfirmohet"
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

          onOpen(feature);
        }
      );
    });
}
