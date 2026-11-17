import { describe, expect, it } from "vitest";
import { APP_BASE_URL, fetchAppFile } from "../../test/sample_files.ts";
import {
  buildTileValidator,
  loadTileCollection,
  validateTileCollection,
} from "../tile/index.ts";
import type { Tile, TileCollection, TileValidator } from "../tile/index.ts";
import type { Metadata } from "../files/index.ts";
import { NPM_HOST } from "../../main/library_host.ts";
import { loadMosaicFile } from "../mosaic/index.ts";
import type { LoadedMosaic } from "../mosaic/index.ts";
import { loadMod, loadModTestCode } from "./index.ts";
import type { LoadedLibrary, LoadedMod, ModPermission } from "./index.ts";

/** A sample mod the app ships, read from `public/` like the built app serves it. */
interface ShippedSample {
  /** The mod's folder, ending with `/`. */
  folder: string;
  /** The `api` range its mod file declares. */
  api: string;
  /** Names of cases its test file registers. */
  caseNames: string[];
}

const SHIPPED_BOOK_LIST: ShippedSample = {
  folder: `${APP_BASE_URL}samples/mods/book_list/`,
  api: "^0.1.14",
  caseNames: ["lists the sample books", "remembers the books per row"],
};

const SHIPPED_FLASHCARDS: ShippedSample = {
  folder: `${APP_BASE_URL}samples/mods/flashcards/`,
  api: "^0.1.14",
  caseNames: ["lists the sample tiles", "remembers the chosen fields"],
};

const SHIPPED_COUNTRY_MAP: ShippedSample = {
  folder: `${APP_BASE_URL}samples/mods/country_map/`,
  api: "^0.1.14",
  caseNames: [
    "shows a marker per country",
    "opens a country",
    "groups tiles not on the map",
  ],
};

/** The libraries the country map declares, with their files on the vanilla npm host. */
const COUNTRY_MAP_LIBRARIES: LoadedLibrary[] = [
  {
    name: "leaflet",
    package: "leaflet",
    version: "1.9.4",
    files: [
      {
        path: "dist/leaflet.js",
        source: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
        kind: "script",
      },
      {
        path: "dist/leaflet.css",
        source: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
        kind: "style",
      },
    ],
  },
  {
    name: "topojson_client",
    package: "topojson-client",
    version: "3.1.0",
    files: [
      {
        path: "dist/topojson-client.min.js",
        source:
          "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js",
        kind: "script",
      },
    ],
  },
  {
    name: "proj4",
    package: "proj4",
    version: "2.23.0",
    files: [
      {
        path: "dist/proj4.js",
        source: "https://cdn.jsdelivr.net/npm/proj4@2.23.0/dist/proj4.js",
        kind: "script",
      },
    ],
  },
  {
    name: "world_atlas",
    package: "world-atlas",
    version: "2.0.2",
    files: [
      {
        path: "countries-110m.json",
        source:
          "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json",
        kind: "data",
      },
    ],
  },
];

/** The `show` permissions of the default mosaics of the book list and the country map: the hosts the sample books' covers load from, Open Library's redirects included. */
const COVER_PERMISSIONS: ModPermission[] = [
  {
    category: "show",
    host: "https://upload.wikimedia.org",
    reason: "Shows the book covers",
  },
  {
    category: "show",
    host: "https://covers.openlibrary.org",
    reason: "Shows the book covers",
  },
  {
    category: "show",
    host: "https://*.archive.org",
    reason: "Shows the book covers",
  },
  {
    category: "show",
    host: "https://archive.org",
    reason: "Shows the book covers",
  },
];

/** The Nobel laureates sample collection, whose tiles have no flashcard fields. */
const NOBEL_LAUREATES_COLLECTION = `${APP_BASE_URL}samples/tiles/literature_nobel_laureates/collection.yaml`;

interface ValidatedSample {
  /** Name of the mod's tile type. */
  typeName: string;
  /** The collection of the mod's default mosaic, validated with its tile type. */
  collection: TileCollection;
}

function readDeclaredPath(
  sampleMod: LoadedMod,
  path: string | null,
  pathName: string,
): string {
  if (path === null) {
    throw new Error(
      `The shipped sample mod ${sampleMod.source} declares no ${pathName}`,
    );
  }
  return path;
}

async function buildSampleValidator(
  sampleMod: LoadedMod,
): Promise<TileValidator> {
  const typeSource = readDeclaredPath(
    sampleMod,
    sampleMod.typeSource,
    "type_path",
  );
  const tileValidator = await buildTileValidator(typeSource, {
    fetch: fetchAppFile,
  });
  return tileValidator;
}

/** Loads the default mosaic the mod declares, without its mod or its collection. */
function loadDefaultMosaic(sampleMod: LoadedMod): Promise<LoadedMosaic> {
  const defaultMosaic = readDeclaredPath(
    sampleMod,
    sampleMod.defaultMosaic,
    "default_mosaic",
  );
  return loadMosaicFile(defaultMosaic, { fetch: fetchAppFile });
}

/** Loads the collection of the mod's default mosaic and validates it with the mod's tile type. */
async function validateSampleCollection(
  sampleMod: LoadedMod,
): Promise<ValidatedSample> {
  const defaultMosaic = await loadDefaultMosaic(sampleMod);
  const sampleCollection = readDeclaredPath(
    sampleMod,
    defaultMosaic.collection,
    "collection in its default mosaic",
  );
  const tileValidator = await buildSampleValidator(sampleMod);
  const loadedCollection = await loadTileCollection(sampleCollection, {
    fetch: fetchAppFile,
  });
  const validatedSample: ValidatedSample = {
    typeName: tileValidator.typeName,
    collection: validateTileCollection(loadedCollection, tileValidator),
  };
  return validatedSample;
}

/** Loads a shipped sample as the vanilla app does, with its npm host. */
function loadShippedMod(sample: ShippedSample): Promise<LoadedMod> {
  const loading = loadMod(sample.folder, {
    fetch: fetchAppFile,
    npmHost: NPM_HOST,
  });
  return loading;
}

/** A collection of one tile with the given metadata, validated with the tile validator. */
function validateOneTile(
  tileValidator: TileValidator,
  metadata: Metadata,
): TileCollection {
  const tile: Tile = {
    source: `${APP_BASE_URL}cards/one.md`,
    metadata,
    body: "",
    types: [],
  };
  const collection: TileCollection = {
    source: `${APP_BASE_URL}cards/collection.yaml`,
    title: "One card",
    description: "",
    tiles: [tile],
    issues: [],
  };
  const validatedCollection = validateTileCollection(collection, tileValidator);
  return validatedCollection;
}

function describeShippedSample(sample: ShippedSample): void {
  it("has a default mosaic of itself", async function declaresDefaultMosaic(): Promise<void> {
    const sampleMod = await loadShippedMod(sample);

    expect(sampleMod.defaultMosaic).toBe(`${sample.folder}mosaic.yaml`);
    const defaultMosaic = await loadDefaultMosaic(sampleMod);
    expect(defaultMosaic.mod).toBe(sampleMod.source);
  });

  it("its default mosaic's collection matches its tile type", async function validatesShippedSample(): Promise<void> {
    const sampleMod = await loadShippedMod(sample);

    expect(sampleMod.typeSource).not.toBeNull();

    const { typeName, collection } = await validateSampleCollection(sampleMod);

    expect(collection.tiles.length).toBeGreaterThan(0);
    for (const tile of collection.tiles) {
      expect(tile.types).toEqual([typeName]);
    }
    expect(collection.issues).toEqual([]);
  });

  it("declares the mod API range", async function declaresApiRange(): Promise<void> {
    const sampleMod = await loadShippedMod(sample);

    expect(sampleMod.api).toBe(sample.api);
  });

  it("declares its test file", async function declaresTestFile(): Promise<void> {
    const sampleMod = await loadShippedMod(sample);

    expect(sampleMod.testSource).toBe(`${sample.folder}test.js`);
    const testCode = await loadModTestCode(sampleMod, { fetch: fetchAppFile });
    for (const caseName of sample.caseNames) {
      expect(testCode).toContain(`"${caseName}"`);
    }
  });
}

/** The permissions of a shipped sample, and those of its default mosaic. */
interface SamplePermissions {
  mod: ModPermission[];
  mosaic: ModPermission[];
}

async function readSamplePermissions(
  sample: ShippedSample,
): Promise<SamplePermissions> {
  const sampleMod = await loadShippedMod(sample);
  const defaultMosaic = await loadDefaultMosaic(sampleMod);
  const permissions: SamplePermissions = {
    mod: sampleMod.permissions,
    mosaic: defaultMosaic.permissions,
  };
  return permissions;
}

describe("shipped sample mod book_list", function describeBookList(): void {
  describeShippedSample(SHIPPED_BOOK_LIST);

  it("declares show for the covers' hosts in its default mosaic only", async function declaresCoverHosts(): Promise<void> {
    const permissions = await readSamplePermissions(SHIPPED_BOOK_LIST);

    expect(permissions).toEqual({ mod: [], mosaic: COVER_PERMISSIONS });
  });
});

describe("shipped sample mod flashcards", function describeFlashcards(): void {
  describeShippedSample(SHIPPED_FLASHCARDS);

  it("declares no permission, nor does its default mosaic", async function declaresNoPermission(): Promise<void> {
    const permissions = await readSamplePermissions(SHIPPED_FLASHCARDS);

    expect(permissions).toEqual({ mod: [], mosaic: [] });
  });
});

describe("shipped sample mod country_map", function describeCountryMap(): void {
  describeShippedSample(SHIPPED_COUNTRY_MAP);

  it("declares Leaflet, topojson-client and world-atlas from the npm host", async function declaresLibraries(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_COUNTRY_MAP);

    expect(sampleMod.libraries).toEqual(COUNTRY_MAP_LIBRARIES);
  });

  it("declares show for the covers' hosts in its default mosaic only", async function declaresCoverHosts(): Promise<void> {
    const permissions = await readSamplePermissions(SHIPPED_COUNTRY_MAP);

    expect(permissions).toEqual({ mod: [], mosaic: COVER_PERMISSIONS });
  });
});

describe("country tile type", function describeCountryTileType(): void {
  it("is named country_tile, with the 51 sample books", async function namesCountryTileType(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_COUNTRY_MAP);

    const { typeName, collection } = await validateSampleCollection(sampleMod);

    expect(typeName).toBe("country_tile");
    expect(collection.tiles.length).toBe(51);
    expect(collection.issues).toEqual([]);
  });

  it("does not match a tile without a country", async function rejectsMissingCountry(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_COUNTRY_MAP);
    const tileValidator = await buildSampleValidator(sampleMod);

    const collection = validateOneTile(tileValidator, { title: "Kallocain" });

    expect(collection.tiles[0].types).toEqual([]);
  });
});

describe("flashcard tile type", function describeFlashcardType(): void {
  it("is named flashcard, with the sample deck of 8 tiles", async function namesFlashcardType(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_FLASHCARDS);

    const { typeName, collection } = await validateSampleCollection(sampleMod);

    expect(typeName).toBe("flashcard");
    expect(collection.tiles.length).toBe(8);
  });

  it("matches the Nobel laureates collection", async function matchesNobelLaureates(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_FLASHCARDS);
    const tileValidator = await buildSampleValidator(sampleMod);
    const loadedCollection = await loadTileCollection(
      NOBEL_LAUREATES_COLLECTION,
      { fetch: fetchAppFile },
    );

    const collection = validateTileCollection(loadedCollection, tileValidator);

    expect(collection.tiles.length).toBeGreaterThan(0);
    for (const tile of collection.tiles) {
      expect(tile.types).toEqual(["flashcard"]);
    }
    expect(collection.issues).toEqual([]);
  });

  it("matches a number as the answer", async function matchesNumberAnswer(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_FLASHCARDS);
    const tileValidator = await buildSampleValidator(sampleMod);

    const collection = validateOneTile(tileValidator, { answer: 1953 });

    expect(collection.tiles[0].types).toEqual(["flashcard"]);
    expect(collection.issues).toEqual([]);
  });

  it("warns about a title that is not a string", async function warnsAboutNumberTitle(): Promise<void> {
    const sampleMod = await loadShippedMod(SHIPPED_FLASHCARDS);
    const tileValidator = await buildSampleValidator(sampleMod);

    const collection = validateOneTile(tileValidator, { title: 1984 });

    expect(collection.tiles[0].types).toEqual([]);
    expect(collection.issues).toHaveLength(1);
    expect(collection.issues[0].level).toBe("warning");
    expect(collection.issues[0].message).toContain("metadata/title");
  });
});
