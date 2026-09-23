# Flamingo Map

A small static [OpenLayers](https://openlayers.org/) map of Flamingo Revolution
protests, built to be hosted on GitHub Pages and embedded in other websites.
No build step, no framework — plain HTML/CSS/JS modules loaded directly by
the browser.

## Running it locally

There's no build step, so any static file server works. From the repo root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly via
`file://` won't work — `map.js` is loaded as an ES module and fetches
`data/locations.json`, both of which require an actual HTTP origin.

## Data pipeline

Map data isn't edited by hand. `scripts/update-data.mjs` downloads two tabs
of a public Google Sheet as CSV — a `cities` tab and a `protests` tab — and
writes the merged, validated result to `data/locations.json`, which the
front end fetches at load.

- `cities` columns: `city_id, city, country, latitude, longitude,
  chapter_active, city_url, instagram_url, facebook_url, drive_gallery_url`
- `protests` columns: `protest_id, city_id, title, start_date, end_date,
  importance, participants, location, description, source,
  source_url`

Protest status is not stored in the spreadsheet or generated JSON. The map
derives it from the dates whenever it renders: future protests are planned,
currently running protests are active, and past protests are completed.

Run it manually with:

```sh
node scripts/update-data.mjs
```

A GitHub Actions workflow (`.github/workflows/update-data.yml`) runs this
every 6 hours and commits `data/locations.json` if it changed. It can also
be triggered manually from the Actions tab.

## Protest photos

Photos and videos for a protest go in a folder named after its
`protest_id`, and are shown in file-name order:

```
media/protests/250/01.jpg
media/protests/250/02.jpg
media/protests/250/03.mp4
```

Photos from Instagram posts can be downloaded automatically. For every
protest whose `source_url` is an Instagram post, this saves the post's
photos and videos into its folder (`01.jpg`, `02.mp4`, …) and rebuilds
`data/media.json`. Instagram only shows posts to logged-in visitors, so it
uses the Instagram login of a browser on your computer; be logged in to
Instagram in Firefox (or pass `--browser=chrome`). It needs
[gallery-dl](https://github.com/mikf/gallery-dl) installed.

```sh
node scripts/download-instagram-media.mjs            # all posts
node scripts/download-instagram-media.mjs 250 22     # only these protest ids
node scripts/download-instagram-media.mjs --force    # re-download existing folders
```

Folders that already have files are skipped, so it is safe to re-run after
adding new protests. Check the downloads before committing.

After adding or removing files by hand, run:

```sh
node scripts/update-media.mjs
```

This rewrites `data/media.json`, which the map reads to fill the "Fotot"
drawer (top right, all protest photos with a city filter) and to show a
"Shiko fotot" button on each protest that has photos. Commit the photos together with
`data/media.json`. The scheduled workflow also runs the script, so a
forgotten `data/media.json` fixes itself on the next run. Keep photos
around 1600px on the long side (JPEG or WebP) so the gallery loads fast.

Day counts (shown in the sidebar stats, the upcoming rail, marker labels,
and popups) are always derived from each protest's `start_date`/`end_date`
range rather than trusted from a stale precomputed value, so a multi-day
protest is counted for every day it spans.

## License

Code is MIT-licensed (see `LICENSE`). Protest data is licensed
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).
