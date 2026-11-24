import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const PUBLIC_DIRECTORY = path.resolve(import.meta.dirname, "../public");
const INSTANCE_CATALOG_FILE = path.resolve(
  import.meta.dirname,
  "../src/main/instance_catalog.ts",
);
const MOSAICS_LIST_PATTERN = /mosaics:\s*\[([^\]]*)\]/;
const QUOTED_REFERENCE_PATTERN = /"([^"]+)"/g;

/**
 * The mosaic references of the vanilla instance catalog, in order. The catalog is
 * read as text: importing it would pull the app's modules into the e2e type check.
 */
async function readVanillaMosaicReferences(): Promise<string[]> {
  const source = await readFile(INSTANCE_CATALOG_FILE, "utf8");
  const list = MOSAICS_LIST_PATTERN.exec(source);
  if (list === null) {
    throw new Error(
      `Cannot find the "mosaics: [...]" list of the vanilla catalog in ${INSTANCE_CATALOG_FILE}.`,
    );
  }
  const references: string[] = [];
  for (const match of list[1].matchAll(QUOTED_REFERENCE_PATTERN)) {
    references.push(match[1]);
  }
  return references;
}

/** The file of a mosaic reference of the vanilla catalog, e.g. `./samples/mosaics/a.yaml`, under `public/`. */
function resolveMosaicFile(reference: string): string {
  const file = path.resolve(PUBLIC_DIRECTORY, reference);
  const isInsidePublic = file.startsWith(PUBLIC_DIRECTORY + path.sep);
  if (!isInsidePublic) {
    throw new Error(
      `Cannot read the vanilla mosaic "${reference}": it is not a file of public/ (${PUBLIC_DIRECTORY}).`,
    );
  }
  return file;
}

async function readMosaicTitle(reference: string): Promise<string> {
  const file = resolveMosaicFile(reference);
  const text = await readFile(file, "utf8");
  const title = (parse(text) as { mosaic?: { title?: unknown } })?.mosaic
    ?.title;
  if (typeof title !== "string") {
    throw new Error(
      `The vanilla mosaic file ${file} (reference "${reference}") has no mosaic.title text.`,
    );
  }
  return title;
}

/** The titles of the mosaics the vanilla instance catalog lists, in catalog order. */
export async function readVanillaMosaicTitles(): Promise<string[]> {
  const titles: string[] = [];
  for (const reference of await readVanillaMosaicReferences()) {
    titles.push(await readMosaicTitle(reference));
  }
  return titles;
}
