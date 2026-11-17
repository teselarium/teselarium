/**
 * Tests of the sample country map mod, which `mods.check` runs after
 * mounting it. Each case runs in a fresh hidden frame with a throwaway
 * storage slot, and mounts the mod itself through its context.
 *
 * The cases read the page: the country shapes, the markers' names, numbers
 * and states, the sidebar and the card. The cases that open a card or render
 * a body use the sample sites: `tiles.renderBody` renders only the tiles of
 * the check's collection, so the cases that need other metadata keep a
 * sample tile's source and body. The cases that only count, size or place
 * markers mount made-up tiles, each with its own source, so they do not
 * depend on the sample's size.
 *
 * What a hidden frame cannot show is tested in
 * e2e/sample_country_map.spec.ts: where the markers are, the colors, the
 * layouts, where the focus goes (a check's frames are inert), the Escape key
 * and "Reload tiles", which a case cannot press.
 */

const MAP_COUNTRY_COUNT = 177;

/** The markers of the sample sites, in the order of their countries' names. */
const SAMPLE_MARKER_NAMES = [
  "China, 2 tiles",
  "Ecuador, 1 tile",
  "Egypt, 1 tile",
  "France, 1 tile",
  "Greece, 1 tile",
  "India, 1 tile",
  "Jordan, 1 tile",
  "Peru, 1 tile",
  "Tanzania, 1 tile",
  "United States, 1 tile",
];

const SAMPLE_MARKER_NUMBERS = [
  "2",
  "1",
  "1",
  "1",
  "1",
  "1",
  "1",
  "1",
  "1",
  "1",
];

/** The sample site whose card the card cases open, and its country. */
const CARD_TITLE = "Machu Picchu";
const CARD_COUNTRY = "Peru";

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
  throw new Error(
    `The default mosaic's collection has no tile titled "${title}"`,
  );
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

/**
 * `count` made-up tiles in `country`, with an empty body and a source of
 * their own, such as `made-up/Germany/3.md`, so none collapses into another.
 */
function buildMadeUpTiles(country, count) {
  const tiles = [];
  for (let number = 1; number <= count; number += 1) {
    tiles.push({
      source: `made-up/${country}/${number}.md`,
      metadata: { title: `Made-up tile ${number} in ${country}`, country },
      body: "",
    });
  }
  return tiles;
}

/** The titles of the sample sites in `country`, in the collection's order. */
function readSampleTitles(context, country) {
  const titles = [];
  for (const tile of context.tiles) {
    if (tile.metadata.country === country) {
      titles.push(tile.metadata.title);
    }
  }
  return titles;
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
    ...buildMadeUpTiles("France", 7),
    ...buildMadeUpTiles("Germany", 12),
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
    ...buildMadeUpTiles("United States", 1),
    ...buildMadeUpTiles("usa", 1),
  ];
  await context.mount({ tiles });
  context.expect(readMarkerNames(context)).toEqual(["United States, 2 tiles"]);
}

async function matchesANameWithoutAccentsOrCase(context) {
  const tiles = [
    ...buildMadeUpTiles(" cote d'ivoire ", 1),
    ...buildMadeUpTiles("CÔTE D’IVOIRE", 1),
    ...buildMadeUpTiles("Ivory Coast", 1),
  ];
  await context.mount({ tiles });
  context.expect(readMarkerNames(context)).toEqual(["cote d'ivoire, 3 tiles"]);
  context.expect(findUnplacedButton(context)).toBe(null);
}

async function leavesAHistoricalCountryOffTheMap(context) {
  await context.mount({
    tiles: buildMadeUpTiles("Soviet Union", 1),
  });
  context.expect(listMarkers(context).length).toBe(0);
  context
    .expect(findUnplacedButton(context).textContent)
    .toBe("Not on the map, 1 tile");
}

async function groupsTilesNotOnTheMap(context) {
  const [soviet] = buildMadeUpTiles("Soviet Union", 1);
  const [france] = buildMadeUpTiles("France", 1);
  const [singapore] = buildMadeUpTiles("Singapore", 1);
  await context.mount({ tiles: [soviet, france, singapore] });
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
  const chineseTitles = readSampleTitles(context, "China");
  context
    .expect(chineseTitles)
    .toEqual(["Great Wall of China", "Forbidden City"]);
  const china = findMarker(context, "China");
  context.expect(readSidebar(context).hidden).toBe(true);
  china.click();
  const sidebar = readSidebar(context);
  context.expect(sidebar.hidden).toBe(false);
  context.expect(sidebar.querySelector("h2").textContent).toBe("China");
  context.expect(sidebar.querySelector("p").textContent).toBe("2 tiles");
  context.expect(readSidebarTitles(context)).toEqual(chineseTitles);
  context.expect(china.getAttribute("aria-expanded")).toBe("true");
  context
    .expect(findMarker(context, "Peru").getAttribute("aria-expanded"))
    .toBe("false");
  context.expect(readSelectedShapeCount(context)).toBe(1);
  context
    .expect(
      sidebar.querySelectorAll('li > button[aria-haspopup="dialog"]').length,
    )
    .toBe(chineseTitles.length);
}

async function replacesTheSidebarForAnotherCountry(context) {
  await context.mount();
  findMarker(context, "China").click();
  findMarker(context, "Peru").click();
  const sidebar = readSidebar(context);
  context.expect(sidebar.querySelector("h2").textContent).toBe("Peru");
  context.expect(sidebar.querySelector("p").textContent).toBe("1 tile");
  context
    .expect(findMarker(context, "China").getAttribute("aria-expanded"))
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

/** Mounts `tiles` and opens the card of the sample site the card cases use. */
async function mountAndOpenCard(context, tiles) {
  await context.mount({ tiles });
  findMarker(context, CARD_COUNTRY).click();
  findTileButton(context, CARD_TITLE).click();
}

async function showsTheTileMetadata(context) {
  const site = changeTile(findSampleTile(context, CARD_TITLE), {
    inscribed: 1983,
    criteria: ["i", "iii"],
    area: null,
  });
  await mountAndOpenCard(context, [site]);
  const card = readCard(context);
  context.expect(card.open).toBe(true);
  context.expect(card.querySelector("h2").textContent).toBe(CARD_TITLE);
  context
    .expect(card.getAttribute("aria-labelledby"))
    .toBe(card.querySelector("h2").id);
  const details = readCardDetails(context);
  context.expect(details.country).toBe(CARD_COUNTRY);
  context.expect(details.inscribed).toBe("1983");
  context.expect(details.criteria).toBe("i, iii");
  context.expect(Object.hasOwn(details, "area")).toBe(false);
  context.expect(Object.hasOwn(details, "title")).toBe(false);
  context.expect(Object.hasOwn(details, "image")).toBe(false);
  context.expect(card.querySelector("ot-tile-body")).not.toBe(null);
}

async function showsAMappingAsJson(context) {
  const site = changeTile(findSampleTile(context, CARD_TITLE), {
    listing: { unesco: 1983 },
    endangered: false,
    tags: [],
    note: "",
  });
  await mountAndOpenCard(context, [site]);
  const details = readCardDetails(context);
  context.expect(details.listing).toBe('{"unesco":1983}');
  context.expect(details.endangered).toBe("false");
  context.expect(Object.hasOwn(details, "tags")).toBe(false);
  context.expect(Object.hasOwn(details, "note")).toBe(false);
}

function isCardClosed(context) {
  return !readCard(context).open;
}

async function closesTheCardWithItsButton(context) {
  await mountAndOpenCard(context, context.tiles);
  readCard(context).querySelector('button[aria-label="Close"]').click();
  await context.waitFor(isCardClosed.bind(undefined, context));
  context
    .expect(readSidebar(context).querySelector("h2").textContent)
    .toBe(CARD_COUNTRY);
  context
    .expect(readSidebarTitles(context))
    .toEqual(readSampleTitles(context, CARD_COUNTRY));
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
  t.test("shows the tile metadata", showsTheTileMetadata);
  t.test("shows a mapping as JSON", showsAMappingAsJson);
  t.test("closes the card with its button", closesTheCardWithItsButton);
}
