import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page, Request, Route } from "@playwright/test";
import {
  pressTheaterMode,
  sizeModFrame,
  waitForFrameLayout,
} from "./layout_probes.ts";
import {
  actionDialog,
  expectNoIssues,
  findModFrame,
  isFrameMarked,
  markFrame,
  openMessages,
  reloadTiles,
  routeCovers,
  stageBar,
} from "./mod_routes.ts";
import {
  COUNTRY_MAP_COLLECTION_GLOB,
  COUNTRY_MAP_COLLECTION_PATH,
  COUNTRY_MAP_COLLECTION_RUN_HASH,
  COUNTRY_MAP_MOD_REFERENCE,
  COUNTRY_MAP_MOSAIC_RUN_HASH,
  COUNTRY_MAP_SITES_FOLDER_PATH,
  NPM_HOST,
  routeNpmFiles,
} from "./sample_mod.ts";
import type { NpmRequest, NpmRouteOptions } from "./sample_mod.ts";
import { readTokenAs, waitForFrameColorScheme } from "./theme_probes.ts";

const MOD_TITLE = "Country Map";
const MAP_COUNTRY_COUNT = 177;

/** The markers of the sample sites, in the order of their countries' names, which is their Tab order. */
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

/** The five files the sample declares, on the vanilla npm host, sorted. */
const SAMPLE_LIBRARY_URLS = [
  `${NPM_HOST}leaflet@1.9.4/dist/leaflet.css`,
  `${NPM_HOST}leaflet@1.9.4/dist/leaflet.js`,
  `${NPM_HOST}proj4@2.23.0/dist/proj4.js`,
  `${NPM_HOST}topojson-client@3.1.0/dist/topojson-client.min.js`,
  `${NPM_HOST}world-atlas@2.0.2/countries-110m.json`,
];

const LEAFLET_SCRIPT_PATH = "leaflet@1.9.4/dist/leaflet.js";

/**
 * Appended to the copy of Leaflet: hooks that keep the map and every marker
 * on `globalThis`, so a test can project a marker's point as the map does.
 * The mod itself is not changed.
 */
const LEAFLET_PROBE_HOOKS = [
  "L.Map.addInitHook(function keepProbeMap() { globalThis.probeMap = this; });",
  "L.Marker.addInitHook(function keepProbeMarker() {",
  "  globalThis.probeMarkers = globalThis.probeMarkers || [];",
  "  globalThis.probeMarkers.push(this);",
  "});",
].join("\n");

/** The sample site whose card the card tests open, in Peru. */
const CARD_TITLE = "Machu Picchu";
const CARD_COUNTRY = "Peru";
const CARD_LINK = "https://en.wikipedia.org/wiki/Machu_Picchu";
const CARD_TILE_GLOB = `**${COUNTRY_MAP_SITES_FOLDER_PATH}/machu_picchu.md`;
const CARD_COLLECTION_LINE = '    - path: "./machu_picchu.md"';

/** China's sample sites, in the collection's order. */
const CHINESE_TITLES = ["Great Wall of China", "Forbidden City"];
const GREAT_WALL_COLLECTION_LINE = '    - path: "./great_wall_of_china.md"';

/** The upload.wikimedia.org host the sample sites' images load from, which `routeCovers` answers. */
const SITE_IMAGE_HOST = "https://upload.wikimedia.org";

/** A made-up tile that is not in the sample, served next to the sample sites. */
interface AddedTile {
  file: string;
  title: string;
  country: string;
}

const EXTRA_CHINESE_SITE: AddedTile = {
  file: "extra_chinese_site.md",
  title: "An Extra Chinese Site",
  country: "China",
};

const MADE_UP_NORWAY: AddedTile = {
  file: "made_up_norway.md",
  title: "A Made-up Tile in Norway",
  country: "Norway",
};

const MADE_UP_AUSTRIA: AddedTile = {
  file: "made_up_austria.md",
  title: "A Made-up Tile in Austria",
  country: "Austria",
};

const MADE_UP_HUNGARY: AddedTile = {
  file: "made_up_hungary.md",
  title: "A Made-up Tile in Hungary",
  country: "Hungary",
};

/** 24rem at the frame's 16px root font size. */
const PHONE_FRAME_WIDTH = 384;

/** Whether a route answers its changed version: off at first, switched on before "Reload tiles". */
interface RouteSwitch {
  isOn: boolean;
}

/** A marker as the map shows it: its tip and its box in the map container's coordinates, its point as the map projects it, and its tip's latitude and longitude. */
interface MarkerTip {
  name: string;
  /** Whether the tip is inside its own country's shape. */
  isOnOwnLand: boolean;
  tipX: number;
  tipY: number;
  pointX: number;
  pointY: number;
  lat: number;
  lng: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  mapWidth: number;
  mapHeight: number;
}

/** What the tests read of Leaflet's map and markers, which the probe hooks keep. */
interface ProbePoint {
  x: number;
  y: number;
}

interface ProbeLatLng {
  lat: number;
  lng: number;
}

interface ProbeMarker {
  getElement(): HTMLElement | undefined;
  getLatLng(): ProbeLatLng;
}

interface ProbeMap {
  getContainer(): HTMLElement;
  hasLayer(layer: ProbeMarker): boolean;
  latLngToContainerPoint(latLng: ProbeLatLng): ProbePoint;
  containerPointToLatLng(point: [number, number]): ProbeLatLng;
}

/** proj4's converter between two projections. */
interface ProbeConverter {
  forward(point: [number, number]): [number, number];
  inverse(point: [number, number]): [number, number];
}

interface LeafletProbe {
  probeMap?: ProbeMap;
  probeMarkers?: ProbeMarker[];
  proj4?: (from: string, to: string) => ProbeConverter;
}

/** Equal Earth as the mod defines it, and half the world's width in its map units. */
const EQUAL_EARTH =
  "+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";
const WORLD_HALF_WIDTH = 256;

/** A place, by latitude and longitude, where a test clicks the map. */
interface Place {
  lat: number;
  lng: number;
}

/** Bordeaux, in France, away from France's marker. */
const BORDEAUX: Place = { lat: 44.84, lng: -0.58 };

/** Madrid, in Spain, which has no sample sites. */
const MADRID: Place = { lat: 40.42, lng: -3.7 };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildProbeRouteOptions(missingPaths: string[]): NpmRouteOptions {
  const options: NpmRouteOptions = {
    missingPaths,
    appendedCode: { [LEAFLET_SCRIPT_PATH]: LEAFLET_PROBE_HOOKS },
  };
  return options;
}

/** Answers the npm host from `e2e/npm_files/`, with the probe hooks, and every site image with a 1×1 PNG. */
async function routeSampleHosts(
  page: Page,
  missingPaths: string[] = [],
): Promise<NpmRequest[]> {
  const npmRequests = await routeNpmFiles(
    page,
    buildProbeRouteOptions(missingPaths),
  );
  await routeCovers(page);
  return npmRequests;
}

function markerButton(frame: Frame, country: string): Locator {
  return frame.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(country)}, \\d+ tiles?$`),
  });
}

function sidebar(frame: Frame): Locator {
  return frame.locator("aside");
}

function tileButton(frame: Frame, title: string): Locator {
  return sidebar(frame).getByRole("button", { name: title, exact: true });
}

function tileCard(frame: Frame): Locator {
  return frame.getByRole("dialog");
}

/** Opens the sample at `hash`, its default mosaic with the sample sites unless given, and waits for France's marker. */
async function openSample(
  page: Page,
  hash: string = COUNTRY_MAP_MOSAIC_RUN_HASH,
): Promise<Frame> {
  await page.goto(`/${hash}`);
  const frame = await findModFrame(page, MOD_TITLE);
  await expect(markerButton(frame, "France")).toBeVisible();
  return frame;
}

async function routeAndOpenSample(page: Page): Promise<Frame> {
  await routeSampleHosts(page);
  const frame = await openSample(page);
  return frame;
}

/** Selects a country with the keyboard, which reaches a marker even under another one. */
async function selectWithKeyboard(
  frame: Frame,
  country: string,
): Promise<void> {
  const marker = markerButton(frame, country);
  await marker.focus();
  await marker.press("Enter");
  await expect(sidebar(frame).getByRole("heading")).toHaveText(country);
}

/** Opens the card of "Machu Picchu" from Peru's sidebar. */
async function openSiteCard(frame: Frame): Promise<Locator> {
  await selectWithKeyboard(frame, CARD_COUNTRY);
  await tileButton(frame, CARD_TITLE).click();
  const card = frame.getByRole("dialog", { name: CARD_TITLE });
  await expect(card).toBeVisible();
  return card;
}

/** Runs in the frame: each marker on the map, with its tip and the point the map projects for it. */
function readMarkerTips(projectionSettings: [string, number]): MarkerTip[] {
  const [definition, halfWidth] = projectionSettings;
  const probe = globalThis as LeafletProbe;
  const map = probe.probeMap;
  if (map === undefined || probe.proj4 === undefined) {
    throw new Error(
      "Expected the probe hooks to keep Leaflet's map, and proj4",
    );
  }
  const converter = probe.proj4("EPSG:4326", definition);
  const metersPerUnit = converter.forward([180, 0])[0] / halfWidth;
  const mapBox = map.getContainer().getBoundingClientRect();
  const tips: MarkerTip[] = [];
  for (const marker of probe.probeMarkers ?? []) {
    const element = marker.getElement();
    if (!map.hasLayer(marker) || element === undefined) {
      continue;
    }
    const box = element.getBoundingClientRect();
    const tipX = box.left + box.width / 2 - mapBox.left;
    const tipY = box.bottom - mapBox.top;
    const point = map.latLngToContainerPoint(marker.getLatLng());
    const tipUnits = map.containerPointToLatLng([tipX, tipY]);
    const [lng, lat] = converter.inverse([
      tipUnits.lng * metersPerUnit,
      tipUnits.lat * metersPerUnit,
    ]);
    const shape = document.querySelector(
      `path.country[data-country="${element.dataset.key ?? ""}"]`,
    );
    let isOnOwnLand = false;
    if (shape instanceof SVGPathElement) {
      const matrix = shape.getScreenCTM()?.inverse();
      const tip = new DOMPoint(box.left + box.width / 2, box.bottom);
      isOnOwnLand =
        matrix !== undefined &&
        shape.isPointInFill(tip.matrixTransform(matrix));
    }
    tips.push({
      name: element.getAttribute("aria-label") ?? "",
      isOnOwnLand,
      tipX,
      tipY,
      pointX: point.x,
      pointY: point.y,
      lat,
      lng,
      left: box.left - mapBox.left,
      right: box.right - mapBox.left,
      top: box.top - mapBox.top,
      bottom: box.bottom - mapBox.top,
      mapWidth: mapBox.width,
      mapHeight: mapBox.height,
    });
  }
  return tips;
}

const PROJECTION_SETTINGS: [string, number] = [EQUAL_EARTH, WORLD_HALF_WIDTH];

async function readTip(frame: Frame, country: string): Promise<MarkerTip> {
  const tips = await frame.evaluate(readMarkerTips, PROJECTION_SETTINGS);
  for (const tip of tips) {
    if (tip.name.startsWith(`${country}, `)) {
      return tip;
    }
  }
  throw new Error(`No marker is named after "${country}"`);
}

/** The largest distance, in pixels, between a marker's tip and its projected point. */
async function readLargestTipOffset(frame: Frame): Promise<number> {
  const tips = await frame.evaluate(readMarkerTips, PROJECTION_SETTINGS);
  let largest = 0;
  for (const tip of tips) {
    const offset = Math.hypot(tip.tipX - tip.pointX, tip.tipY - tip.pointY);
    largest = Math.max(largest, offset);
  }
  return largest;
}

/** Runs in the frame: the number of country shapes. */
function countCountryShapes(): number {
  return document.querySelectorAll("path.country").length;
}

/** Runs in the frame: the computed fill of a country's shape, by its map name. */
function readCountryFill(mapName: string): string {
  const shape = document.querySelector(
    `path.country[data-country="${mapName}"]`,
  );
  if (shape === null) {
    throw new Error(`Expected the shape of ${mapName}`);
  }
  return getComputedStyle(shape).fill;
}

interface MapColors {
  france: string;
  spain: string;
  sea: string;
  sidebar: string;
  tileButton: string;
}

/**
 * Runs in the frame: colors of the map and the sidebar, each painted on a
 * canvas and read back as `r,g,b`, so a `color-mix()` and a token compare
 * in one format.
 */
function readMapColors(): MapColors {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("Expected a 2D canvas");
  }
  const computed: Record<keyof MapColors, string> = {
    france: getComputedStyle(
      document.querySelector('path.country[data-country="France"]') as Element,
    ).fill,
    spain: getComputedStyle(
      document.querySelector('path.country[data-country="Spain"]') as Element,
    ).fill,
    sea: getComputedStyle(
      document.querySelector(".leaflet-container") as Element,
    ).backgroundColor,
    sidebar: getComputedStyle(document.querySelector("aside") as Element)
      .backgroundColor,
    tileButton: getComputedStyle(
      document.querySelector("aside li > button") ?? document.body,
    ).backgroundColor,
  };
  const colors = { ...computed };
  for (const key of Object.keys(computed) as (keyof MapColors)[]) {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = computed[key];
    context.fillRect(0, 0, 1, 1);
    colors[key] = Array.from(context.getImageData(0, 0, 1, 1).data)
      .slice(0, 3)
      .join(",");
  }
  return colors;
}

/** Runs in the frame: where a place is in the map container, projected as the mod projects it. */
function projectPlace(settings: [string, number, number, number]): ProbePoint {
  const [definition, halfWidth, lat, lng] = settings;
  const probe = globalThis as LeafletProbe;
  if (probe.probeMap === undefined || probe.proj4 === undefined) {
    throw new Error(
      "Expected the probe hooks to keep Leaflet's map, and proj4",
    );
  }
  const converter = probe.proj4("EPSG:4326", definition);
  const metersPerUnit = converter.forward([180, 0])[0] / halfWidth;
  const [x, y] = converter.forward([lng, lat]);
  const point = probe.probeMap.latLngToContainerPoint({
    lat: y / metersPerUnit,
    lng: x / metersPerUnit,
  });
  return point;
}

/** Clicks the map at a place. */
async function clickPlace(
  page: Page,
  frame: Frame,
  place: Place,
): Promise<void> {
  const point = await frame.evaluate(projectPlace, [
    EQUAL_EARTH,
    WORLD_HALF_WIDTH,
    place.lat,
    place.lng,
  ] as [string, number, number, number]);
  const mapBox = await frame.locator(".leaflet-container").boundingBox();
  if (mapBox === null) {
    throw new Error("Expected the map to have a box");
  }
  await page.mouse.click(mapBox.x + point.x, mapBox.y + point.y);
}

interface WidthPair {
  map: number;
  frame: number;
}

/** Runs in the frame: the map's width and the frame's. */
function readMapWidth(): WidthPair {
  const map = document.querySelector(".leaflet-container");
  if (map === null) {
    throw new Error("Expected the map");
  }
  const widths: WidthPair = {
    map: map.getBoundingClientRect().width,
    frame: document.documentElement.clientWidth,
  };
  return widths;
}

/** Runs on a marker's element: its computed z-index. */
function readZIndex(element: Element): number {
  return Number(getComputedStyle(element).zIndex);
}

interface ElementBox {
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/** Runs on an element: its box in the frame's viewport. */
function readBox(element: Element): ElementBox {
  const rectangle = element.getBoundingClientRect();
  const box: ElementBox = {
    top: rectangle.top,
    bottom: rectangle.bottom,
    left: rectangle.left,
    width: rectangle.width,
    height: rectangle.height,
  };
  return box;
}

/** Runs in the page before the app: "Load media linked by tiles" off. */
function turnOffTileLinkedMedia(): void {
  localStorage.setItem("teselarium.tile-linked-media", "false");
}

/** Runs on an image: its natural width, 0 until it loaded. */
function readNaturalWidth(image: Element): number {
  return (image as HTMLImageElement).naturalWidth;
}

/** Runs on an element: its computed background color. */
function readBackgroundColor(element: Element): string {
  return getComputedStyle(element).backgroundColor;
}

/** Runs in the frame: the name of the focused element. */
function readFocusedName(): string {
  const focused = document.activeElement;
  if (focused === null) {
    return "";
  }
  return focused.getAttribute("aria-label") ?? focused.textContent ?? "";
}

/** Runs in the frame: every color the mod's own styles set without a theme token, as `selector { property: value }`. */
function listOwnColorsWithoutTokens(): string[] {
  const colorPattern =
    /(^|-)color$|^background|^fill$|^stroke$|^border(-(top|right|bottom|left))?$/;
  const found: string[] = [];
  const rules: CSSRule[] = [];
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.textContent?.includes("path.country") === true) {
      rules.push(...sheet.cssRules);
    }
  }
  while (rules.length > 0) {
    const rule = rules.shift() as CSSRule;
    if ("cssRules" in rule) {
      rules.push(...(rule.cssRules as CSSRuleList));
    }
    if (!(rule instanceof CSSStyleRule)) {
      continue;
    }
    for (const declaration of rule.style.cssText.split(";")) {
      const [property, value] = declaration.split(":");
      if (value === undefined || !colorPattern.test(property.trim())) {
        continue;
      }
      if (!value.includes("var(--tes-")) {
        found.push(`${rule.selectorText} { ${declaration.trim()} }`);
      }
    }
  }
  return found;
}

function listNpmUrls(requests: NpmRequest[]): string[] {
  const urls: string[] = [];
  for (const request of requests) {
    urls.push(request.url);
  }
  urls.sort();
  return urls;
}

function isEveryRequestFromPage(requests: NpmRequest[]): boolean {
  for (const request of requests) {
    if (!request.isFromPage) {
      return false;
    }
  }
  return true;
}

function recordImageRequest(imageUrls: string[], request: Request): void {
  if (request.resourceType() === "image") {
    imageUrls.push(request.url());
  }
}

/** Answers the sample collection with `change` applied to its text once `changed.isOn` is set. */
async function answerChangedCollection(
  changed: RouteSwitch,
  change: (text: string) => string,
  route: Route,
): Promise<void> {
  if (!changed.isOn) {
    await route.fallback();
    return;
  }
  const response = await route.fetch();
  const text = await response.text();
  await route.fulfill({ response, body: change(text) });
}

/** The text of a made-up tile file. */
function buildAddedTileText(tile: AddedTile): string {
  const text = `---\ntitle: "${tile.title}"\ncountry: "${tile.country}"\n---\n\nA tile added to the collection.\n`;
  return text;
}

function addTiles(tiles: AddedTile[], text: string): string {
  let changedText = text.trimEnd();
  for (const tile of tiles) {
    changedText += `\n    - path: "./${tile.file}"`;
  }
  changedText += "\n";
  return changedText;
}

function removeCollectionLine(line: string, text: string): string {
  const changedText = text.replace(`${line}\n`, "");
  return changedText;
}

async function answerAddedTile(tile: AddedTile, route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/markdown",
    body: buildAddedTileText(tile),
  });
}

/** Answers "Machu Picchu" with `inscribed: 1983` once `changed.isOn` is set. */
async function answerChangedSite(
  changed: RouteSwitch,
  route: Route,
): Promise<void> {
  if (!changed.isOn) {
    await route.fallback();
    return;
  }
  const response = await route.fetch();
  const text = await response.text();
  await route.fulfill({
    response,
    body: text.replace(
      `country: "${CARD_COUNTRY}"\n`,
      `country: "${CARD_COUNTRY}"\ninscribed: 1983\n`,
    ),
  });
}

/** Changes the sample collection with `change` once the returned switch is on. */
async function routeChangedCollection(
  page: Page,
  change: (text: string) => string,
): Promise<RouteSwitch> {
  const changed: RouteSwitch = { isOn: false };
  await page.route(
    COUNTRY_MAP_COLLECTION_GLOB,
    answerChangedCollection.bind(undefined, changed, change),
  );
  return changed;
}

/**
 * Serves `tiles` next to the sample sites, and adds them to the sample
 * collection once the returned switch is on.
 */
async function routeAddedTiles(
  page: Page,
  tiles: AddedTile[],
): Promise<RouteSwitch> {
  const changed = await routeChangedCollection(
    page,
    addTiles.bind(undefined, tiles),
  );
  for (const tile of tiles) {
    await page.route(
      `**${COUNTRY_MAP_SITES_FOLDER_PATH}/${tile.file}`,
      answerAddedTile.bind(undefined, tile),
    );
  }
  return changed;
}

/** Opens the default mosaic with `tiles` added to the sample sites. */
async function routeAndOpenSampleWith(
  page: Page,
  tiles: AddedTile[],
): Promise<Frame> {
  await routeSampleHosts(page);
  const changed = await routeAddedTiles(page, tiles);
  changed.isOn = true;
  const frame = await openSample(page);
  return frame;
}

/** The sample's collection file, as the tests' changes start from it. */
function readSampleCollectionText(): string {
  const text = readFileSync(
    new URL(`../public${COUNTRY_MAP_COLLECTION_PATH}`, import.meta.url),
    "utf8",
  );
  return text;
}

test.describe(
  "Declared libraries",
  { tag: "@sample" },
  function describeDeclaredLibraries(): void {
    test("Libraries come from the npm host", async function loadsLibraries({
      page,
    }): Promise<void> {
      const npmRequests = await routeSampleHosts(page);

      await openSample(page);

      expect(listNpmUrls(npmRequests)).toEqual(SAMPLE_LIBRARY_URLS);
      expect(isEveryRequestFromPage(npmRequests)).toBe(true);
    });

    test("Library that cannot be loaded", async function showsLoadFailure({
      page,
    }): Promise<void> {
      await routeSampleHosts(page, [LEAFLET_SCRIPT_PATH]);

      await page.goto(`/${COUNTRY_MAP_COLLECTION_RUN_HASH}`);
      const frame = await findModFrame(page, MOD_TITLE);

      await expect(frame.getByRole("status")).toHaveText(
        "The map could not be loaded.",
      );
      await expect(frame.locator(".leaflet-container")).toHaveCount(0);
      const errors = await openMessages(page, "Errors");
      await expect(errors).toContainText("leaflet");
    });
  },
);

test.describe(
  "World map",
  { tag: "@sample" },
  function describeWorldMap(): void {
    test("Map of the sample", async function drawsSampleMap({
      page,
    }): Promise<void> {
      const frame = await routeAndOpenSample(page);

      expect(await frame.evaluate(countCountryShapes)).toBe(MAP_COUNTRY_COUNT);
      const tips = await frame.evaluate(readMarkerTips, PROJECTION_SETTINGS);
      expect(tips).toHaveLength(SAMPLE_MARKER_NAMES.length);
      for (const tip of tips) {
        expect(tip.left, tip.name).toBeGreaterThanOrEqual(0);
        expect(tip.top, tip.name).toBeGreaterThanOrEqual(0);
        expect(tip.right, tip.name).toBeLessThanOrEqual(tip.mapWidth);
        expect(tip.bottom, tip.name).toBeLessThanOrEqual(tip.mapHeight);
      }
    });

    test("Theater mode", async function fillsWidthInTheater({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1800, height: 900 });
      const frame = await routeAndOpenSample(page);
      await waitForFrameLayout(frame, "contained");

      const contained = await frame.evaluate(readMapWidth);
      expect(contained.map).toBe(contained.frame);
      await pressTheaterMode(page, true);
      await waitForFrameLayout(frame, "theater");

      const theater = await frame.evaluate(readMapWidth);
      expect(theater.map).toBe(theater.frame);
    });
  },
);

test.describe("Map look", { tag: "@sample" }, function describeMapLook(): void {
  test("Dark map", async function followsDarkScheme({ page }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    await markFrame(frame);
    const lightFill = await frame.evaluate(readCountryFill, "Spain");

    await page.emulateMedia({ colorScheme: "dark" });
    await waitForFrameColorScheme(frame, "dark");

    const darkMuted = await frame.evaluate(readTokenAs, [
      "--tes-muted",
      "fill",
    ]);
    expect(await frame.evaluate(readCountryFill, "Spain")).toBe(darkMuted);
    expect(darkMuted).not.toBe(lightFill);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Countries with tiles stand out", async function highlightsCountries({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);

    const colors = await frame.evaluate(readMapColors);

    expect(colors.france).not.toBe(colors.spain);
    expect(colors.france).not.toBe(colors.sea);
    expect(colors.spain).not.toBe(colors.sea);
  });

  test("No map tiles", async function requestsNoMapImages({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    const imageUrls: string[] = [];
    page.on("request", recordImageRequest.bind(undefined, imageUrls));
    const map = frame.locator(".leaflet-container");
    const box = await map.boundingBox();
    if (box === null) {
      throw new Error("Expected the map to have a box");
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2);
    await page.mouse.up();
    await frame.getByRole("button", { name: "Zoom in" }).click();
    await frame.getByRole("button", { name: "Zoom in" }).click();
    await expect
      .poll(readLargestTipOffset.bind(undefined, frame))
      .toBeLessThan(2);

    expect(imageUrls).toEqual([]);
  });

  test("Mod's own styles", async function setsColorsFromTokens({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);

    expect(await frame.evaluate(listOwnColorsWithoutTokens)).toEqual([]);
  });
});

test.describe(
  "Attribution",
  { tag: "@sample" },
  function describeAttribution(): void {
    test("Leaflet link", async function opensLeafletLink({
      page,
    }): Promise<void> {
      const frame = await routeAndOpenSample(page);
      await markFrame(frame);

      await frame.getByRole("link", { name: "Leaflet" }).click();

      await expect(actionDialog(page)).toContainText("https://leafletjs.com");
      await actionDialog(page).getByRole("button", { name: "Cancel" }).click();
      expect(await isFrameMarked(frame)).toBe(true);
      await expect(markerButton(frame, "France")).toBeVisible();
    });
  },
);

test.describe("Markers", { tag: "@sample" }, function describeMarkers(): void {
  test("Tip on the country's land", async function placesTipsOnLand({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSampleWith(page, [MADE_UP_NORWAY]);
    await expect(markerButton(frame, "Norway")).toBeVisible();

    const tips = await frame.evaluate(readMarkerTips, PROJECTION_SETTINGS);

    expect(tips).toHaveLength(SAMPLE_MARKER_NAMES.length + 1);
    for (const tip of tips) {
      expect(tip.isOnOwnLand, tip.name).toBe(true);
    }
    const norway = await readTip(frame, "Norway");
    expect(norway.isOnOwnLand).toBe(true);
  });

  test("Country with overseas land", async function placesFranceTip({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);

    const france = await readTip(frame, "France");

    expect(france.lat).toBeGreaterThan(42);
    expect(france.lat).toBeLessThan(51.5);
    expect(france.lng).toBeGreaterThan(-5);
    expect(france.lng).toBeLessThan(8);
  });

  test("Tip on the country", async function keepsTipsOnZoom({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    expect(await readLargestTipOffset(frame)).toBeLessThan(2);

    await frame.getByRole("button", { name: "Zoom in" }).click();
    await frame.getByRole("button", { name: "Zoom in" }).click();

    await expect
      .poll(readLargestTipOffset.bind(undefined, frame))
      .toBeLessThan(2);
  });

  test("Select with the keyboard", async function selectsWithKeyboard({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    const china = markerButton(frame, "China");
    await expect(china).toHaveAccessibleName("China, 2 tiles");

    await china.focus();
    await china.press("Enter");

    await expect(sidebar(frame).getByRole("heading")).toHaveText("China");
    await expect(china).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar(frame).getByRole("heading")).toBeFocused();
  });

  test("Select with Space", async function selectsWithSpace({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    const peru = markerButton(frame, "Peru");

    await peru.focus();
    await peru.press(" ");

    await expect(sidebar(frame).getByRole("heading")).toHaveText("Peru");
    await expect(peru).toHaveAttribute("aria-expanded", "true");
  });

  test("Tab order", async function tabsByName({ page }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    await frame.locator(".leaflet-container").focus();

    const names: string[] = [];
    for (let index = 0; index < SAMPLE_MARKER_NAMES.length; index += 1) {
      await page.keyboard.press("Tab");
      names.push(await frame.evaluate(readFocusedName));
    }

    expect(names).toEqual(SAMPLE_MARKER_NAMES);
  });

  test("Overlapping markers", async function raisesFocusedMarker({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSampleWith(page, [
      MADE_UP_AUSTRIA,
      MADE_UP_HUNGARY,
    ]);
    const austria = markerButton(frame, "Austria");
    const hungary = markerButton(frame, "Hungary");
    const austriaTip = await readTip(frame, "Austria");
    const hungaryTip = await readTip(frame, "Hungary");
    expect(austriaTip.right).toBeGreaterThan(hungaryTip.left);
    expect(Math.abs(austriaTip.top - hungaryTip.top)).toBeLessThan(
      austriaTip.bottom - austriaTip.top,
    );

    await austria.focus();

    expect(await austria.evaluate(readZIndex)).toBeGreaterThan(
      await hungary.evaluate(readZIndex),
    );
  });
});

test.describe(
  "Country shapes",
  { tag: "@sample" },
  function describeCountryShapes(): void {
    test("Click a country", async function selectsClickedCountry({
      page,
    }): Promise<void> {
      const frame = await routeAndOpenSample(page);

      await clickPlace(page, frame, BORDEAUX);

      await expect(sidebar(frame).getByRole("heading")).toHaveText("France");
      await expect(markerButton(frame, "France")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    test("Click a country without tiles", async function ignoresEmptyCountry({
      page,
    }): Promise<void> {
      const frame = await routeAndOpenSample(page);

      await clickPlace(page, frame, MADRID);

      await expect(sidebar(frame)).toBeHidden();
    });
  },
);

test.describe("Sidebar", { tag: "@sample" }, function describeSidebar(): void {
  test("France's tiles", async function listsFranceTiles({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);

    await markerButton(frame, "France").click();

    await expect(sidebar(frame).getByRole("heading")).toHaveText("France");
    await expect(sidebar(frame)).toContainText("1 tile");
    await expect(sidebar(frame).getByRole("listitem")).toHaveText([
      "Mont-Saint-Michel",
    ]);
  });

  test("China's tiles", async function listsChinaTiles({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);

    await markerButton(frame, "China").click();

    await expect(sidebar(frame).getByRole("heading")).toHaveText("China");
    await expect(sidebar(frame)).toContainText("2 tiles");
    await expect(sidebar(frame).getByRole("listitem")).toHaveText(
      CHINESE_TITLES,
    );
  });

  test("Sidebar colors", async function colorsSidebar({ page }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    await selectWithKeyboard(frame, "China");
    await expect(sidebar(frame).getByRole("listitem").first()).toHaveText(
      CHINESE_TITLES[0],
    );

    const card = await frame.evaluate(readTokenAs, [
      "--tes-card",
      "background-color",
    ]);
    const background = await frame.evaluate(readTokenAs, [
      "--tes-background",
      "background-color",
    ]);
    const colors = await frame.evaluate(readMapColors);

    expect(await sidebar(frame).evaluate(readBackgroundColor)).toBe(card);
    expect(card).not.toBe(background);
    expect(colors.tileButton).not.toBe(colors.sidebar);
  });

  test("Close the sidebar", async function closesSidebar({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    const china = markerButton(frame, "China");
    await china.click();

    await sidebar(frame).getByRole("button", { name: "Close" }).click();

    await expect(sidebar(frame)).toBeHidden();
    await expect(china).toHaveAttribute("aria-expanded", "false");
    await expect(china).toBeFocused();
  });

  test("Phone width", async function stacksSidebarBelowMap({
    page,
  }): Promise<void> {
    const frame = await routeAndOpenSample(page);
    await sizeModFrame(page, MOD_TITLE, PHONE_FRAME_WIDTH);

    await selectWithKeyboard(frame, "France");

    const map = await frame.locator(".leaflet-container").evaluate(readBox);
    const aside = await sidebar(frame).evaluate(readBox);
    const widths = await frame.evaluate(readMapWidth);
    expect(aside.top).toBeGreaterThanOrEqual(map.bottom - 1);
    expect(aside.width).toBe(widths.frame);
    expect(map.width).toBe(widths.frame);
    expect(map.height).toBeGreaterThan(0);
    expect(map.top).toBeGreaterThanOrEqual(0);
  });
});

test.describe(
  "Tile card",
  { tag: "@sample" },
  function describeTileCard(): void {
    // "Load media linked by tiles" is off, so only the default mosaic's
    // permission allows the image.
    test("Linked image", async function showsLinkedImage({
      page,
    }): Promise<void> {
      await page.addInitScript(turnOffTileLinkedMedia);
      await routeSampleHosts(page);
      const frame = await openSample(page);

      const card = await openSiteCard(frame);
      const image = card.locator("figure > img");

      await expect(image).toHaveAttribute(
        "src",
        new RegExp(`^${escapeRegExp(SITE_IMAGE_HOST)}/`),
      );
      await expect
        .poll(image.evaluate.bind(image, readNaturalWidth))
        .toBeGreaterThan(0);
      const imageBox = await image.evaluate(readBox);
      const headingBox = await card
        .getByRole("heading", { level: 2 })
        .evaluate(readBox);
      expect(imageBox.bottom).toBeLessThanOrEqual(headingBox.top);
      await expectNoIssues(page);
    });

    test("Without the default mosaic", async function blocksLinkedImage({
      page,
    }): Promise<void> {
      await page.addInitScript(turnOffTileLinkedMedia);
      await routeNpmFiles(page, buildProbeRouteOptions([]));
      const imageUrls = await routeCovers(page);
      const frame = await openSample(page, COUNTRY_MAP_COLLECTION_RUN_HASH);

      await openSiteCard(frame);

      const warnings = await openMessages(page, "Warnings");
      await expect(warnings).toContainText(
        `Blocked image request to ${SITE_IMAGE_HOST}`,
      );
      expect(imageUrls).toEqual([]);
    });

    test("Open a tile", async function opensTileCard({ page }): Promise<void> {
      const frame = await routeAndOpenSample(page);

      const card = await openSiteCard(frame);

      await expect(card.getByRole("heading", { level: 2 })).toHaveText(
        CARD_TITLE,
      );
      await expect(card).toContainText(
        "Machu Picchu is a 15th-century Inca citadel",
      );
    });

    test("A link in the body", async function opensBodyLink({
      page,
    }): Promise<void> {
      const frame = await routeAndOpenSample(page);
      await markFrame(frame);
      const card = await openSiteCard(frame);

      await card.getByRole("link", { name: CARD_LINK }).click();

      await expect(actionDialog(page)).toContainText(CARD_LINK);
      await actionDialog(page).getByRole("button", { name: "Cancel" }).click();
      expect(await isFrameMarked(frame)).toBe(true);
    });

    test("Escape", async function closesWithEscape({ page }): Promise<void> {
      const frame = await routeAndOpenSample(page);
      await openSiteCard(frame);

      await page.keyboard.press("Escape");

      await expect(tileCard(frame)).toBeHidden();
      await expect(sidebar(frame).getByRole("heading")).toHaveText(
        CARD_COUNTRY,
      );
      await expect(tileButton(frame, CARD_TITLE)).toBeFocused();
    });

    test("Backdrop", async function closesOnBackdrop({ page }): Promise<void> {
      const frame = await routeAndOpenSample(page);
      const card = await openSiteCard(frame);
      const box = await card.boundingBox();
      if (box === null) {
        throw new Error("Expected the card to have a box");
      }

      await card.click({ position: { x: box.width / 2, y: 4 } });
      await expect(tileCard(frame)).toBeVisible();
      await page.mouse.click(box.x - 8, box.y + 8);

      await expect(tileCard(frame)).toBeHidden();
    });
  },
);

test.describe(
  "Map follows tile changes",
  { tag: "@sample" },
  function describeFollowsTiles(): void {
    test("Tile added", async function showsAddedTile({ page }): Promise<void> {
      await routeSampleHosts(page);
      const changed = await routeAddedTiles(page, [EXTRA_CHINESE_SITE]);
      const frame = await openSample(page);
      await markFrame(frame);
      await selectWithKeyboard(frame, "China");

      changed.isOn = true;
      await reloadTiles(page);

      await expect(markerButton(frame, "China")).toHaveText("3");
      await expect(sidebar(frame)).toContainText("3 tiles");
      await expect(tileButton(frame, EXTRA_CHINESE_SITE.title)).toBeVisible();
      await expect(markerButton(frame, "China")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(await isFrameMarked(frame)).toBe(true);
    });

    test("Country emptied", async function deselectsEmptiedCountry({
      page,
    }): Promise<void> {
      expect(readSampleCollectionText()).toContain(CARD_COLLECTION_LINE);
      await routeSampleHosts(page);
      const changed = await routeChangedCollection(
        page,
        removeCollectionLine.bind(undefined, CARD_COLLECTION_LINE),
      );
      const frame = await openSample(page);
      await selectWithKeyboard(frame, CARD_COUNTRY);

      changed.isOn = true;
      await reloadTiles(page);

      await expect(sidebar(frame)).toBeHidden();
      await expect(markerButton(frame, CARD_COUNTRY)).toHaveCount(0);
      await expect(markerButton(frame, "France")).toBeVisible();
    });

    test("Open card refreshed", async function refreshesOpenCard({
      page,
    }): Promise<void> {
      await routeSampleHosts(page);
      const changed: RouteSwitch = { isOn: false };
      await page.route(
        CARD_TILE_GLOB,
        answerChangedSite.bind(undefined, changed),
      );
      const frame = await openSample(page);
      const card = await openSiteCard(frame);
      await expect(card).not.toContainText("inscribed");

      changed.isOn = true;
      await reloadTiles(page);

      await expect(card).toContainText("inscribed");
      await expect(card).toContainText("1983");
      await expect(card).toBeVisible();
    });

    test("Open card closed", async function closesCardOfRemovedTile({
      page,
    }): Promise<void> {
      expect(readSampleCollectionText()).toContain(GREAT_WALL_COLLECTION_LINE);
      await routeSampleHosts(page);
      const changed = await routeChangedCollection(
        page,
        removeCollectionLine.bind(undefined, GREAT_WALL_COLLECTION_LINE),
      );
      const frame = await openSample(page);
      await selectWithKeyboard(frame, "China");
      await tileButton(frame, CHINESE_TITLES[0]).click();
      await expect(tileCard(frame)).toBeVisible();

      changed.isOn = true;
      await reloadTiles(page);

      await expect(tileCard(frame)).toBeHidden();
      await expect(sidebar(frame)).toContainText("1 tile");
      await expect(tileButton(frame, CHINESE_TITLES[0])).toHaveCount(0);
    });
  },
);

test.describe(
  "The sample in the app",
  { tag: "@sample" },
  function describeSampleInApp(): void {
    test("Sample matches the app's API", async function startsWithoutAsking({
      page,
    }): Promise<void> {
      await routeAndOpenSample(page);

      await expect(stageBar(page)).toContainText(MOD_TITLE);
      await expectNoIssues(page);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("Check mod passes", async function checksSample({
      page,
    }): Promise<void> {
      // The check runs every case of test.js, each in a fresh frame.
      test.setTimeout(180000);
      await routeSampleHosts(page);
      await page.goto(
        `/#/run?mod=mod_viewer&target=${COUNTRY_MAP_MOD_REFERENCE}`,
      );
      const viewer = await findModFrame(page, "Mod Viewer");
      await expect(
        viewer.getByRole("heading", { level: 1, name: /Country Map/ }),
      ).toBeVisible();

      await viewer.getByRole("button", { name: "Check mod" }).click();

      const report = viewer.getByRole("region", { name: "Check report" });
      await expect(report.getByRole("heading")).toContainText("Check passed", {
        timeout: 170000,
      });
      await expect(report.getByText("No findings.")).toBeVisible();
    });
  },
);
