import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { rolldown } from "rolldown";
import type { RolldownBuild } from "rolldown";
import { parseSync } from "rolldown/utils";

/** A file a default mod serves: its path in the mod's served folder, and its bytes. */
export interface ServedModFile {
  path: string;
  content: Uint8Array<ArrayBuffer>;
}

/**
 * A file a default mod will serve, before it is built: its served path, the
 * file of the mod folder it comes from, and whether that file is bundled or
 * copied.
 */
export interface PlannedModFile {
  path: string;
  sourcePath: string;
  bundled: boolean;
}

/** A TypeScript source that the build turns into one self-contained ES module. */
interface ModEntryPoint {
  sourcePath: string;
  outputPath: string;
}

const MOD_ENTRY_POINTS: ModEntryPoint[] = [
  { sourcePath: "src/main.ts", outputPath: "main.js" },
  { sourcePath: "test/test.ts", outputPath: "test.js" },
];

/** The folders at a mod folder's root that hold source and are not served. */
const NOT_SHIPPED_FOLDERS = ["src", "test"];

/** The files at a mod folder's root that are not served. */
const NOT_SHIPPED_FILES = ["README.md", "tsconfig.json"];

/** The browsers the bundles run in: the app's own target (tsconfig.app.json). */
const BUNDLE_TARGET = "es2023";

/** A path with `/` separators, as served paths and errors write it. */
function toPosixPath(path: string): string {
  const posixPath = path.split(sep).join("/");
  return posixPath;
}

/** The mod folder as errors name it: relative to the working directory, e.g. `default_mods/mod_viewer/`. */
export function describeModFolder(modFolder: string): string {
  const folderLabel = `${toPosixPath(relative(process.cwd(), modFolder))}/`;
  return folderLabel;
}

function buildModError(modFolder: string, detail: string): Error {
  const modError = new Error(
    `Cannot build the default mod ${describeModFolder(modFolder)}: ${detail}`,
  );
  return modError;
}

/** A file of a default mod, by its path below the default mods folder: the mod's name and the file's path in the mod's served folder. */
export interface DefaultModFileAddress {
  modName: string;
  path: string;
}

/**
 * Reads a path below the default mods folder: `mod_viewer/main.js` is the
 * file `main.js` of the mod `mod_viewer`. A file at the folder's root, like
 * `README.md`, gets an empty mod name, which names no mod.
 */
export function readDefaultModFileAddress(
  modsPath: string,
): DefaultModFileAddress {
  const separatorIndex = modsPath.indexOf("/");
  const fileAddress: DefaultModFileAddress = {
    modName: separatorIndex === -1 ? "" : modsPath.slice(0, separatorIndex),
    path: separatorIndex === -1 ? modsPath : modsPath.slice(separatorIndex + 1),
  };
  return fileAddress;
}

/** The mod names of a default mods folder: its direct subfolders, sorted. Files at its root are not mods. */
export function listDefaultModNames(modsFolder: string): string[] {
  if (!existsSync(modsFolder)) {
    const noModNames: string[] = [];
    return noModNames;
  }
  const modNames: string[] = [];
  for (const entry of readdirSync(modsFolder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      modNames.push(entry.name);
    }
  }
  modNames.sort();
  return modNames;
}

function isShippedPath(sourcePath: string): boolean {
  const [rootName] = sourcePath.split("/");
  const isInSourceFolder =
    sourcePath.includes("/") && NOT_SHIPPED_FOLDERS.includes(rootName);
  const isShipped =
    !isInSourceFolder && !NOT_SHIPPED_FILES.includes(sourcePath);
  return isShipped;
}

/** Every file of a mod folder, as paths relative to the folder. */
function listModFolderFiles(modFolder: string): string[] {
  const filePaths: string[] = [];
  const entries = readdirSync(modFolder, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (entry.isFile()) {
      filePaths.push(
        toPosixPath(relative(modFolder, join(entry.parentPath, entry.name))),
      );
    }
  }
  return filePaths;
}

function buildCopiedFile(sourcePath: string): PlannedModFile {
  const copiedFile: PlannedModFile = {
    path: sourcePath,
    sourcePath,
    bundled: false,
  };
  return copiedFile;
}

function buildBundledFile(entryPoint: ModEntryPoint): PlannedModFile {
  const bundledFile: PlannedModFile = {
    path: entryPoint.outputPath,
    sourcePath: entryPoint.sourcePath,
    bundled: true,
  };
  return bundledFile;
}

function compareServedPaths(
  first: PlannedModFile,
  second: PlannedModFile,
): number {
  const order = first.path.localeCompare(second.path);
  return order;
}

/**
 * The files a mod folder serves: each entry point it has (`src/main.ts` as
 * `main.js`, `test/test.ts` as `test.js`) and every other shipped file,
 * copied. A folder without entry points is copied as it is. Throws, before
 * anything is bundled, when an entry point's output is also a file of the folder.
 */
export function planDefaultMod(modFolder: string): PlannedModFile[] {
  const folderFiles = listModFolderFiles(modFolder);
  const plannedFiles: PlannedModFile[] = [];
  for (const sourcePath of folderFiles) {
    if (isShippedPath(sourcePath)) {
      plannedFiles.push(buildCopiedFile(sourcePath));
    }
  }
  for (const entryPoint of MOD_ENTRY_POINTS) {
    if (!folderFiles.includes(entryPoint.sourcePath)) {
      continue;
    }
    if (folderFiles.includes(entryPoint.outputPath)) {
      throw buildModError(
        modFolder,
        `${entryPoint.sourcePath} builds ${entryPoint.outputPath}, and the folder also has a hand-written ${entryPoint.outputPath}. Remove one of the two files.`,
      );
    }
    plannedFiles.push(buildBundledFile(entryPoint));
  }
  plannedFiles.sort(compareServedPaths);
  return plannedFiles;
}

function isInsideFolder(filePath: string, folder: string): boolean {
  const relativePath = relative(folder, filePath);
  const isInside =
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !relativePath.startsWith(sep);
  return isInside;
}

function isNodeModulePath(filePath: string): boolean {
  const isNodeModule = filePath.split(sep).includes("node_modules");
  return isNodeModule;
}

/** The first file a bundle loaded from outside the mod folder and `node_modules/`, or `null`. */
function findOutsideFile(
  modFolder: string,
  loadedFiles: string[],
): string | null {
  for (const loadedFile of loadedFiles) {
    if (
      !isInsideFolder(loadedFile, modFolder) &&
      !isNodeModulePath(loadedFile)
    ) {
      return loadedFile;
    }
  }
  return null;
}

/** Throws when a bundle loaded a file outside the mod folder and `node_modules/`, so a mod never bundles app code. */
async function checkModBoundary(
  modFolder: string,
  bundle: RolldownBuild,
): Promise<void> {
  const outsideFile = findOutsideFile(modFolder, await bundle.watchFiles);
  if (outsideFile !== null) {
    throw new Error(
      `It imports ${toPosixPath(relative(modFolder, outsideFile))}, which is outside the mod folder. A default mod imports only its own files and npm packages.`,
    );
  }
}

/** Whether a bundle still imports other modules, which a module run from a `blob:` URL cannot. */
function hasLeftImports(code: string): boolean {
  const moduleRecord = parseSync("bundle.js", code).module;
  if (
    moduleRecord.staticImports.length > 0 ||
    moduleRecord.dynamicImports.length > 0
  ) {
    return true;
  }
  for (const staticExport of moduleRecord.staticExports) {
    for (const exportEntry of staticExport.entries) {
      if (exportEntry.moduleRequest !== null) {
        return true;
      }
    }
  }
  return false;
}

function readBundleErrorDetail(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorDetail = stripVTControlCharacters(errorMessage).trim();
  return errorDetail;
}

/** Bundles one entry point into one self-contained ES module, and gives its code. */
async function bundleEntryPoint(
  modFolder: string,
  sourcePath: string,
): Promise<string> {
  // Absolute, since Rolldown resolves a relative `input` against `cwd`.
  const absoluteModFolder = resolve(modFolder);
  const bundle = await rolldown({
    input: join(absoluteModFolder, sourcePath),
    cwd: absoluteModFolder,
    platform: "browser",
    tsconfig: false,
    transform: { target: BUNDLE_TARGET },
  });
  try {
    const output = await bundle.generate({
      format: "esm",
      codeSplitting: false,
      minify: false,
    });
    await checkModBoundary(absoluteModFolder, bundle);
    const code = output.output[0].code;
    if (output.output.length !== 1 || hasLeftImports(code)) {
      throw new Error(
        "Its bundle still imports other modules, so it cannot run from a blob: URL. Check the bundle settings in build/default_mod_build.ts.",
      );
    }
    return code;
  } finally {
    await bundle.close();
  }
}

async function buildBundledContent(
  modFolder: string,
  sourcePath: string,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const code = await bundleEntryPoint(modFolder, sourcePath);
    const bundledContent = new TextEncoder().encode(code);
    return bundledContent;
  } catch (error) {
    throw buildModError(
      modFolder,
      `${sourcePath} cannot be bundled.\n${readBundleErrorDetail(error)}`,
    );
  }
}

/** Builds one planned file: bundles an entry point, or reads a copied file byte for byte. */
export async function buildDefaultModFile(
  modFolder: string,
  plannedFile: PlannedModFile,
): Promise<ServedModFile> {
  const content = plannedFile.bundled
    ? await buildBundledContent(modFolder, plannedFile.sourcePath)
    : new Uint8Array(readFileSync(join(modFolder, plannedFile.sourcePath)));
  const servedFile: ServedModFile = { path: plannedFile.path, content };
  return servedFile;
}

/**
 * The files a default mod folder serves, sorted by path: `src/main.ts` as
 * `main.js`, `test/test.ts` as `test.js`, and every other file copied, except
 * `src/`, `test/`, `README.md` and `tsconfig.json`. Throws an error that names
 * the mod folder and the file when the folder cannot be built.
 */
export async function bundleDefaultMod(
  modFolder: string,
): Promise<ServedModFile[]> {
  const servedFiles: ServedModFile[] = [];
  for (const plannedFile of planDefaultMod(modFolder)) {
    servedFiles.push(await buildDefaultModFile(modFolder, plannedFile));
  }
  return servedFiles;
}
