import fs from "node:fs/promises";

const SHEET_ID = "1i07VQru-t1-KmDzw84lkuXW2D0horxup";

const citiesUrl =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=774046949`;

const protestsUrl =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1671770781`;


if (!citiesUrl) {
  throw new Error(
    "CITIES_CSV_URL is missing. Add it as a GitHub repository secret."
  );
}

if (!protestsUrl) {
  throw new Error(
    "PROTESTS_CSV_URL is missing. Add it as a GitHub repository secret."
  );
}

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
    "date",
    "status",
    "description",
    "url",
    "location",
    "participants",
  ],
  "protests"
);

const cities = cityRows.items
  .map((row, index) => normalizeCity(row, index + 2))
  .filter(Boolean);

const citiesById = new Map(
  cities.map(city => [city.id, city])
);

for (const city of cities) {
  city.protests = [];
}

for (let index = 0; index < protestRows.items.length; index += 1) {
  const row = protestRows.items[index];
  const spreadsheetRow = index + 2;

  const protest = normalizeProtest(row, spreadsheetRow);

  if (!protest) {
    continue;
  }

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
    date: protest.date,
    status: protest.status,
    description: protest.description,
    url: protest.url,
    location: protest.location,
    participants: protest.participants,
  });
}

for (const city of cities) {
  city.protests.sort((first, second) =>
    String(second.date).localeCompare(String(first.date))
  );
}

const output = cities.filter(city => city.protests.length > 0);

await fs.mkdir("data", {
  recursive: true,
});

await fs.writeFile(
  "data/locations.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8"
);

console.log(
  `Saved ${output.length} cities and ${
    output.reduce(
      (total, city) => total + city.protests.length,
      0
    )
  } protests.`
);

async function downloadCsv(url, label) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "flamingo-map-data-updater",
    },
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

    cityUrl: String(row.city_url || "").trim(),
    instagramUrl: String(row.instagram_url || "").trim(),
    facebookUrl: String(row.facebook_url || "").trim(),

    protests: [],
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

  const participantsText = String(
    row.participants || ""
  ).trim();

  const participants =
    participantsText === ""
      ? null
      : Number(participantsText);

  return {
    id,
    cityId,
    title,
    date: String(row.date || "").trim(),
    status:
      String(row.status || "completed")
        .trim()
        .toLowerCase(),
    description: String(row.description || "").trim(),
    url: String(row.url || "").trim(),
    location: String(row.location || "").trim(),
    participants:
      Number.isFinite(participants)
        ? participants
        : null,
  };
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

  if (rows.length === 0) {
    return {
      headers: [],
      items: [],
    };
  }

  const headers = rows[0].map(header =>
    String(header).trim().toLowerCase()
  );

  const items = rows
    .slice(1)
    .filter(row =>
      row.some(value => String(value).trim() !== "")
    )
    .map(row =>
      Object.fromEntries(
        headers.map((header, index) => [
          header,
          String(row[index] ?? "").trim(),
        ])
      )
    );

  return {
    headers,
    items,
  };
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
      if (
        character === '"' &&
        nextCharacter === '"'
      ) {
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
