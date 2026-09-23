import fs from "node:fs/promises";
import path from "node:path";

/*
 * Builds data/media.json from the photo folders in media/protests/.
 *
 * Each folder is named after a protest_id from the spreadsheet and holds
 * that protest's photos and videos, shown in file-name order:
 *
 *   media/protests/250/01.jpg
 *   media/protests/250/02.mp4
 *
 * Output: { "250": ["media/protests/250/01.jpg", "media/protests/250/02.mp4"] }
 */

const MEDIA_DIR = "media/protests";
const OUTPUT_FILE = "data/media.json";
const MEDIA_EXTENSION = /\.(jpe?g|png|webp|avif|gif|mp4|webm|mov|m4v)$/i;

const byFileName = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
}).compare;

const media = {};

let folders = [];

try {
  folders = await fs.readdir(MEDIA_DIR, { withFileTypes: true });
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

for (const folder of folders) {
  if (!folder.isDirectory()) {
    continue;
  }

  const files = (await fs.readdir(path.join(MEDIA_DIR, folder.name)))
    .filter(file => MEDIA_EXTENSION.test(file))
    .sort(byFileName);

  if (!files.length) {
    continue;
  }

  media[folder.name] = files.map(file =>
    [MEDIA_DIR, folder.name, file]
      .map(segment => encodeURIComponent(segment).replace(/%2F/g, "/"))
      .join("/")
  );
}

const sorted = Object.fromEntries(
  Object.entries(media).sort(([first], [second]) =>
    byFileName(first, second)
  )
);

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

await fs.writeFile(
  OUTPUT_FILE,
  `${JSON.stringify(sorted, null, 2)}\n`,
  "utf8"
);

const fileCount = Object.values(sorted).reduce(
  (total, files) => total + files.length,
  0
);

console.log(
  `Saved ${fileCount} media files for ` +
  `${Object.keys(sorted).length} protests to ${OUTPUT_FILE}.`
);
