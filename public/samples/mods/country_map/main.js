/**
 * Sample mod: shows the tiles it receives on a world map, with one marker per
 * country holding its number of tiles, a sidebar with a country's tiles and a
 * card with each tile's metadata and body. Tiles whose country the map cannot
 * place are listed under "Not on the map".
 *
 * It is also the example of a mod that uses declared libraries: its
 * mod_conf.yaml declares Leaflet, topojson-client, proj4 and the world's
 * countries from world-atlas, and `libs.load` installs them in the frame, so
 * this file holds only the mod's own logic and ships no third-party code.
 * proj4 projects the countries in Equal Earth, an equal-area projection, and
 * Leaflet draws them on its flat `L.CRS.Simple`. The map has no tile server:
 * the countries are shapes styled from the theme's tokens, so the map
 * follows the color scheme and sends no request of its own. See "Declared
 * libraries" in docs/mod_plugin_spec.md.
 */

const LOADING_TEXT = "Loading the map…";
const FAILED_TEXT = "The map could not be loaded.";
const EMPTY_TEXT = "There are no tiles to show.";
const UNPLACED_NAME = "Not on the map";

/** The group key of the tiles the map cannot place. Country groups use the map's name. */
const UNPLACED_KEY = "unplaced";

const SIDEBAR_TITLE_ID = "country-sidebar-title";
const CARD_TITLE_ID = "country-card-title";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const LEAFLET_LINK = '<a href="https://leafletjs.com">Leaflet</a>';
const NATURAL_EARTH_LINK =
  '<a href="https://www.naturalearthdata.com">Natural Earth</a>';

/** Equal Earth (EPSG:8857), as proj4 defines it. */
const EQUAL_EARTH =
  "+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";

/** Half the world's width in map units: at zoom 0, the world is 512 pixels wide. */
const WORLD_HALF_WIDTH = 256;

/** How far past the world the map can be panned, in map units. */
const WORLD_MARGIN = 8;

/** Zoom -1 fits the world in a narrow frame; zoom 5 shows a small country. */
const MIN_ZOOM = -1;
const MAX_ZOOM = 5;
const ZOOM_SNAP = 0.5;

/** How close the marker point is to the best one, in map units (about 3 km). */
const MARKER_POINT_PRECISION = 0.05;

/** The first view's padding, room for the markers' boxes above their tips. */
const MARKER_VIEW_PADDING_TOP_LEFT = [24, 44];
const MARKER_VIEW_PADDING_BOTTOM_RIGHT = [24, 24];
const MARKER_VIEW_MAX_ZOOM = 4;

/** The marker: a box with rounded corners and a pin centered under it, whose tip is the marker's point. */
const MARKER_BOX_HEIGHT = 22;
const MARKER_PIN_HEIGHT = 8;
const MARKER_PIN_HALF_WIDTH = 5;
const MARKER_CORNER_RADIUS = 5;
const MARKER_HEIGHT = MARKER_BOX_HEIGHT + MARKER_PIN_HEIGHT;
/** The box's width: room on both sides of the number, and 8 pixels per digit, so more digits make a wider box. */
const MARKER_SIDE_WIDTH = 20;
const MARKER_DIGIT_WIDTH = 8;

/** Raised markers: a selected one above the others, and one under the pointer or focused above all. */
const SELECTED_Z_OFFSET = 1000;
const RAISED_Z_OFFSET = 2000;

/**
 * Common names of the map countries whose `countries-110m.json` name is
 * short or formal, by map name. A name matches when it is equal to the map
 * name or to one of these, once normalized (see `normalizeCountryName`).
 */
const COUNTRY_ALIASES = {
  "Bosnia and Herz.": ["Bosnia and Herzegovina", "Bosnia"],
  "Central African Rep.": ["Central African Republic"],
  Congo: ["Republic of the Congo", "Republic of Congo", "Congo-Brazzaville"],
  "Côte d'Ivoire": ["Ivory Coast"],
  Czechia: ["Czech Republic"],
  "Dem. Rep. Congo": [
    "Democratic Republic of the Congo",
    "Democratic Republic of Congo",
    "DR Congo",
    "DRC",
    "Congo-Kinshasa",
  ],
  "Dominican Rep.": ["Dominican Republic"],
  "Eq. Guinea": ["Equatorial Guinea"],
  eSwatini: ["Swaziland"],
  "Falkland Is.": ["Falkland Islands"],
  "Fr. S. Antarctic Lands": [
    "French Southern and Antarctic Lands",
    "French Southern Territories",
  ],
  Bahamas: ["The Bahamas"],
  Gambia: ["The Gambia"],
  Macedonia: ["North Macedonia"],
  "N. Cyprus": ["Northern Cyprus"],
  Russia: ["Russian Federation"],
  "S. Sudan": ["South Sudan"],
  "Solomon Is.": ["Solomon Islands"],
  "Timor-Leste": ["East Timor"],
  Turkey: ["Türkiye"],
  "United Kingdom": ["UK", "Great Britain"],
  "United States of America": ["United States", "USA", "US", "U.S.", "U.S.A."],
  Vietnam: ["Viet Nam"],
  "W. Sahara": ["Western Sahara"],
};

/** Combining marks, which `normalize("NFD")` splits from the letters they accent. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const CURLY_APOSTROPHES = /[\u2018\u2019]/g;
const SPACES = /\s+/g;

/** The metadata keys the card shows elsewhere: as its heading and its image. */
const CARD_HEADER_KEYS = ["title", "image"];

// Layout, the map's colors and the markers, from the theme's tokens: the
// fonts, buttons, lists and dialog come from the base stylesheet.
const COUNTRY_MAP_STYLE = `
  body {
    max-width: none;
    height: 100%;
    margin: 0;
    padding: 0;
    container-type: inline-size;
  }
  main > p[role="status"] { margin: var(--tes-space-4); }

  /* The map, and the sidebar on its right when a country is selected. */
  main[data-sidebar] {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    height: 100vh;
  }
  main[data-sidebar="open"] { grid-template-columns: minmax(0, 1fr) 20rem; }
  main > div { min-width: 0; min-height: 0; }

  /* Leaflet's container, the sea, and its controls, in the theme's colors. */
  .leaflet-container {
    background-color: color-mix(in oklab, var(--tes-muted-foreground) 14%, var(--tes-card));
    font-family: var(--tes-font-sans);
  }
  .leaflet-container .leaflet-bar { border-color: var(--tes-border); }
  .leaflet-container .leaflet-bar a {
    border-bottom-color: var(--tes-border);
    background-color: var(--tes-background);
    color: var(--tes-foreground);
  }
  .leaflet-container .leaflet-bar a:hover,
  .leaflet-container .leaflet-bar a:focus { background-color: var(--tes-muted); }
  .leaflet-container .leaflet-bar a.leaflet-disabled {
    background-color: var(--tes-muted);
    color: var(--tes-muted-foreground);
  }
  .leaflet-container .leaflet-control-attribution {
    background-color: var(--tes-background);
    color: var(--tes-muted-foreground);
  }
  .leaflet-container .leaflet-control-attribution a { color: var(--tes-foreground); }
  .leaflet-container p[role="status"] {
    margin: 0;
    padding: var(--tes-space-2) var(--tes-space-3);
    border: 1px solid var(--tes-border);
    border-radius: var(--tes-radius);
    background-color: var(--tes-background);
    color: var(--tes-foreground);
    font-size: 0.875rem;
  }

  /*
   * The countries, filled and outlined from the theme, so a color scheme
   * change needs no redraw: muted without tiles, in the markers' hue with
   * tiles, and the accent while selected. Only a country with tiles shows
   * the pointer; the others keep the map's grab cursor.
   */
  path.country {
    fill: var(--tes-muted);
    fill-opacity: 1;
    stroke: var(--tes-border);
    stroke-width: 1;
    cursor: inherit;
  }
  path.country.has-tiles {
    fill: color-mix(in oklab, var(--tes-primary) 28%, var(--tes-card));
    cursor: pointer;
  }
  path.country.selected { fill: var(--tes-accent); }

  /* The markers: speech bubbles holding their country's number of tiles. */
  .country-marker { cursor: pointer; }
  .country-marker > svg { display: block; overflow: visible; }
  .country-marker path { fill: var(--tes-primary); stroke: var(--tes-background); stroke-width: 1; }
  .country-marker text {
    fill: var(--tes-primary-foreground);
    font-family: var(--tes-font-sans);
    font-size: 13px;
    font-weight: 600;
  }

  /* The sidebar: the country's heading, its count and its tiles. */
  aside {
    overflow-y: auto;
    padding: var(--tes-space-4);
    border-left: 1px solid var(--tes-border);
    background-color: var(--tes-card);
    color: var(--tes-card-foreground);
  }
  aside > header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--tes-space-2); }
  aside > header > h2 { margin: 0; overflow-wrap: anywhere; }
  aside > ul { display: grid; gap: var(--tes-space-2); padding: 0; list-style: none; }
  aside > ul > li > button {
    width: 100%;
    justify-content: flex-start;
    text-align: left;
    background-color: color-mix(in oklab, var(--tes-primary) 8%, var(--tes-card));
  }
  aside > ul > li > button:hover:not(:disabled) {
    background-color: color-mix(in oklab, var(--tes-primary) 16%, var(--tes-card));
  }
  button[data-tes-variant="ghost"][aria-label="Close"] { padding: var(--tes-space-2); }
  button[data-tes-variant="ghost"][aria-label="Close"] > svg { display: block; }

  /* Below 40rem, the sidebar goes under the map, across the frame. */
  @container (max-width: 40rem) {
    main[data-sidebar],
    main[data-sidebar="open"] { grid-template-columns: minmax(0, 1fr); height: auto; }
    main > div { height: 60vh; }
    aside { border-top: 1px solid var(--tes-border); border-left-width: 0; }
  }

  /* The card: the close button in its corner, the image above the title. */
  dialog { box-sizing: border-box; width: min(40rem, 100%); }
  dialog > button[data-tes-variant="ghost"] { position: absolute; top: var(--tes-space-2); right: var(--tes-space-2); }
  dialog > figure { margin: 0 0 var(--tes-space-4); }
  dialog > figure > img { display: block; max-height: 16rem; margin: 0 auto; border-radius: var(--tes-radius); }
  dialog > h2 { padding-right: var(--tes-space-6); }
  dialog dl { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--tes-space-4); }
  dialog dd { margin: 0; overflow-wrap: anywhere; }
`;

// Country names

/** A name as the lookup compares it: trimmed, lower-cased, without accents, with straight apostrophes and single spaces. */
function normalizeCountryName(name) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(CURLY_APOSTROPHES, "'")
    .replace(SPACES, " ");
  return normalized;
}

function readAliases(mapName) {
  if (!Object.hasOwn(COUNTRY_ALIASES, mapName)) {
    const noAliases = [];
    return noAliases;
  }
  const aliases = COUNTRY_ALIASES[mapName];
  return aliases;
}

/** The map name of each normalized name: the map's own names and their aliases. */
function buildCountryLookup(mapNames) {
  const lookup = new Map();
  for (const mapName of mapNames) {
    lookup.set(normalizeCountryName(mapName), mapName);
    for (const alias of readAliases(mapName)) {
      lookup.set(normalizeCountryName(alias), mapName);
    }
  }
  return lookup;
}

/** The map name a tile belongs to, or `null` when its country is not on the map. */
function findMapName(lookup, tile) {
  const country = tile.metadata.country;
  if (typeof country !== "string") {
    return null;
  }
  const mapName = lookup.get(normalizeCountryName(country)) ?? null;
  return mapName;
}

function readShownName(tile) {
  const country = tile.metadata.country;
  if (typeof country !== "string" || country.trim() === "") {
    return UNPLACED_NAME;
  }
  const shownName = country.trim();
  return shownName;
}

function buildGroup(key, name) {
  const group = { key, name, tiles: [] };
  return group;
}

/** Adds the tile to the group of `key`, made with the tile's shown name when it is the group's first tile. */
function addToGroup(groups, key, tile) {
  if (!groups.has(key)) {
    groups.set(key, buildGroup(key, readShownName(tile)));
  }
  groups.get(key).tiles.push(tile);
}

function compareGroupNames(first, second) {
  return first.name.localeCompare(second.name);
}

/**
 * The tiles by country: `countries`, sorted by their shown names, and
 * `unplaced`, the group "Not on the map", or `null` when every tile is on the map.
 */
function groupTiles(lookup, tiles) {
  const countryGroups = new Map();
  let unplaced = null;
  for (const tile of tiles) {
    const mapName = findMapName(lookup, tile);
    if (mapName !== null) {
      addToGroup(countryGroups, mapName, tile);
      continue;
    }
    unplaced = unplaced ?? buildGroup(UNPLACED_KEY, UNPLACED_NAME);
    unplaced.tiles.push(tile);
  }
  const countries = Array.from(countryGroups.values());
  countries.sort(compareGroupNames);
  const grouping = { countries, unplaced };
  return grouping;
}

function findGroup(view, key) {
  if (key === UNPLACED_KEY) {
    return view.grouping.unplaced;
  }
  for (const group of view.grouping.countries) {
    if (group.key === key) {
      return group;
    }
  }
  return null;
}

function describeTileCount(count) {
  if (count === 1) {
    return "1 tile";
  }
  const tileCount = `${count} tiles`;
  return tileCount;
}

function describeGroup(group) {
  const description = `${group.name}, ${describeTileCount(group.tiles.length)}`;
  return description;
}

// Map shapes: Equal Earth in map units, through proj4

/**
 * The map's projection: Equal Earth, equal-area, so the countries far from
 * the equator keep their true size. proj4 projects to meters; the map draws
 * them in map units, the world 512 units wide.
 */
function buildProjection() {
  const converter = globalThis.proj4("EPSG:4326", EQUAL_EARTH);
  const metersPerUnit = converter.forward([180, 0])[0] / WORLD_HALF_WIDTH;
  const projection = { converter, metersPerUnit };
  return projection;
}

/** A longitude and latitude as `[x, y]` in map units. */
function projectPosition(projection, position) {
  const latitude = Math.max(-90, Math.min(90, position[1]));
  const meters = projection.converter.forward([position[0], latitude]);
  const point = [
    meters[0] / projection.metersPerUnit,
    meters[1] / projection.metersPerUnit,
  ];
  return point;
}

/** The world's box in map units: as wide as the equator and as tall as from pole to pole. */
function buildWorldBox(projection) {
  const top = projectPosition(projection, [0, 90])[1];
  const box = {
    west: -WORLD_HALF_WIDTH,
    east: WORLD_HALF_WIDTH,
    south: -top,
    north: top,
  };
  return box;
}

/** A box in map units as Leaflet's bounds on `L.CRS.Simple`, where a latitude is `y` and a longitude `x`. */
function buildMapBounds(box, margin) {
  const bounds = globalThis.L.latLngBounds(
    [box.south - margin, box.west - margin],
    [box.north + margin, box.east + margin],
  );
  return bounds;
}

/** How far a longitude jumped across the 180th meridian from the previous one: -360, 0 or 360. */
function readWrapShift(previousLongitude, longitude) {
  if (longitude - previousLongitude > 180) {
    return -360;
  }
  if (longitude - previousLongitude < -180) {
    return 360;
  }
  return 0;
}

function readLongitudeExtent(ring) {
  let west = Infinity;
  let east = -Infinity;
  for (const position of ring) {
    west = Math.min(west, position[0]);
    east = Math.max(east, position[0]);
  }
  const extent = { west, east };
  return extent;
}

function shiftRing(ring, shift) {
  const shifted = [];
  for (const position of ring) {
    shifted.push([position[0] + shift, position[1]]);
  }
  return shifted;
}

/**
 * The ring with no jump across the 180th meridian, such as Russia's from
 * Chukotka to the rest of Siberia: each longitude moves by 360 degrees where
 * it would jump. The ring is then moved by 360 degrees when its middle falls
 * outside -180 to 180, so at most one of its ends reaches past the meridian.
 */
function unwrapRing(ring) {
  const unwrapped = [];
  let shift = 0;
  let previousLongitude = null;
  for (const position of ring) {
    let longitude = position[0] + shift;
    if (previousLongitude !== null) {
      const wrapShift = readWrapShift(previousLongitude, longitude);
      shift += wrapShift;
      longitude += wrapShift;
    }
    unwrapped.push([longitude, position[1]]);
    previousLongitude = longitude;
  }
  const extent = readLongitudeExtent(unwrapped);
  const center = (extent.west + extent.east) / 2;
  const centered = shiftRing(unwrapped, -360 * Math.round(center / 360));
  return centered;
}

function isOnSide(position, meridian, keepsWest) {
  if (keepsWest) {
    return position[0] <= meridian;
  }
  return position[0] >= meridian;
}

/** Where the edge from `start` to `end` crosses the meridian. */
function crossMeridian(start, end, meridian) {
  const share = (meridian - start[0]) / (end[0] - start[0]);
  const crossing = [meridian, start[1] + share * (end[1] - start[1])];
  return crossing;
}

/** The part of the ring on one side of the meridian (Sutherland–Hodgman on one half-plane). */
function clipRing(ring, meridian, keepsWest) {
  const clipped = [];
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const previous = ring[(index + ring.length - 1) % ring.length];
    const isCurrentKept = isOnSide(current, meridian, keepsWest);
    if (isCurrentKept !== isOnSide(previous, meridian, keepsWest)) {
      clipped.push(crossMeridian(previous, current, meridian));
    }
    if (isCurrentKept) {
      clipped.push(current);
    }
  }
  return clipped;
}

/** The area of a ring by the shoelace formula. */
function measureRingArea(ring) {
  let doubleArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    doubleArea += current[0] * next[1] - next[0] * current[1];
  }
  const area = Math.abs(doubleArea) / 2;
  return area;
}

/** The polygon's part on one side of the meridian, moved by `shift` degrees, or `null` when that part has no area. */
function clipPolygon(polygon, meridian, keepsWest, shift) {
  const outerRing = clipRing(polygon[0], meridian, keepsWest);
  if (measureRingArea(outerRing) === 0) {
    return null;
  }
  const rings = [shiftRing(outerRing, shift)];
  for (const hole of polygon.slice(1)) {
    const clipped = clipRing(hole, meridian, keepsWest);
    if (measureRingArea(clipped) > 0) {
      rings.push(shiftRing(clipped, shift));
    }
  }
  return rings;
}

/**
 * The polygon split at the meridian it reaches past, 180 or -180 degrees:
 * the part inside the world as it is, and the part beyond moved back by 360
 * degrees, so it is drawn on the other edge of the map.
 */
function splitPolygonAtMeridian(polygon) {
  const extent = readLongitudeExtent(polygon[0]);
  if (extent.east <= 180 && extent.west >= -180) {
    const whole = [polygon];
    return whole;
  }
  const meridian = extent.east > 180 ? 180 : -180;
  const keepsWest = meridian > 0;
  const parts = [];
  const inside = clipPolygon(polygon, meridian, keepsWest, 0);
  const beyond = clipPolygon(
    polygon,
    meridian,
    !keepsWest,
    keepsWest ? -360 : 360,
  );
  for (const part of [inside, beyond]) {
    if (part !== null) {
      parts.push(part);
    }
  }
  return parts;
}

/** The polygons of a Polygon or MultiPolygon, each a list of rings with the outer ring first. */
function readPolygons(geometry) {
  if (geometry === null) {
    const noPolygons = [];
    return noPolygons;
  }
  if (geometry.type === "Polygon") {
    const polygons = [geometry.coordinates];
    return polygons;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }
  const noPolygons = [];
  return noPolygons;
}

function unwrapPolygon(polygon) {
  const rings = [];
  for (const ring of polygon) {
    rings.push(unwrapRing(ring));
  }
  return rings;
}

function projectPolygon(projection, polygon) {
  const rings = [];
  for (const ring of polygon) {
    const projectedRing = [];
    for (const position of ring) {
      projectedRing.push(projectPosition(projection, position));
    }
    rings.push(projectedRing);
  }
  return rings;
}

/** A country's geometry as a MultiPolygon in map units, split at the 180th meridian. */
function projectGeometry(projection, geometry) {
  const polygons = [];
  for (const polygon of readPolygons(geometry)) {
    for (const part of splitPolygonAtMeridian(unwrapPolygon(polygon))) {
      polygons.push(projectPolygon(projection, part));
    }
  }
  const projected = { type: "MultiPolygon", coordinates: polygons };
  return projected;
}

/** The map's countries as GeoJSON in map units. */
function readCountryFeatures(topology, projection) {
  const collection = globalThis.topojson.feature(
    topology,
    topology.objects.countries,
  );
  const features = [];
  for (const feature of collection.features) {
    features.push({
      type: "Feature",
      properties: feature.properties,
      geometry: projectGeometry(projection, feature.geometry),
    });
  }
  const countries = { type: "FeatureCollection", features };
  return countries;
}

// Marker point: the pole of inaccessibility of the largest piece of land

/** The polygon whose outer ring has the largest area, or `null` for a country without one. */
function findLargestPolygon(geometry) {
  let largest = null;
  let largestArea = -1;
  for (const polygon of geometry.coordinates) {
    const area = measureRingArea(polygon[0]);
    if (area > largestArea) {
      largest = polygon;
      largestArea = area;
    }
  }
  return largest;
}

/** The squared distance from a point to a segment. */
function measureSquaredDistanceToSegment(x, y, start, end) {
  let closestX = start[0];
  let closestY = start[1];
  const segmentX = end[0] - closestX;
  const segmentY = end[1] - closestY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared > 0) {
    const share =
      ((x - closestX) * segmentX + (y - closestY) * segmentY) / lengthSquared;
    const clampedShare = Math.max(0, Math.min(1, share));
    closestX += segmentX * clampedShare;
    closestY += segmentY * clampedShare;
  }
  const squaredDistance = (x - closestX) ** 2 + (y - closestY) ** 2;
  return squaredDistance;
}

/** Whether a ray from the point to the east crosses the segment, for the even-odd rule. */
function crossesSegment(x, y, start, end) {
  if (start[1] > y === end[1] > y) {
    return false;
  }
  const crossingX =
    ((end[0] - start[0]) * (y - start[1])) / (end[1] - start[1]) + start[0];
  return x < crossingX;
}

/**
 * The distance from a point to the polygon's edges, holes included:
 * positive inside the polygon, negative outside it or in a hole.
 */
function measureSignedDistance(x, y, polygon) {
  let isInside = false;
  let squaredDistance = Infinity;
  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 1) {
      const start = ring[index];
      const end = ring[(index + 1) % ring.length];
      isInside = isInside !== crossesSegment(x, y, start, end);
      squaredDistance = Math.min(
        squaredDistance,
        measureSquaredDistanceToSegment(x, y, start, end),
      );
    }
  }
  const distance = Math.sqrt(squaredDistance);
  if (isInside) {
    return distance;
  }
  return -distance;
}

/** A square cell of the search: its center, its half size, its center's distance and the best distance a point inside it can have. */
function buildCell(x, y, half, polygon) {
  const distance = measureSignedDistance(x, y, polygon);
  const cell = {
    x,
    y,
    half,
    distance,
    potential: distance + half * Math.SQRT2,
  };
  return cell;
}

/** The ring's centroid, the search's first guess, or its first point for a ring with no area. */
function buildCentroidCell(polygon) {
  const ring = polygon[0];
  let doubleArea = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const cross = current[0] * next[1] - next[0] * current[1];
    doubleArea += cross;
    sumX += (current[0] + next[0]) * cross;
    sumY += (current[1] + next[1]) * cross;
  }
  if (doubleArea === 0) {
    const firstCell = buildCell(ring[0][0], ring[0][1], 0, polygon);
    return firstCell;
  }
  const centroidCell = buildCell(
    sumX / (3 * doubleArea),
    sumY / (3 * doubleArea),
    0,
    polygon,
  );
  return centroidCell;
}

function readRingBounds(ring) {
  const bounds = {
    west: Infinity,
    east: -Infinity,
    south: Infinity,
    north: -Infinity,
  };
  for (const position of ring) {
    bounds.west = Math.min(bounds.west, position[0]);
    bounds.east = Math.max(bounds.east, position[0]);
    bounds.south = Math.min(bounds.south, position[1]);
    bounds.north = Math.max(bounds.north, position[1]);
  }
  return bounds;
}

/** Adds the cell to the cells sorted by potential, lowest first, so the most promising one is last. */
function insertCell(cells, cell) {
  let low = 0;
  let high = cells.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (cells[middle].potential < cell.potential) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  cells.splice(low, 0, cell);
}

/** The cells that cover the polygon's bounds, each `2 * half` wide. */
function buildCoveringCells(polygon, bounds, half) {
  const cells = [];
  for (let x = bounds.west; x < bounds.east; x += 2 * half) {
    for (let y = bounds.south; y < bounds.north; y += 2 * half) {
      insertCell(cells, buildCell(x + half, y + half, half, polygon));
    }
  }
  return cells;
}

function splitCell(cells, cell, polygon) {
  const half = cell.half / 2;
  insertCell(cells, buildCell(cell.x - half, cell.y - half, half, polygon));
  insertCell(cells, buildCell(cell.x + half, cell.y - half, half, polygon));
  insertCell(cells, buildCell(cell.x - half, cell.y + half, half, polygon));
  insertCell(cells, buildCell(cell.x + half, cell.y + half, half, polygon));
}

/**
 * The pole of inaccessibility of a polygon: the point inside it farthest
 * from its edges, holes included, within `MARKER_POINT_PRECISION` map units.
 * This is the polylabel algorithm: cells cover the polygon, and a cell is
 * split while a point inside it could beat the best point found so far.
 */
function findPoleOfInaccessibility(polygon) {
  const bounds = readRingBounds(polygon[0]);
  const size = Math.min(bounds.east - bounds.west, bounds.north - bounds.south);
  let best = buildCentroidCell(polygon);
  if (size === 0) {
    return best;
  }
  const cells = buildCoveringCells(polygon, bounds, size / 2);
  while (cells.length > 0) {
    const cell = cells.pop();
    if (cell.distance > best.distance) {
      best = cell;
    }
    if (cell.potential - best.distance > MARKER_POINT_PRECISION) {
      splitCell(cells, cell, polygon);
    }
  }
  return best;
}

/** The marker's point, as a Leaflet position in map units, or `null` for a country without land. */
function findMarkerPoint(geometry) {
  const polygon = findLargestPolygon(geometry);
  if (polygon === null) {
    return null;
  }
  const pole = findPoleOfInaccessibility(polygon);
  const point = globalThis.L.latLng(pole.y, pole.x);
  return point;
}

/** The country's marker point, found the first time the country gets a marker. */
function readMarkerPoint(view, mapName) {
  const country = view.mapCountries.get(mapName);
  if (country.point === undefined) {
    country.point = findMarkerPoint(country.layer.feature.geometry);
  }
  return country.point;
}

function styleCountry() {
  const style = { className: "country", weight: 1, fillOpacity: 1 };
  return style;
}

/** Each map country by its map name: its Leaflet layer, and its marker point once found. */
function readMapCountries(countryLayer) {
  const countries = new Map();
  for (const layer of countryLayer.getLayers()) {
    countries.set(layer.feature.properties.name, { layer, point: undefined });
  }
  return countries;
}

// Markers

function readMarkerWidth(count) {
  const digits = String(count).length;
  const width = MARKER_SIDE_WIDTH + MARKER_DIGIT_WIDTH * digits;
  return width;
}

/** The speech bubble's outline: a box with rounded corners, then the pin at the middle of its bottom edge. */
function buildMarkerOutline(width) {
  const radius = MARKER_CORNER_RADIUS;
  const middle = width / 2;
  const bottom = MARKER_BOX_HEIGHT;
  const outline = [
    `M ${radius} 0`,
    `H ${width - radius}`,
    `Q ${width} 0 ${width} ${radius}`,
    `V ${bottom - radius}`,
    `Q ${width} ${bottom} ${width - radius} ${bottom}`,
    `H ${middle + MARKER_PIN_HALF_WIDTH}`,
    `L ${middle} ${MARKER_HEIGHT}`,
    `L ${middle - MARKER_PIN_HALF_WIDTH} ${bottom}`,
    `H ${radius}`,
    `Q 0 ${bottom} 0 ${bottom - radius}`,
    `V ${radius}`,
    `Q 0 0 ${radius} 0`,
    "Z",
  ].join(" ");
  return outline;
}

/** The marker's SVG, with only numbers in it, as the HTML of a Leaflet `divIcon`. */
function buildMarkerHtml(count) {
  const width = readMarkerWidth(count);
  const html = [
    `<svg xmlns="${SVG_NAMESPACE}" width="${width}" height="${MARKER_HEIGHT}" viewBox="0 0 ${width} ${MARKER_HEIGHT}" aria-hidden="true">`,
    `<path d="${buildMarkerOutline(width)}"/>`,
    `<text x="${width / 2}" y="${MARKER_BOX_HEIGHT / 2}" text-anchor="middle" dominant-baseline="central">${count}</text>`,
    "</svg>",
  ].join("");
  return html;
}

function buildMarkerIcon(count) {
  const width = readMarkerWidth(count);
  const icon = globalThis.L.divIcon({
    className: "country-marker",
    html: buildMarkerHtml(count),
    iconSize: [width, MARKER_HEIGHT],
    iconAnchor: [width / 2, MARKER_HEIGHT],
  });
  return icon;
}

function isSelected(view, key) {
  return view.selectedKey === key;
}

/** The marker's z offset: raised while under the pointer or focused, and above the others while selected. */
function readMarkerZOffset(view, key, isRaised) {
  if (isRaised) {
    return RAISED_Z_OFFSET;
  }
  if (isSelected(view, key)) {
    return SELECTED_Z_OFFSET;
  }
  return 0;
}

function raiseMarker(view, key) {
  view.markers.get(key)?.setZIndexOffset(readMarkerZOffset(view, key, true));
}

function lowerMarker(view, key) {
  view.markers.get(key)?.setZIndexOffset(readMarkerZOffset(view, key, false));
}

function isActivationKey(event) {
  return event.key === "Enter" || event.key === " ";
}

/** Enter and Space on a focused marker select its country, as a click does. */
function selectOnActivationKey(view, key, event) {
  if (!isActivationKey(event)) {
    return;
  }
  event.preventDefault();
  selectGroup(view, key);
}

/** Gives the marker's element, a focusable `role="button"` from Leaflet, its name, state and handlers. */
function describeMarkerElement(view, group, element) {
  element.dataset.key = group.key;
  element.setAttribute("aria-label", describeGroup(group));
  element.setAttribute("aria-expanded", String(isSelected(view, group.key)));
  element.addEventListener(
    "focus",
    raiseMarker.bind(undefined, view, group.key),
  );
  element.addEventListener(
    "blur",
    lowerMarker.bind(undefined, view, group.key),
  );
  element.addEventListener(
    "keydown",
    selectOnActivationKey.bind(undefined, view, group.key),
  );
}

function buildMarker(view, group, point) {
  const marker = globalThis.L.marker(point, {
    icon: buildMarkerIcon(group.tiles.length),
    keyboard: true,
    zIndexOffset: readMarkerZOffset(view, group.key, false),
  });
  marker.on("click", selectGroup.bind(undefined, view, group.key));
  marker.on("mouseover", raiseMarker.bind(undefined, view, group.key));
  marker.on("mouseout", lowerMarker.bind(undefined, view, group.key));
  return marker;
}

function removeMarkers(view) {
  for (const marker of view.markers.values()) {
    marker.remove();
  }
  view.markers.clear();
}

/** Draws one marker per country with tiles, in the order of their names, which is their Tab order. */
function drawMarkers(view) {
  removeMarkers(view);
  for (const group of view.grouping.countries) {
    const point = readMarkerPoint(view, group.key);
    if (point === null) {
      continue;
    }
    const marker = buildMarker(view, group, point);
    marker.addTo(view.map);
    describeMarkerElement(view, group, marker.getElement());
    view.markers.set(group.key, marker);
  }
}

// Map controls

function readControlElement(element) {
  return element;
}

/** A Leaflet control in a corner of the map that shows `element`, which clicks and scrolls do not pass through. */
function buildMapControl(element, position) {
  globalThis.L.DomEvent.disableClickPropagation(element);
  globalThis.L.DomEvent.disableScrollPropagation(element);
  const control = globalThis.L.control({ position });
  control.onAdd = readControlElement.bind(undefined, element);
  return control;
}

/** Shows the control on the map when `isShown`, and takes it off otherwise. */
function showControl(view, control, isShown) {
  const isOnMap = control.getContainer()?.isConnected === true;
  if (isShown && !isOnMap) {
    control.addTo(view.map);
  }
  if (!isShown && isOnMap) {
    control.remove();
  }
}

function buildUnplacedButton(view) {
  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener(
    "click",
    selectGroup.bind(undefined, view, UNPLACED_KEY),
  );
  return button;
}

/** The "Not on the map" button, with its number of tiles, shown only when some tiles are not on the map. */
function updateUnplacedControl(view) {
  const unplaced = view.grouping.unplaced;
  showControl(view, view.unplacedControl, unplaced !== null);
  if (unplaced === null) {
    return;
  }
  const button = view.unplacedButton;
  button.textContent = describeGroup(unplaced);
  button.setAttribute("aria-expanded", String(isSelected(view, UNPLACED_KEY)));
}

function buildEmptyStatus() {
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = EMPTY_TEXT;
  return status;
}

function updateEmptyControl(view) {
  showControl(view, view.emptyControl, view.tiles.length === 0);
}

/**
 * An attribution link opens through `links.open`: the frame cannot navigate,
 * and a navigation would stop the mod. It runs in the capture phase, before
 * Leaflet's own handlers.
 */
async function openAttributionLink(view, event) {
  const link = event.target.closest(".leaflet-control-attribution a[href]");
  if (link === null) {
    return;
  }
  event.preventDefault();
  await view.engine.request("links.open", { url: link.getAttribute("href") });
}

// Map

/** The map on Leaflet's flat CRS, in the map units the countries are projected to, kept around the world. */
function buildMap(view, container) {
  const map = globalThis.L.map(container, {
    crs: globalThis.L.CRS.Simple,
    attributionControl: true,
    zoomControl: true,
    maxBounds: buildMapBounds(view.worldBox, WORLD_MARGIN),
    maxBoundsViscosity: 1,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: ZOOM_SNAP,
  });
  map.attributionControl.setPrefix(LEAFLET_LINK);
  container.addEventListener(
    "click",
    openAttributionLink.bind(undefined, view),
    true,
  );
  return map;
}

/** A click on a country with tiles selects it, as its marker does; a country without tiles selects nothing. */
function selectClickedCountry(view, event) {
  const mapName = event.propagatedFrom.feature.properties.name;
  if (findGroup(view, mapName) !== null) {
    selectGroup(view, mapName);
  }
}

/** The countries' shapes, which a click selects (see `selectClickedCountry`). */
function buildCountryLayer(view, countries) {
  const countryLayer = globalThis.L.geoJSON(countries, {
    attribution: NATURAL_EARTH_LINK,
    style: styleCountry,
  });
  countryLayer.on("click", selectClickedCountry.bind(undefined, view));
  return countryLayer;
}

function hasSize(map) {
  const size = map.getSize();
  return size.x > 0 && size.y > 0;
}

function buildMarkerBounds(view) {
  const points = [];
  for (const marker of view.markers.values()) {
    points.push(marker.getLatLng());
  }
  const bounds = globalThis.L.latLngBounds(points);
  return bounds;
}

/** The first view, shown at once: every marker with room around it, or the whole world when there is none. */
function fitFirstView(view) {
  view.isFirstViewPending = !hasSize(view.map);
  if (view.markers.size === 0) {
    view.map.fitBounds(buildMapBounds(view.worldBox, 0), { animate: false });
    return;
  }
  view.map.fitBounds(buildMarkerBounds(view), {
    paddingTopLeft: MARKER_VIEW_PADDING_TOP_LEFT,
    paddingBottomRight: MARKER_VIEW_PADDING_BOTTOM_RIGHT,
    maxZoom: MARKER_VIEW_MAX_ZOOM,
    animate: false,
  });
}

/**
 * The map follows its container's size: the sidebar opening and closing,
 * the layout modes, and a hidden frame that gets its size late, where the
 * first view is fitted again.
 */
function followMapSize(view) {
  view.map.invalidateSize();
  if (view.isFirstViewPending && hasSize(view.map)) {
    fitFirstView(view);
  }
}

// Selection and sidebar

/** Each marker's `aria-expanded` and z offset, with a focused marker kept raised. */
function updateMarkerStates(view) {
  for (const [key, marker] of view.markers) {
    const element = marker.getElement();
    element.setAttribute("aria-expanded", String(isSelected(view, key)));
    const isFocused = element === document.activeElement;
    marker.setZIndexOffset(readMarkerZOffset(view, key, isFocused));
  }
}

/** Each country's shape: its map name in `data-country`, `has-tiles` for a country with tiles, and `selected` for the selected one. */
function updateCountryShapes(view) {
  for (const [name, country] of view.mapCountries) {
    const shape = country.layer.getElement();
    if (shape !== undefined) {
      shape.dataset.country = name;
      shape.classList.toggle("has-tiles", findGroup(view, name) !== null);
      shape.classList.toggle("selected", isSelected(view, name));
    }
  }
}

function showSelection(view) {
  updateMarkerStates(view);
  updateCountryShapes(view);
  updateUnplacedControl(view);
}

function buildCloseIcon() {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  const cross = document.createElementNS(SVG_NAMESPACE, "path");
  cross.setAttribute("d", "M18 6 6 18M6 6l12 12");
  icon.append(cross);
  return icon;
}

/** A ghost button with the Lucide `x` icon, named "Close". */
function buildCloseButton(close) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tesVariant = "ghost";
  button.setAttribute("aria-label", "Close");
  button.append(buildCloseIcon());
  button.addEventListener("click", close);
  return button;
}

function readTileTitle(tile) {
  const title = tile.metadata.title;
  if (typeof title !== "string") {
    return tile.source;
  }
  return title;
}

function buildTileButton(view, tile) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.source = tile.source;
  button.setAttribute("aria-haspopup", "dialog");
  button.textContent = readTileTitle(tile);
  button.addEventListener("click", openCard.bind(undefined, view, tile.source));
  return button;
}

function buildTileList(view, group) {
  const list = document.createElement("ul");
  for (const tile of group.tiles) {
    const item = document.createElement("li");
    item.append(buildTileButton(view, tile));
    list.append(item);
  }
  return list;
}

function buildSidebarHeader(view, group) {
  const header = document.createElement("header");
  const heading = document.createElement("h2");
  heading.id = SIDEBAR_TITLE_ID;
  heading.tabIndex = -1;
  heading.textContent = group.name;
  header.append(heading, buildCloseButton(closeSidebar.bind(undefined, view)));
  return header;
}

/** Fills the sidebar with the group: its heading, its number of tiles and a button per tile, in the tiles' order. */
function fillSidebar(view, group) {
  const count = document.createElement("p");
  count.textContent = describeTileCount(group.tiles.length);
  view.sidebar.replaceChildren(
    buildSidebarHeader(view, group),
    count,
    buildTileList(view, group),
  );
}

function showSidebar(view, isShown) {
  view.sidebar.hidden = !isShown;
  view.main.dataset.sidebar = isShown ? "open" : "closed";
}

/** Selects a country, or the tiles not on the map, and shows its tiles in the sidebar, whose heading gets the focus. */
function selectGroup(view, key) {
  const group = findGroup(view, key);
  if (group === null) {
    return;
  }
  view.selectedKey = key;
  fillSidebar(view, group);
  showSidebar(view, true);
  showSelection(view);
  view.sidebar.querySelector("h2").focus();
}

function deselectGroup(view) {
  view.selectedKey = null;
  view.sidebar.replaceChildren();
  showSidebar(view, false);
  showSelection(view);
}

/** The button that selected the group: its marker, or the "Not on the map" button. */
function findGroupOpener(view, key) {
  if (key === UNPLACED_KEY) {
    return view.unplacedButton;
  }
  const marker = view.markers.get(key);
  if (marker === undefined) {
    return null;
  }
  const element = marker.getElement();
  return element;
}

/** Closes the sidebar, deselects its group and moves the focus back to the group's marker or button. */
function closeSidebar(view) {
  const key = view.selectedKey;
  deselectGroup(view);
  findGroupOpener(view, key)?.focus();
}

// Card

function isScalar(value) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isScalarList(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const item of value) {
    if (!isScalar(item)) {
      return false;
    }
  }
  return true;
}

/** A value the card leaves out: `null`, an empty string or an empty list. */
function isEmptyValue(value) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** A value as the card writes it: a string, number or boolean as written, a list of those joined with `, `, anything else as JSON. */
function writeMetadataValue(value) {
  if (isScalar(value)) {
    return String(value);
  }
  if (isScalarList(value)) {
    const items = value.join(", ");
    return items;
  }
  const json = JSON.stringify(value);
  return json;
}

/** The card's labeled values: each metadata key but the title and the image, in the tile's order. */
function buildCardDetails(tile) {
  const details = document.createElement("dl");
  for (const [key, value] of Object.entries(tile.metadata)) {
    if (CARD_HEADER_KEYS.includes(key) || isEmptyValue(value)) {
      continue;
    }
    const term = document.createElement("dt");
    term.textContent = key;
    const description = document.createElement("dd");
    description.textContent = writeMetadataValue(value);
    details.append(term, description);
  }
  return details;
}

function removeCardImage(event) {
  event.currentTarget.parentElement.remove();
}

/** The tile's image, in a `<figure>` that is removed when the image fails to load. */
function buildCardImage(tile) {
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  image.alt = "";
  image.addEventListener("error", removeCardImage);
  image.src = tile.metadata.image;
  figure.append(image);
  return figure;
}

function hasBody(tile) {
  return typeof tile.body === "string" && tile.body.trim() !== "";
}

/** A click with no pointer (`detail` 0) is Enter or Space on the close button. */
function closeCard(view, event) {
  view.closedByKeyboard = event.detail === 0;
  view.card.close();
}

function noteKeyboardClose(view) {
  view.closedByKeyboard = true;
}

/** Fills the card from the tile: the close button, the image, the title, the metadata and the body. */
function fillCard(view, tile) {
  view.card.replaceChildren(buildCloseButton(closeCard.bind(undefined, view)));
  if (typeof tile.metadata.image === "string") {
    view.card.append(buildCardImage(tile));
  }
  const title = document.createElement("h2");
  title.id = CARD_TITLE_ID;
  title.textContent = readTileTitle(tile);
  view.card.append(title, buildCardDetails(tile));
  if (hasBody(tile)) {
    const body = document.createElement("tes-tile-body");
    body.tile = tile;
    view.card.append(document.createElement("hr"), body);
  }
}

function findTile(view, source) {
  for (const tile of view.tiles) {
    if (tile.source === source) {
      return tile;
    }
  }
  return null;
}

function openCard(view, source) {
  const tile = findTile(view, source);
  if (tile === null || view.card.open) {
    return;
  }
  fillCard(view, tile);
  view.card.showModal();
  view.openSource = source;
  view.closedByKeyboard = false;
}

function isOutsideCard(view, event) {
  const box = view.card.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/** A click on the backdrop targets the dialog itself, outside its box. */
function closeOnBackdropClick(view, event) {
  if (event.target === view.card && isOutsideCard(view, event)) {
    view.card.close();
  }
}

function findTileButton(view, source) {
  for (const button of view.sidebar.querySelectorAll("button[data-source]")) {
    if (button.dataset.source === source) {
      return button;
    }
  }
  return null;
}

/**
 * After the card closes, the tile's button in the sidebar gets the focus
 * back, with the focus ring only when the card was closed with the keyboard.
 * The browser may have given it the focus already, with its own choice of
 * ring, and `focus()` does nothing on a focused element: hence the `blur()`.
 */
function showClosedCard(view) {
  const button = findTileButton(view, view.openSource);
  view.openSource = null;
  if (button !== null) {
    button.blur();
    button.focus({ focusVisible: view.closedByKeyboard });
  }
}

function buildCard(view) {
  const card = document.createElement("dialog");
  card.setAttribute("aria-labelledby", CARD_TITLE_ID);
  card.addEventListener("click", closeOnBackdropClick.bind(undefined, view));
  card.addEventListener("cancel", noteKeyboardClose.bind(undefined, view));
  card.addEventListener("close", showClosedCard.bind(undefined, view));
  return card;
}

// Following the tiles

/** The selected group follows the tiles: shown with its new tiles, or deselected when it has none. */
function updateSelectedGroup(view) {
  if (view.selectedKey === null) {
    return;
  }
  const group = findGroup(view, view.selectedKey);
  if (group === null) {
    deselectGroup(view);
    return;
  }
  fillSidebar(view, group);
}

/** The open card follows its tile: filled from the new tile, or closed when the tile is gone. */
function updateOpenCard(view) {
  if (view.openSource === null) {
    return;
  }
  const tile = findTile(view, view.openSource);
  if (tile === null) {
    view.card.close();
    return;
  }
  fillCard(view, tile);
}

/** Draws the new tiles on the same map: its view and its countries stay. */
function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  view.grouping = groupTiles(view.lookup, view.tiles);
  drawMarkers(view);
  updateEmptyControl(view);
  updateSelectedGroup(view);
  showSelection(view);
  updateOpenCard(view);
}

// Loading

function buildStatus(text) {
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = text;
  return status;
}

/** Installs the four libraries, in order, since the map needs Leaflet before its data, and returns the parsed world. */
async function loadWorld(engine) {
  await engine.request("libs.load", { name: "leaflet" });
  await engine.request("libs.load", { name: "topojson_client" });
  await engine.request("libs.load", { name: "proj4" });
  const worldAtlas = await engine.request("libs.load", {
    name: "world_atlas",
  });
  const topology = JSON.parse(worldAtlas.files["countries-110m.json"]);
  return topology;
}

/** Draws the map, its countries, its controls and the markers in `<main>`, next to the closed sidebar. */
function drawMap(view, topology) {
  const container = document.createElement("div");
  view.sidebar.setAttribute("aria-labelledby", SIDEBAR_TITLE_ID);
  view.main.replaceChildren(container, view.sidebar);
  showSidebar(view, false);
  const projection = buildProjection();
  view.worldBox = buildWorldBox(projection);
  view.map = buildMap(view, container);
  const countryLayer = buildCountryLayer(
    view,
    readCountryFeatures(topology, projection),
  );
  view.mapCountries = readMapCountries(countryLayer);
  view.lookup = buildCountryLookup(view.mapCountries.keys());
  view.grouping = groupTiles(view.lookup, view.tiles);
  view.unplacedButton = buildUnplacedButton(view);
  view.unplacedControl = buildMapControl(view.unplacedButton, "topright");
  view.emptyControl = buildMapControl(buildEmptyStatus(), "bottomleft");
  // Leaflet adds layers once the map has a view, and a marker's element only
  // exists then: the world first, then the markers' view.
  view.map.fitBounds(buildMapBounds(view.worldBox, 0));
  countryLayer.addTo(view.map);
  drawMarkers(view);
  updateCountryShapes(view);
  fitFirstView(view);
  updateUnplacedControl(view);
  updateEmptyControl(view);
  new ResizeObserver(followMapSize.bind(undefined, view)).observe(container);
}

async function showLoadFailure(view, error) {
  view.main.replaceChildren(buildStatus(FAILED_TEXT));
  await view.engine.request("ui.notify", {
    level: "error",
    message: `The map could not be loaded: ${error.message}`,
  });
}

function addCountryMapStyle() {
  const style = document.createElement("style");
  style.textContent = COUNTRY_MAP_STYLE;
  document.head.append(style);
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  const view = {
    engine,
    main: document.createElement("main"),
    sidebar: document.createElement("aside"),
    card: null,
    tiles: context.tiles,
    map: null,
    worldBox: null,
    mapCountries: new Map(),
    lookup: new Map(),
    grouping: { countries: [], unplaced: null },
    markers: new Map(),
    unplacedButton: null,
    unplacedControl: null,
    emptyControl: null,
    selectedKey: null,
    openSource: null,
    closedByKeyboard: false,
    isFirstViewPending: false,
  };
  view.card = buildCard(view);
  addCountryMapStyle();
  view.main.append(buildStatus(LOADING_TEXT));
  document.body.replaceChildren(view.main, view.card);
  let topology = null;
  try {
    topology = await loadWorld(engine);
  } catch (error) {
    await showLoadFailure(view, error);
    return;
  }
  drawMap(view, topology);
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
}
