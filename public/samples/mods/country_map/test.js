/**
 * Tests of the sample country map mod, which `mods.check` runs after
 * mounting it. Each case runs in a fresh hidden frame with a throwaway
 * storage slot, and mounts the mod itself through its context.
 *
 * The cases read the page: the country shapes, the markers' names, numbers
 * and states, the sidebar and the card. `tiles.renderBody` renders only the
 * tiles of the check's collection, so the cases that need other metadata
 * keep a sample tile's source and body.
 *
 * What a hidden frame cannot show is tested in
 * e2e/sample_country_map.spec.ts: where the markers are, the colors, the
 * layouts, where the focus goes (a check's frames are inert), the Escape key
 * and "Reload tiles", which a case cannot press.
 */

const MAP_COUNTRY_COUNT = 177;

/** The markers of the sample books, in the order of their countries' names. */
const SAMPLE_MARKER_NAMES = [
  "Austria, 2 tiles",
  "Belarus, 3 tiles",
  "Canada, 6 tiles",
  "China, 3 tiles",
  "France, 6 tiles",
  "Germany, 1 tile",
  "Hungary, 3 tiles",
  "Norway, 3 tiles",
  "Peru, 3 tiles",
  "Poland, 3 tiles",
  "South Korea, 3 tiles",
  "Sweden, 3 tiles",
  "United Kingdom, 6 tiles",
  "United States, 6 tiles",
];

const SAMPLE_MARKER_NUMBERS = [
  "2",
  "3",
  "6",
  "3",
  "6",
  "1",
  "3",
  "3",
  "3",
  "3",
  "3",
  "3",
  "6",
  "6",
];

function readTexts(elements) {
  const texts = [];
  for (const element of elements) {
    texts.push(element.textContent);
  }
  return texts;
}

function listMarkers(context) {
  const markers = context.root.querySelectorAll(".country-marker");
  return markers;
}

function readMarkerNames(context) {
  const names = [];
  for (const marker of listMarkers(context)) {
    names.push(marker.getAttribute("aria-label"));
  }
  return names;
}

function findMarker(context, country) {
  for (const marker of listMarkers(context)) {
    if (marker.getAttribute("aria-label").startsWith(`${country}, `)) {
      return marker;
    }
  }
  throw new Error(`No marker is named after "${country}"`);
}

function findUnplacedButton(context) {
  for (const button of context.root.querySelectorAll("button")) {
    if (button.textContent.startsWith("Not on the map")) {
      return button;
    }
  }
  return null;
}

function findSampleTile(context, title) {
  for (const tile of context.tiles) {
    if (tile.metadata.title === title) {
      return tile;
    }
  }
  throw new Error(`The sample collection has no tile titled "${title}"`);
}

/** A sample tile with other metadata, keeping its source and body. */
function changeTile(tile, metadata) {
  const changedTile = {
    source: tile.source,
    metadata: { ...tile.metadata, ...metadata },
    body: tile.body,
  };
  return changedTile;
}

/** `count` sample tiles from the `start`th one, each set in `country`. */
function placeSampleTiles(context, start, count, country) {
  const tiles = [];
  for (const tile of context.tiles.slice(start, start + count)) {
    tiles.push(changeTile(tile, { country }));
  }
  return tiles;
}

function readSidebar(context) {
  const sidebar = context.root.querySelector("aside");
  return sidebar;
}

function readSidebarTitles(context) {
  const titles = readTexts(
    readSidebar(context).querySelectorAll("li > button"),
  );
  return titles;
}

function findTileButton(context, title) {
  for (const button of readSidebar(context).querySelectorAll("li > button")) {
    if (button.textContent === title) {
      return button;
    }
  }
  throw new Error(`The sidebar lists no tile titled "${title}"`);
}

function readCard(context) {
  const card = context.root.querySelector("dialog");
  return card;
}

/** The card's labeled values, as `{ label: value }`. */
function readCardDetails(context) {
  const details = {};
  const card = readCard(context);
  const terms = card.querySelectorAll("dt");
  const descriptions = card.querySelectorAll("dd");
  for (let index = 0; index < terms.length; index += 1) {
    details[terms[index].textContent] = descriptions[index].textContent;
  }
  return details;
}

function isLeafletLinkRequest(request) {
  return (
    request.method === "links.open" &&
    request.params.url === "https://leafletjs.com"
  );
}

function hasLeafletLinkRequest(context) {
  for (const request of context.requests) {
    if (isLeafletLinkRequest(request)) {
      return true;
    }
  }
  return false;
}

async function drawsTheCountryShapes(context) {
  await context.mount();
  context
    .expect(context.root.querySelectorAll("path.country").length)
    .toBe(MAP_COUNTRY_COUNT);
}

async function showsTheEmptyMapWithoutTiles(context) {
  await context.mount({ tiles: [] });
  context
    .expect(context.root.querySelectorAll("path.country").length)
    .toBe(MAP_COUNTRY_COUNT);
  context.expect(listMarkers(context).length).toBe(0);
  context.expect(findUnplacedButton(context)).toBe(null);
  context
    .expect(readTexts(context.root.querySelectorAll('[role="status"]')))
    .toEqual(["There are no tiles to show."]);
}

async function opensTheLeafletLink(context) {
  await context.mount();
  const link = context.root.querySelector(
    '.leaflet-control-attribution a[href="https://leafletjs.com"]',
  );
  context
    .expect(
      context.root.querySelector(
        '.leaflet-control-attribution a[href="https://www.naturalearthdata.com"]',
      ),
    )
    .not.toBe(null);
  link.click();
  await context.waitFor(hasLeafletLinkRequest.bind(undefined, context));
  context.expect(link.isConnected).toBe(true);
}

async function showsAMarkerPerCountry(context) {
  await context.mount();
  context.expect(readMarkerNames(context)).toEqual(SAMPLE_MARKER_NAMES);
  context
    .expect(readTexts(context.root.querySelectorAll(".country-marker text")))
    .toEqual(SAMPLE_MARKER_NUMBERS);
}

function readMarkerWidth(marker) {
  const width = Number(marker.querySelector("svg").getAttribute("width"));
  return width;
}

async function widensAMarkerForMoreDigits(context) {
  const tiles = [
    ...placeSampleTiles(context, 0, 7, "France"),
    ...placeSampleTiles(context, 7, 12, "Germany"),
  ];
  await context.mount({ tiles });
  const france = findMarker(context, "France");
  const germany = findMarker(context, "Germany");
  context.expect(france.textContent).toBe("7");
  context.expect(germany.textContent).toBe("12");
  context.expect(readMarkerWidth(germany) > readMarkerWidth(france)).toBe(true);
}

async function matchesACommonName(context) {
  const tiles = [
    ...placeSampleTiles(context, 0, 1, "United States"),
    ...placeSampleTiles(context, 1, 1, "usa"),
  ];
  await context.mount({ tiles });
  context.expect(readMarkerNames(context)).toEqual(["United States, 2 tiles"]);
}

async function matchesANameWithoutAccentsOrCase(context) {
  const tiles = [
    ...placeSampleTiles(context, 0, 1, " cote d'ivoire "),
    ...placeSampleTiles(context, 1, 1, "CÔTE D’IVOIRE"),
    ...placeSampleTiles(context, 2, 1, "Ivory Coast"),
  ];
  await context.mount({ tiles });
  context.expect(readMarkerNames(context)).toEqual(["cote d'ivoire, 3 tiles"]);
  context.expect(findUnplacedButton(context)).toBe(null);
}

async function leavesAHistoricalCountryOffTheMap(context) {
  await context.mount({
    tiles: placeSampleTiles(context, 0, 1, "Soviet Union"),
  });
  context.expect(listMarkers(context).length).toBe(0);
  context
    .expect(findUnplacedButton(context).textContent)
    .toBe("Not on the map, 1 tile");
}

async function groupsTilesNotOnTheMap(context) {
  const soviet = changeTile(context.tiles[0], { country: "Soviet Union" });
  const singapore = changeTile(context.tiles[1], { country: "Singapore" });
  const years = findSampleTile(context, "The Years");
  await context.mount({ tiles: [soviet, years, singapore] });
  const button = findUnplacedButton(context);
  context.expect(button.textContent).toBe("Not on the map, 2 tiles");
  context.expect(readMarkerNames(context)).toEqual(["France, 1 tile"]);
  button.click();
  context
    .expect(readSidebar(context).querySelector("h2").textContent)
    .toBe("Not on the map");
  context
    .expect(readSidebarTitles(context))
    .toEqual([soviet.metadata.title, singapore.metadata.title]);
  context.expect(button.getAttribute("aria-expanded")).toBe("true");
}

async function showsEverySampleTileOnTheMap(context) {
  await context.mount();
  context.expect(findUnplacedButton(context)).toBe(null);
}

function readSelectedShapeCount(context) {
  const count = context.root.querySelectorAll("path.country.selected").length;
  return count;
}

async function opensACountry(context) {
  await context.mount();
  const france = findMarker(context, "France");
  context.expect(readSidebar(context).hidden).toBe(true);
  france.click();
  const sidebar = readSidebar(context);
  context.expect(sidebar.hidden).toBe(false);
  context.expect(sidebar.querySelector("h2").textContent).toBe("France");
  context.expect(sidebar.querySelector("p").textContent).toBe("6 tiles");
  const titles = readSidebarTitles(context);
  context.expect(titles.length).toBe(6);
  context.expect(titles).toContain("The Years");
  context.expect(france.getAttribute("aria-expanded")).toBe("true");
  context
    .expect(findMarker(context, "Germany").getAttribute("aria-expanded"))
    .toBe("false");
  context.expect(readSelectedShapeCount(context)).toBe(1);
  context
    .expect(
      sidebar.querySelectorAll('li > button[aria-haspopup="dialog"]').length,
    )
    .toBe(6);
}

async function replacesTheSidebarForAnotherCountry(context) {
  await context.mount();
  findMarker(context, "France").click();
  findMarker(context, "Germany").click();
  const sidebar = readSidebar(context);
  context.expect(sidebar.querySelector("h2").textContent).toBe("Germany");
  context.expect(sidebar.querySelector("p").textContent).toBe("1 tile");
  context
    .expect(findMarker(context, "France").getAttribute("aria-expanded"))
    .toBe("false");
  context.expect(readSelectedShapeCount(context)).toBe(1);
}

function findCountryShape(context, mapName) {
  const shape = context.root.querySelector(
    `path.country[data-country="${mapName}"]`,
  );
  if (shape === null) {
    throw new Error(`No country shape is named "${mapName}"`);
  }
  return shape;
}

function clickShape(shape) {
  shape.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function selectsACountryByItsShape(context) {
  await context.mount();
  const france = findCountryShape(context, "France");
  context.expect(france.classList.contains("has-tiles")).toBe(true);
  context
    .expect(findCountryShape(context, "Spain").classList.contains("has-tiles"))
    .toBe(false);
  clickShape(findCountryShape(context, "Spain"));
  context.expect(readSidebar(context).hidden).toBe(true);
  clickShape(france);
  context
    .expect(readSidebar(context).querySelector("h2").textContent)
    .toBe("France");
  context
    .expect(findMarker(context, "France").getAttribute("aria-expanded"))
    .toBe("true");
}

async function closesTheSidebar(context) {
  await context.mount();
  const france = findMarker(context, "France");
  france.click();
  readSidebar(context)
    .querySelector('header > button[aria-label="Close"]')
    .click();
  context.expect(readSidebar(context).hidden).toBe(true);
  context.expect(france.getAttribute("aria-expanded")).toBe("false");
  context.expect(readSelectedShapeCount(context)).toBe(0);
}

async function showsTheBookMetadata(context) {
  await context.mount();
  findMarker(context, "France").click();
  findTileButton(context, "The Years").click();
  const card = readCard(context);
  context.expect(card.open).toBe(true);
  context.expect(card.querySelector("h2").textContent).toBe("The Years");
  context
    .expect(card.getAttribute("aria-labelledby"))
    .toBe(card.querySelector("h2").id);
  const details = readCardDetails(context);
  context.expect(details.authors).toBe("Annie Ernaux");
  context.expect(details.country).toBe("France");
  context.expect(details.genres).toBe("Memoir, Autobiography");
  context.expect(Object.hasOwn(details, "pages")).toBe(false);
  context.expect(Object.hasOwn(details, "title")).toBe(false);
  context.expect(Object.hasOwn(details, "image")).toBe(false);
  context.expect(card.querySelector("ot-tile-body")).not.toBe(null);
}

async function showsAMappingAsJson(context) {
  const years = changeTile(findSampleTile(context, "The Years"), {
    prizes: { nobel: 2022 },
    reread: true,
    tags: [],
    note: "",
  });
  await context.mount({ tiles: [years] });
  findMarker(context, "France").click();
  findTileButton(context, "The Years").click();
  const details = readCardDetails(context);
  context.expect(details.prizes).toBe('{"nobel":2022}');
  context.expect(details.reread).toBe("true");
  context.expect(Object.hasOwn(details, "tags")).toBe(false);
  context.expect(Object.hasOwn(details, "note")).toBe(false);
}

function isCardClosed(context) {
  return !readCard(context).open;
}

async function closesTheCardWithItsButton(context) {
  await context.mount();
  findMarker(context, "France").click();
  findTileButton(context, "The Years").click();
  readCard(context).querySelector('button[aria-label="Close"]').click();
  await context.waitFor(isCardClosed.bind(undefined, context));
  context
    .expect(readSidebar(context).querySelector("h2").textContent)
    .toBe("France");
  context.expect(readSidebarTitles(context).length).toBe(6);
}

export default function registerCountryMapTests(t) {
  t.test("draws the country shapes", drawsTheCountryShapes);
  t.test("shows the empty map without tiles", showsTheEmptyMapWithoutTiles);
  t.test("opens the Leaflet link", opensTheLeafletLink);
  t.test("shows a marker per country", showsAMarkerPerCountry);
  t.test("widens a marker for more digits", widensAMarkerForMoreDigits);
  t.test("matches a common name", matchesACommonName);
  t.test(
    "matches a name without accents or case",
    matchesANameWithoutAccentsOrCase,
  );
  t.test(
    "leaves a historical country off the map",
    leavesAHistoricalCountryOffTheMap,
  );
  t.test("groups tiles not on the map", groupsTilesNotOnTheMap);
  t.test("shows every sample tile on the map", showsEverySampleTileOnTheMap);
  t.test("opens a country", opensACountry);
  t.test(
    "replaces the sidebar for another country",
    replacesTheSidebarForAnotherCountry,
  );
  t.test("selects a country by its shape", selectsACountryByItsShape);
  t.test("closes the sidebar", closesTheSidebar);
  t.test("shows the book metadata", showsTheBookMetadata);
  t.test("shows a mapping as JSON", showsAMappingAsJson);
  t.test("closes the card with its button", closesTheCardWithItsButton);
}
