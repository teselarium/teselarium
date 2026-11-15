import type {
  CollectionInspection,
  ModEngine,
  ModYamlMapping,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** A collection of the explorer's config: its inspection, or why it cannot be inspected. */
export type CollectionEntry =
  | { location: string; inspection: CollectionInspection; error: null }
  | { location: string; inspection: null; error: string };

/** The collection locations of the config's `collections`, in order. Items that are not text are left out. */
export function readCollectionLocations(config: ModYamlMapping): string[] {
  const locations: string[] = [];
  if (!Array.isArray(config.collections)) {
    return locations;
  }
  for (const location of config.collections) {
    if (typeof location === "string") {
      locations.push(location);
    }
  }
  return locations;
}

async function inspectLocation(
  engine: ModEngine,
  location: string,
): Promise<CollectionEntry> {
  try {
    const inspection = await engine.request("collections.inspect", {
      collection: location,
    });
    const entry: CollectionEntry = { location, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: CollectionEntry = {
      location,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

/** Inspects each location, one after another, so the list keeps the config's order. */
export async function inspectCollections(
  engine: ModEngine,
  locations: string[],
): Promise<CollectionEntry[]> {
  const entries: CollectionEntry[] = [];
  for (const location of locations) {
    entries.push(await inspectLocation(engine, location));
  }
  return entries;
}
