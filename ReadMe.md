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
  status, importance, participants, location, description, source,
  source_url`

Run it manually with:

```sh
node scripts/update-data.mjs
```

A GitHub Actions workflow (`.github/workflows/update-data.yml`) runs this
every 6 hours and commits `data/locations.json` if it changed. It can also
be triggered manually from the Actions tab.

Day counts (shown in the sidebar stats, the upcoming rail, marker labels,
and popups) are always derived from each protest's `start_date`/`end_date`
range rather than trusted from a stale precomputed value, so a multi-day
protest is counted for every day it spans.

## License

Code is MIT-licensed (see `LICENSE`). Protest data is licensed
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).
