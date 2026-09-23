import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/*
 * Downloads the photos and videos of every protest whose source_url is an
 * Instagram post into media/protests/<protest_id>/, then rebuilds
 * data/media.json.
 *
 * Instagram only serves posts to logged-in visitors, so this borrows the
 * Instagram login of a browser on this computer (Firefox by default).
 * Run it yourself, while logged in to Instagram in that browser:
 *
 *   node scripts/download-instagram-media.mjs              all posts
 *   node scripts/download-instagram-media.mjs 250 22       only these protest ids
 *   node scripts/download-instagram-media.mjs --browser=chrome
 *   node scripts/download-instagram-media.mjs --force      re-download existing folders
 *
 * Needs gallery-dl (https://github.com/mikf/gallery-dl) on the PATH.
 */

const MEDIA_DIR = "media/protests";
const MEDIA_EXTENSION = /\.(jpe?g|png|webp|avif|gif|mp4|webm|mov|m4v)$/i;
const INSTAGRAM_POST =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([a-zA-Z0-9_-]+)/i;

const args = process.argv.slice(2);
const force = args.includes("--force");
const browser =
  args.find(arg => arg.startsWith("--browser="))?.split("=")[1] || "firefox";
const onlyIds = new Set(args.filter(arg => !arg.startsWith("--")));

const galleryDl = spawnSync("gallery-dl", ["--version"], { encoding: "utf8" });

if (galleryDl.error) {
  console.error(
    "gallery-dl was not found. Install it with `pipx install gallery-dl`\n" +
    "(or in a virtualenv) and make sure it is on your PATH."
  );
  process.exit(1);
}

const locations = JSON.parse(
  await fs.readFile("data/locations.json", "utf8")
);

const posts = locations.flatMap(location =>
  (location.protests || []).flatMap(protest => {
    const match = String(protest.sourceUrl || "").match(INSTAGRAM_POST);

    if (!match || (onlyIds.size && !onlyIds.has(String(protest.id)))) {
      return [];
    }

    const kind = match[1].toLowerCase() === "p" ? "p" : "reel";

    return [{
      id: String(protest.id),
      city: location.city,
      title: protest.title,
      // Drop tracking parameters such as ?utm_source=…&igsh=…
      url: `https://www.instagram.com/${kind}/${match[2]}/`,
    }];
  })
);

if (!posts.length) {
  console.log("No protests with an Instagram post as source_url.");
  process.exit(0);
}

async function countMedia(directory) {
  try {
    return (await fs.readdir(directory))
      .filter(file => MEDIA_EXTENSION.test(file)).length;
  } catch {
    return 0;
  }
}

const results = { downloaded: [], skipped: [], failed: [] };

for (const [index, post] of posts.entries()) {
  const directory = path.join(MEDIA_DIR, post.id);
  const label = `[${index + 1}/${posts.length}] ${post.city} · ${post.title} (#${post.id})`;

  if (!force && (await countMedia(directory)) > 0) {
    console.log(`${label}: already has media, skipping.`);
    results.skipped.push(post);
    continue;
  }

  console.log(`${label}: ${post.url}`);
  await fs.mkdir(directory, { recursive: true });

  const run = spawnSync(
    "gallery-dl",
    [
      "--cookies-from-browser", browser,
      // Save straight into the folder as 01.jpg, 02.mp4, … in post order.
      "--directory", directory,
      "--filename", "{num:>02}.{extension}",
      "--sleep-request", "2-5",
      ...(force ? ["--no-skip"] : []),
      post.url,
    ],
    { stdio: "inherit" }
  );

  const saved = await countMedia(directory);

  if (run.status === 0 && saved > 0) {
    results.downloaded.push({ ...post, saved });
  } else {
    results.failed.push(post);

    if (saved === 0) {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

console.log(
  `\nDownloaded ${results.downloaded.length}, ` +
  `skipped ${results.skipped.length}, ` +
  `failed ${results.failed.length}.`
);

results.failed.forEach(post =>
  console.log(`  failed: #${post.id} ${post.city} · ${post.title} ${post.url}`)
);

// Refresh data/media.json so the map picks up the new files.
spawnSync(process.execPath, ["scripts/update-media.mjs"], { stdio: "inherit" });

process.exit(results.failed.length ? 1 : 0);
