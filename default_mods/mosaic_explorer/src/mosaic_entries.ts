import type {
  Catalog,
  CatalogMosaicEntry,
  ModEngine,
  MosaicInspection,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** The mod whose default mosaic a catalog mosaic is, or `null`. */
type DefaultOf = CatalogMosaicEntry["defaultOf"];

/** A mosaic of the catalog, with its mod mark: its inspection, or why it cannot be inspected. */
export type MosaicEntry =
  | {
      source: string;
      defaultOf: DefaultOf;
      inspection: MosaicInspection;
      error: null;
    }
  | { source: string; defaultOf: DefaultOf; inspection: null; error: string };

async function inspectCatalogMosaic(
  engine: ModEngine,
  catalogMosaic: CatalogMosaicEntry,
): Promise<MosaicEntry> {
  const { source, defaultOf } = catalogMosaic;
  try {
    const inspection = await engine.request("mosaics.inspect", {
      mosaic: source,
    });
    const entry: MosaicEntry = { source, defaultOf, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: MosaicEntry = {
      source,
      defaultOf,
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
