import type {
  ModEngine,
  ModYamlMapping,
  MosaicInspection,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** A mosaic of the explorer's config: its inspection, or why it cannot be inspected. */
export type MosaicEntry =
  | { location: string; inspection: MosaicInspection; error: null }
  | { location: string; inspection: null; error: string };

/** The mosaic locations of the config's `mosaics`, in order. Items that are not text are left out. */
export function readMosaicLocations(config: ModYamlMapping): string[] {
  const locations: string[] = [];
  if (!Array.isArray(config.mosaics)) {
    return locations;
  }
  for (const location of config.mosaics) {
    if (typeof location === "string") {
      locations.push(location);
    }
  }
  return locations;
}

async function inspectLocation(
  engine: ModEngine,
  location: string,
): Promise<MosaicEntry> {
  try {
    const inspection = await engine.request("mosaics.inspect", {
      mosaic: location,
    });
    const entry: MosaicEntry = { location, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: MosaicEntry = {
      location,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

/** Inspects each location, one after another, so the list keeps the config's order. */
export async function inspectMosaics(
  engine: ModEngine,
  locations: string[],
): Promise<MosaicEntry[]> {
  const entries: MosaicEntry[] = [];
  for (const location of locations) {
    entries.push(await inspectLocation(engine, location));
  }
  return entries;
}
