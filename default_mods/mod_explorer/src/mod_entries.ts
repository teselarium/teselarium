import type {
  ModEngine,
  ModInspection,
  ModYamlMapping,
} from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** A mod of the explorer's config: its inspection, or why it cannot be inspected. */
export type ModEntry =
  | { reference: string; inspection: ModInspection; error: null }
  | { reference: string; inspection: null; error: string };

/** The mod references of the config's `mods`, in order. Items that are not text are left out. */
export function readModReferences(config: ModYamlMapping): string[] {
  const references: string[] = [];
  if (!Array.isArray(config.mods)) {
    return references;
  }
  for (const reference of config.mods) {
    if (typeof reference === "string") {
      references.push(reference);
    }
  }
  return references;
}

async function inspectReference(
  engine: ModEngine,
  reference: string,
): Promise<ModEntry> {
  try {
    const inspection = await engine.request("mods.inspect", { mod: reference });
    const entry: ModEntry = { reference, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry: ModEntry = {
      reference,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

/** Inspects each reference, one after another, so the list keeps the config's order. */
export async function inspectMods(
  engine: ModEngine,
  references: string[],
): Promise<ModEntry[]> {
  const entries: ModEntry[] = [];
  for (const reference of references) {
    entries.push(await inspectReference(engine, reference));
  }
  return entries;
}
