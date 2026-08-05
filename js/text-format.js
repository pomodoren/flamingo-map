/*
 * Small, dependency-free string helpers used across the popup, upcoming
 * list, and city search rendering.
 */

export function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]
  );
}

export function safeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(
      value,
      window.location.href
    );

    return ["http:", "https:"].includes(
      url.protocol
    )
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function formatDate(value) {
  if (!value) {
    return "";
  }

  const normalizedValue = String(value).trim();

  const date = new Date(
    `${normalizedValue}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(normalizedValue);
  }

  return new Intl.DateTimeFormat(
    "sq-AL",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(date);
}
