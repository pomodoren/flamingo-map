import fs from "node:fs/promises";

const SHEET_ID = "1i07VQru-t1-KmDzw84lkuXW2D0horxup";

const citiesUrl =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=774046949`;

const protestsUrl =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1671770781`;

const [citiesCsv, protestsCsv] = await Promise.all([
  downloadCsv(citiesUrl, "cities"),
  downloadCsv(protestsUrl, "protests"),
]);

const cityRows = csvToObjects(citiesCsv);
const protestRows = csvToObjects(protestsCsv);

validateHeaders(
  cityRows.headers,
  [
    "city_id",
    "city",
    "country",
    "latitude",
    "longitude",
    "chapter_active",
    "city_url",
    "instagram_url",
    "facebook_url",
  ],
  "cities"
);

validateHeaders(
  protestRows.headers,
  [
    "protest_id",
    "city_id",
    "title",
    "start_date",
    "end_date",
    "status",
    "importance",
    "participants",
    "location",
    "description",
    "source",
    "source_url",
  ],
  "protests"
);

const cities = cityRows.items
  .map((row, index) => normalizeCity(row, index + 2))
  .filter(Boolean);

const citiesById = new Map(cities.map(city => [city.id, city]));

for (let index = 0; index < protestRows.items.length; index += 1) {
  const spreadsheetRow = index + 2;
  const protest = normalizeProtest(protestRows.items[index], spreadsheetRow);

  if (!protest) continue;

  const city = citiesById.get(protest.cityId);

  if (!city) {
    console.warn(
      `Skipping protest row ${spreadsheetRow}: unknown city_id "${protest.cityId}".`
    );
    continue;
  }

  city.protests.push({
    id: protest.id,
    title: protest.title,
    startDate: protest.startDate,
    endDate: protest.endDate,
    status: protest.status,
    importance: protest.importance,
    participants: protest.participants,
    location: protest.location,
    description: protest.description,
    source: protest.source,
    sourceUrl: protest.sourceUrl,
  });
}

for (const city of cities) {
  city.protests.sort((first, second) =>
    String(second.startDate).localeCompare(String(first.startDate))
  );

  city.protestCount = city.protests.length;
  city.markerStatus = computeMarkerStatus(city.protests);
}

const output = cities.filter(city => city.protests.length > 0);

await fs.mkdir("data", { recursive: true });
await fs.writeFile(
  "data/locations.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8"
);

console.log(
  `Saved ${output.length} cities and ${output.reduce(
    (total, city) => total + city.protests.length,
    0
  )} protests.`
);

async function downloadCsv(url, label) {
  const response = await fetch(url, {
    headers: { "User-Agent": "flamingo-map-data-updater" },
  });

  if (!response.ok) {
    throw new Error(
      `Could not download ${label} spreadsheet: HTTP ${response.status}`
    );
  }

  return response.text();
}

function normalizeCity(row, spreadsheetRow) {
  const id = String(row.city_id || "").trim();
  const city = String(row.city || "").trim();
  const country = String(row.country || "").trim();
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!id || !city) {
    console.warn(
      `Skipping city row ${spreadsheetRow}: missing city_id or city.`
    );
    return null;
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    console.warn(
      `Skipping city row ${spreadsheetRow}: invalid coordinates.`
    );
    return null;
  }

  return {
    id,
    title: city,
    city,
    country,
    latitude,
    longitude,
    type: "protest-city",
    chapterActive: parseBoolean(row.chapter_active),
    cityUrl: normalizeUrl(row.city_url),
    instagramUrl: normalizeUrl(row.instagram_url),
    facebookUrl: normalizeUrl(row.facebook_url),
    protests: [],
    protestCount: 0,
    markerStatus: "completed",
  };
}

function normalizeProtest(row, spreadsheetRow) {
  const id = String(row.protest_id || "").trim();
  const cityId = String(row.city_id || "").trim();
  const title = String(row.title || "").trim();

  if (!id || !cityId || !title) {
    console.warn(
      `Skipping protest row ${spreadsheetRow}: missing protest_id, city_id, or title.`
    );
    return null;
  }

  return {
    id,
    cityId,
    title,
    startDate: String(row.start_date || "").trim(),
    endDate: String(row.end_date || row.start_date || "").trim(),
    status: normalizeStatus(row.status),
    importance: normalizeImportance(row.importance),
    participants: String(row.participants || "").trim() || null,
    location: String(row.location || "").trim(),
    description: String(row.description || "").trim(),
    source: String(row.source || "").trim(),
    sourceUrl: normalizeUrl(row.source_url),
  };
}

function computeMarkerStatus(protests) {
  if (protests.some(protest => protest.status === "active")) {
    return "active";
  }

  if (
    protests.some(protest =>
      ["confirmed", "planned"].includes(protest.status)
    )
  ) {
    return "confirmed";
  }

  if (protests.some(protest => protest.status === "tentative")) {
    return "tentative";
  }

  if (protests.some(protest => protest.importance === "major")) {
    return "major";
  }

  return "completed";
}

function normalizeStatus(value) {
  const status = String(value || "completed").trim().toLowerCase();
  const allowed = new Set([
    "active",
    "confirmed",
    "planned",
    "tentative",
    "completed",
    "cancelled",
  ]);

  return allowed.has(status) ? status : "completed";
}

function normalizeImportance(value) {
  return String(value || "normal").trim().toLowerCase() === "major"
    ? "major"
    : "normal";
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text)
      ? text
      : `https://${text}`;
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function parseBoolean(value) {
  return ["true", "yes", "1", "active"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function validateHeaders(actualHeaders, requiredHeaders, label) {
  const missing = requiredHeaders.filter(
    header => !actualHeaders.includes(header)
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing ${label} spreadsheet columns: ${missing.join(", ")}`
    );
  }
}

function csvToObjects(csvText) {
  const rows = parseCsv(csvText);

  if (rows.length === 0) return { headers: [], items: [] };

  const headers = rows[0].map(header =>
    String(header).trim().toLowerCase()
  );

  const items = rows
    .slice(1)
    .filter(row => row.some(value => String(value).trim() !== ""))
    .map(row =>
      Object.fromEntries(
        headers.map((header, index) => [
          header,
          String(row[index] ?? "").trim(),
        ])
      )
    );

  return { headers, items };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (insideQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      insideQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
