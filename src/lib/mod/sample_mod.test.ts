import { describe, expect, it } from "vitest";
import { APP_BASE_URL, fetchAppFile } from "../../test/sample_files.ts";
import {
  buildTileValidator,
  loadTileCollection,
  validateTileCollection,
} from "../tile/index.ts";
import type { TileCollection } from "../tile/index.ts";
import { loadMod, loadModTestCode } from "./index.ts";
import type { LoadedMod } from "./index.ts";

/** The `book_list` mod the app ships, read from `public/` like the built app serves it. */
const SHIPPED_SAMPLE_MOD = `${APP_BASE_URL}samples/mods/book_list/`;

interface ValidatedSample {
  /** Name of the mod's tile type. */
  typeName: string;
  /** The mod's sample collection, validated with its tile type. */
  collection: TileCollection;
}

function readDeclaredPath(path: string | null, pathName: string): string {
  if (path === null) {
    throw new Error(
      `The shipped sample mod ${SHIPPED_SAMPLE_MOD} declares no ${pathName}`,
    );
  }
  return path;
}

/** Loads the sample collection the mod declares and validates it with the mod's tile type. */
async function validateSampleCollection(
  sampleMod: LoadedMod,
): Promise<ValidatedSample> {
  const typeSource = readDeclaredPath(sampleMod.typeSource, "type_path");
  const sampleCollection = readDeclaredPath(
    sampleMod.sampleCollection,
    "sample_collection",
  );
  const tileValidator = await buildTileValidator(typeSource, {
    fetch: fetchAppFile,
  });
  const loadedCollection = await loadTileCollection(sampleCollection, {
    fetch: fetchAppFile,
  });
  const validatedSample: ValidatedSample = {
    typeName: tileValidator.typeName,
    collection: validateTileCollection(loadedCollection, tileValidator),
  };
  return validatedSample;
}

describe("shipped sample mod", function describeShippedSampleMod(): void {
  it("its sample collection matches its tile type", async function validatesShippedSample(): Promise<void> {
    const sampleMod = await loadMod(SHIPPED_SAMPLE_MOD, {
      fetch: fetchAppFile,
    });

    expect(sampleMod.typeSource).not.toBeNull();
    expect(sampleMod.sampleCollection).not.toBeNull();

    const { typeName, collection } = await validateSampleCollection(sampleMod);

    expect(collection.tiles.length).toBeGreaterThan(0);
    for (const tile of collection.tiles) {
      expect(tile.types).toEqual([typeName]);
    }
    expect(collection.issues).toEqual([]);
  });

  it("declares the mod API range", async function declaresApiRange(): Promise<void> {
    const sampleMod = await loadMod(SHIPPED_SAMPLE_MOD, {
      fetch: fetchAppFile,
    });

    expect(sampleMod.api).toBe("^0.1.0");
  });

  it("declares its test file", async function declaresTestFile(): Promise<void> {
    const sampleMod = await loadMod(SHIPPED_SAMPLE_MOD, {
      fetch: fetchAppFile,
    });

    expect(sampleMod.testSource).toBe(`${SHIPPED_SAMPLE_MOD}test.js`);
    const testCode = await loadModTestCode(sampleMod, { fetch: fetchAppFile });
    expect(testCode).toContain('"lists the sample books"');
    expect(testCode).toContain('"highlights the remembered book"');
  });
});
