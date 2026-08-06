export const DATA_URL = "./data/locations.json";
export const UPCOMING_STATUSES = new Set([
  "planned",
  "confirmed",
  "active",
  "tentative",
]);

/*
 * Embed URL of the "Shto një protestë" Google Form, shown inline in the
 * #submit-protest-dialog sheet on the main page (see js/submit-dialog.js).
 *
 * To set this up:
 *   1. Open the community spreadsheet and go to Tools → Create a Form.
 *      Point its responses at a new sheet tab (e.g. "Submissions") —
 *      NOT the "protests" tab that update-data.mjs reads from, since
 *      submissions need review before they count as real data.
 *   2. Add the fields listed in the dialog's checklist (city, title,
 *      dates, status, source, etc.) plus a short-answer "Kodi i
 *      konfirmimit" (confirmation code) field. The code itself is just
 *      an honor-system filter checked by whoever reviews the
 *      "Submissions" tab — Google Forms can't enforce it programmatically.
 *   3. In the Form editor, click Send → the "<>" embed tab, copy the
 *      <iframe> src URL, and paste it below.
 */
export const SUBMIT_PROTEST_FORM_URL = "";
