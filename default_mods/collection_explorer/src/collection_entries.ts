import type {
  CatalogListing,
  CollectionInspection,
  ModEngine,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** A collection of the app's catalog: its inspection, or why it cannot be inspected. */
export type CollectionEntry =
  | { source: string; inspection: CollectionInspection; error: null }
  | { source: string; inspection: null; error: string };

/** The sources of the catalog's collections, in catalog order. */
export function readCollectionSources(catalog: CatalogListing): string[] {
  const sources: string[] = [];
  for (const entry of catalog.collections) {
    sources.push(entry.source);
  }
  return sources;
}

async function inspectSource(
  engine: ModEngine,
  source: string,
): Promise<CollectionEntry> {
  try {
    const inspection = await engine.request("collections.inspect", {
      collection: source,
    });
    const entry: CollectionEntry = { source, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: CollectionEntry = {
      source,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

/** Inspects each source, one after another, so the list keeps the catalog's order. */
export async function inspectCollections(
  engine: ModEngine,
  sources: string[],
): Promise<CollectionEntry[]> {
  const entries: CollectionEntry[] = [];
  for (const source of sources) {
    entries.push(await inspectSource(engine, source));
  }
  return entries;
}
