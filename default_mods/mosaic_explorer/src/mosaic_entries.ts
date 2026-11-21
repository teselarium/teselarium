import type {
  Catalog,
  CatalogMosaicEntry,
  ModEngine,
  MosaicInspection,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** A mosaic of the catalog, with its marks: its inspection, or why it cannot be inspected. */
export type MosaicEntry =
  | {
      catalogEntry: CatalogMosaicEntry;
      inspection: MosaicInspection;
      error: null;
    }
  | { catalogEntry: CatalogMosaicEntry; inspection: null; error: string };

async function inspectCatalogMosaic(
  engine: ModEngine,
  catalogEntry: CatalogMosaicEntry,
): Promise<MosaicEntry> {
  try {
    const inspection = await engine.request("mosaics.inspect", {
      mosaic: catalogEntry.source,
    });
    const entry: MosaicEntry = { catalogEntry, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: MosaicEntry = {
      catalogEntry,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

/** Inspects each mosaic of the catalog, one after another, so the list keeps the catalog's order. */
export async function inspectMosaics(
  engine: ModEngine,
  catalog: Catalog,
): Promise<MosaicEntry[]> {
  const entries: MosaicEntry[] = [];
  for (const catalogMosaic of catalog.mosaics) {
    entries.push(await inspectCatalogMosaic(engine, catalogMosaic));
  }
  return entries;
}
