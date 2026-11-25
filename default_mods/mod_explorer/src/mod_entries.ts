import type { Catalog, ModEngine, ModInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** A mod of the catalog: its inspection, or why it cannot be inspected. */
export type ModEntry =
  | { source: string; inspection: ModInspection; error: null }
  | { source: string; inspection: null; error: string };

/** The sources of the catalog's mods, in catalog order. */
export function readModSources(catalog: Catalog): string[] {
  const sources: string[] = [];
  for (const entry of catalog.mods) {
    sources.push(entry.source);
  }
  return sources;
}

async function inspectSource(
  engine: ModEngine,
  source: string,
): Promise<ModEntry> {
  try {
    const inspection = await engine.request("mods.inspect", { mod: source });
    const entry: ModEntry = { source, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: ModEntry = {
      source,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

/** Inspects each source, one after another, so the list keeps the catalog's order. */
export async function inspectMods(
  engine: ModEngine,
  sources: string[],
): Promise<ModEntry[]> {
  const entries: ModEntry[] = [];
  for (const source of sources) {
    entries.push(await inspectSource(engine, source));
  }
  return entries;
}
