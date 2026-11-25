import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, relative, sep } from "node:path";
import type {
  Connect,
  Environment,
  Plugin,
  ResolvedConfig,
  Rollup,
  ViteDevServer,
} from "vite";
import {
  buildDefaultModFile,
  bundleDefaultMod,
  describeModFolder,
  listDefaultModNames,
  planDefaultMod,
  readDefaultModFileAddress,
} from "./default_mod_build.ts";
import type {
  DefaultModFileAddress,
  ServedModFile,
} from "./default_mod_build.ts";

/**
 * The folder of the default mods: in the repository, at Vite's root, and
 * in the app's address, where the app looks for them (src/main/default_mods.ts).
 */
const SERVED_MODS_FOLDER = "default_mods";

/** The content types the dev server gives the files of default mods, by extension. */
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

/** The content type of files whose extension `CONTENT_TYPES` does not list. */
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * The dev server's state: the default mods folder, the served address of
 * the mods, and the built files of each mod, by mod name and then by path.
 * The watcher drops a mod's entry when a file of its folder changes.
 */
interface DefaultModsDevState {
  modsFolder: string;
  servedPrefix: string;
  builtFiles: Map<string, Map<string, Promise<ServedModFile>>>;
}

/** The context of Vite's build hooks, which names the environment being built. */
type ViteBuildContext = Rollup.PluginContext & { environment: Environment };

/**
 * Fails when `public/default_mods/` exists: Vite would copy it into the
 * build, under the same paths as the mods this plugin emits.
 */
function checkOldModsFolder(config: ResolvedConfig): void {
  if (config.publicDir === "") {
    return;
  }
  const oldModsFolder = join(config.publicDir, SERVED_MODS_FOLDER);
  if (existsSync(oldModsFolder)) {
    throw new Error(
      `The folder ${describeModFolder(oldModsFolder)} exists, but default mods now live in ${SERVED_MODS_FOLDER}/ at the repository's root. Move its mod folders to ${SERVED_MODS_FOLDER}/ and delete ${describeModFolder(oldModsFolder)} (${SERVED_MODS_FOLDER}/README.md).`,
    );
  }
}

/** Emits the files of every default mod into the build, at `default_mods/<name>/<path>`. */
async function emitDefaultMods(
  modsFolder: string,
  context: Rollup.PluginContext,
): Promise<void> {
  for (const modName of listDefaultModNames(modsFolder)) {
    const servedFiles = await bundleDefaultMod(join(modsFolder, modName));
    for (const servedFile of servedFiles) {
      context.emitFile({
        type: "asset",
        fileName: `${SERVED_MODS_FOLDER}/${modName}/${servedFile.path}`,
        source: servedFile.content,
      });
    }
  }
}

function readModsFolder(root: string): string {
  const modsFolder = join(root, SERVED_MODS_FOLDER);
  return modsFolder;
}

async function generateDefaultMods(this: ViteBuildContext): Promise<void> {
  await emitDefaultMods(readModsFolder(this.environment.config.root), this);
}

/** The default mod file a request asks for, or `null` when the request is not below the served mods folder. */
function readDefaultModRequest(
  servedPrefix: string,
  requestUrl: string,
): DefaultModFileAddress | null {
  const pathname = decodeURIComponent(
    new URL(requestUrl, "http://localhost").pathname,
  );
  if (!pathname.startsWith(servedPrefix)) {
    return null;
  }
  const modRequest = readDefaultModFileAddress(
    pathname.slice(servedPrefix.length),
  );
  return modRequest;
}

function readModBuiltFiles(
  state: DefaultModsDevState,
  modName: string,
): Map<string, Promise<ServedModFile>> {
  const cachedFiles = state.builtFiles.get(modName);
  if (cachedFiles !== undefined) {
    return cachedFiles;
  }
  const modBuiltFiles = new Map<string, Promise<ServedModFile>>();
  state.builtFiles.set(modName, modBuiltFiles);
  return modBuiltFiles;
}

/**
 * Builds the requested file of a default mod, or gives `null` when the mod
 * does not serve it. Only that file is built, so a mod whose source cannot
 * be bundled still serves its `mod_conf.yaml`.
 */
async function buildRequestedFile(
  state: DefaultModsDevState,
  modRequest: DefaultModFileAddress,
): Promise<ServedModFile | null> {
  if (!listDefaultModNames(state.modsFolder).includes(modRequest.modName)) {
    return null;
  }
  const modFolder = join(state.modsFolder, modRequest.modName);
  const modBuiltFiles = readModBuiltFiles(state, modRequest.modName);
  const cachedFile = modBuiltFiles.get(modRequest.path);
  if (cachedFile !== undefined) {
    const servedFile = await cachedFile;
    return servedFile;
  }
  for (const plannedFile of planDefaultMod(modFolder)) {
    if (plannedFile.path === modRequest.path) {
      const building = buildDefaultModFile(modFolder, plannedFile);
      modBuiltFiles.set(modRequest.path, building);
      const servedFile = await building;
      return servedFile;
    }
  }
  return null;
}

function readContentType(path: string): string {
  const contentType = CONTENT_TYPES[extname(path)] ?? DEFAULT_CONTENT_TYPE;
  return contentType;
}

function answerText(
  response: ServerResponse,
  statusCode: number,
  text: string,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(text);
}

function answerServedFile(
  response: ServerResponse,
  servedFile: ServedModFile,
): void {
  response.statusCode = 200;
  response.setHeader("Content-Type", readContentType(servedFile.path));
  response.setHeader("Cache-Control", "no-cache");
  response.end(servedFile.content);
}

async function answerDefaultModRequest(
  state: DefaultModsDevState,
  modRequest: DefaultModFileAddress,
  response: ServerResponse,
): Promise<void> {
  try {
    const servedFile = await buildRequestedFile(state, modRequest);
    if (servedFile === null) {
      answerText(response, 404, "Not Found");
      return;
    }
    answerServedFile(response, servedFile);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    answerText(response, 500, errorMessage);
  }
}

/** Answers the dev server's requests below `/default_mods/` with the files the build would give. */
async function serveDefaultModFile(
  state: DefaultModsDevState,
  request: IncomingMessage,
  response: ServerResponse,
  next: Connect.NextFunction,
): Promise<void> {
  const modRequest = readDefaultModRequest(
    state.servedPrefix,
    request.url ?? "/",
  );
  if (modRequest === null) {
    next();
    return;
  }
  await answerDefaultModRequest(state, modRequest, response);
}

/** Drops the built files of the mod whose folder holds a changed file. */
function dropChangedMod(
  state: DefaultModsDevState,
  _eventName: string,
  changedPath: string,
): void {
  const relativePath = relative(state.modsFolder, changedPath);
  if (relativePath.startsWith("..")) {
    return;
  }
  const [modName] = relativePath.split(sep);
  state.builtFiles.delete(modName);
}

function configureDefaultModsServer(server: ViteDevServer): void {
  const modsFolder = readModsFolder(server.config.root);
  const state: DefaultModsDevState = {
    modsFolder,
    servedPrefix: `${server.config.base}${SERVED_MODS_FOLDER}/`,
    builtFiles: new Map(),
  };
  // Registered here, not in a returned function, so it runs before Vite's own handling of the request.
  server.middlewares.use(serveDefaultModFile.bind(undefined, state));
  server.watcher.add(modsFolder);
  server.watcher.on("all", dropChangedMod.bind(undefined, state));
}

/**
 * Builds the default mods of the `default_mods/` folder at Vite's root
 * (build/default_mod_build.ts): the build emits them at
 * `default_mods/<name>/`, and the dev server answers them at the same
 * addresses. Fails at start when `public/default_mods/` exists.
 */
export function defaultModsPlugin(): Plugin {
  const plugin: Plugin = {
    name: "teselarium:default-mods",
    configResolved: checkOldModsFolder,
    generateBundle: generateDefaultMods,
    configureServer: configureDefaultModsServer,
  };
  return plugin;
}
