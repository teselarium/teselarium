import type { FileFetchOptions, YamlMapping } from "../../files/index.ts";
import { loadMod, resolveModReference } from "../../mod/index.ts";
import type { LoadedMod, ModIssue, ModLoadOptions } from "../../mod/index.ts";
import {
  buildTileValidator,
  loadTile,
  loadTileCollection,
  validateTileCollection,
} from "../../tile/index.ts";
import type {
  Tile,
  TileCollection,
  TileIssue,
  TileValidator,
} from "../../tile/index.ts";
import { describeDeniedPermission } from "../permissions/index.ts";
import type { ModGrants } from "../permissions/index.ts";
import {
  buildSandboxDocument,
  buildSandboxPolicy,
  collectContentHosts,
} from "../sandbox/index.ts";
import type { TileLinks } from "../sandbox/index.ts";
import type { Theme } from "../theme/index.ts";
import { findSwitchedOffMod } from "./default_mod_settings.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { ModSwitchedOffError, RunLinkConflictError } from "./engine_errors.ts";
import {
  describeMissingApiRange,
  matchModApiRange,
  MOD_API_VERSION,
} from "./mod_api_version.ts";
import { buildTileBodies, collectModTileLinks } from "./mod_tile_bodies.ts";
import type { TileBodies } from "./mod_tile_bodies.ts";
import { resolveTilePaths } from "./tile_paths.ts";

/**
 * What to run: a mod reference, a collection or a tile location, and the
 * link parameters. Not an address. `tile` is optional so that links written
 * without it, such as sections' mod targets, stay valid; absent means `null`.
 */
export interface RunLink {
  mod: string;
  collection: string | null;
  tile?: string | null;
  params: Record<string, string>;
}

/**
 * How wide a mod frame lays out its content: centered at the content width,
 * across the stage area (theater mode), or across the screen (fullscreen).
 */
export type FrameLayout = "contained" | "theater" | "fullscreen";

/** What a mod receives as the second argument of `mount`. Plain data. */
export interface ModContext {
  mod: {
    source: string;
    name: string;
    title: string;
    version: string;
    description: string;
  };
  /** The mod API the mod runs on. */
  api: {
    version: string;
  };
  config: YamlMapping;
  params: Record<string, string>;
  tiles: Tile[];
  issues: TileIssue[];
  permissions: ModGrants;
  /** The theme current when the frame connected. */
  theme: Theme;
  /** The frame's layout when the frame connected. */
  layout: FrameLayout;
}

/**
 * The mount context as built when the mod starts loading: everything but the
 * theme and the layout, which are only known when the frame connects.
 */
export type LaunchContext = Omit<ModContext, "theme" | "layout">;

/** Where the tiles of a link come from: a collection file or one tile file. */
export type TilesKind = "collection" | "tile";

/** Everything needed to start a mod's frame. Plain data. */
export interface ModLaunch {
  mod: LoadedMod;
  /** Whether the link's tiles come from a collection or a tile, `null` when it names neither. */
  tilesKind: TilesKind | null;
  /** The location the link's tiles come from, resolved, `null` when it names neither. */
  tilesSource: string | null;
  context: LaunchContext;
  contentHosts: string[];
  /**
   * The files the tiles link, which the policy allows as images, video and
   * audio, and the links left out. `null` when "Load media linked by tiles"
   * was off as the mod started.
   */
  tileLinks: TileLinks | null;
  /** The bodies of the tiles the mod receives at launch, which "Reload tiles" replaces in the session. */
  tileBodies: TileBodies;
  /** The frame's Content-Security-Policy, which the frames of the mod's tests also get. */
  policy: string;
  /** The frame's `srcdoc` HTML. */
  sandboxDocument: string;
  /** Whether the mod's `api` range matches `MOD_API_VERSION`, `null` without a range. */
  apiCompatible: boolean | null;
  /** Issues of the mod file itself: the warning of a missing `api` range. */
  fileIssues: ModIssue[];
  /** Permission issues found before the mod starts. */
  issues: ModIssue[];
}

export interface ModLaunchRequest {
  link: RunLink;
  defaults: ResolvedDefaultModSettings;
}

/** What a launch is built from once loaded: the mod, the link and the link's tiles. Plain data. */
export interface ModLaunchInputs {
  mod: LoadedMod;
  link: RunLink;
  /** `null` when the link names no collection and no tile. */
  modTiles: ModTiles | null;
}

/**
 * The tiles a mod receives from a collection or a tile, and the collection's
 * issues. `tilesSource` is the collection's or the tile's source.
 */
export interface ModTiles {
  tilesSource: string;
  tiles: Tile[];
  issues: TileIssue[];
}

function keepTilesOfType(tiles: Tile[], typeName: string): Tile[] {
  const typedTiles: Tile[] = [];
  for (const tile of tiles) {
    if (tile.types.includes(typeName)) {
      typedTiles.push(tile);
    }
  }
  return typedTiles;
}

function resolveEveryTilePaths(tiles: Tile[]): Tile[] {
  const resolvedTiles: Tile[] = [];
  for (const tile of tiles) {
    resolvedTiles.push(resolveTilePaths(tile));
  }
  return resolvedTiles;
}

function buildModTiles(collection: TileCollection, tiles: Tile[]): ModTiles {
  const modTiles: ModTiles = {
    tilesSource: collection.source,
    tiles: resolveEveryTilePaths(tiles),
    issues: collection.issues,
  };
  return modTiles;
}

/**
 * Selects the tiles a mod receives from a loaded collection. With a tile
 * validator, the collection is validated with it and only the tiles of its
 * type are kept; the others appear as warnings in the issues. Without one,
 * every tile is kept. The kept tiles are new tiles whose metadata strings
 * starting with `./` or `../` are resolved against the tile's `source`
 * (`resolveTilePaths`); the collection's tiles stay as written, and are
 * validated as written.
 */
export function selectModTiles(
  collection: TileCollection,
  tileValidator: TileValidator | null,
): ModTiles {
  if (tileValidator === null) {
    return buildModTiles(collection, collection.tiles);
  }
  const validatedCollection = validateTileCollection(collection, tileValidator);
  const typedTiles = keepTilesOfType(
    validatedCollection.tiles,
    tileValidator.typeName,
  );
  return buildModTiles(validatedCollection, typedTiles);
}

/** Selects the tiles of a loaded collection with the mod's tile type, loading the type when the mod has one. */
async function selectLoadedModTiles(
  mod: LoadedMod,
  collection: TileCollection,
  options: FileFetchOptions,
): Promise<ModTiles> {
  if (mod.typeSource === null) {
    return selectModTiles(collection, null);
  }
  const tileValidator = await buildTileValidator(mod.typeSource, options);
  const modTiles = selectModTiles(collection, tileValidator);
  return modTiles;
}

/**
 * Loads a collection for a mod and selects its tiles with the mod's tile
 * type (`selectModTiles`). Load errors propagate.
 */
export async function loadModTiles(
  mod: LoadedMod,
  collectionLocation: string,
  options: FileFetchOptions = {},
): Promise<ModTiles> {
  const collection = await loadTileCollection(collectionLocation, options);
  return selectLoadedModTiles(mod, collection, options);
}

/** A collection of one tile, with the tile's source, no name and no issues. */
function buildSingleTileCollection(tile: Tile): TileCollection {
  const collection: TileCollection = {
    source: tile.source,
    name: "",
    description: "",
    tiles: [tile],
    issues: [],
  };
  return collection;
}

/**
 * Loads one tile for a mod, as a collection holding only that tile, and
 * selects it with the mod's tile type (`selectModTiles`): a tile of another
 * type gives no tiles and one warning. Load and parse errors propagate.
 */
export async function loadModTile(
  mod: LoadedMod,
  tileLocation: string,
  options: FileFetchOptions = {},
): Promise<ModTiles> {
  const tile = await loadTile(tileLocation, options);
  return selectLoadedModTiles(mod, buildSingleTileCollection(tile), options);
}

/** Loads the tiles of a collection or of a tile for a mod (`loadModTiles`, `loadModTile`). */
export function loadModTilesOfKind(
  mod: LoadedMod,
  kind: TilesKind,
  location: string,
  options: FileFetchOptions = {},
): Promise<ModTiles> {
  if (kind === "tile") {
    return loadModTile(mod, location, options);
  }
  return loadModTiles(mod, location, options);
}

function resolveLaunchSource(
  request: ModLaunchRequest,
  options: FileFetchOptions,
): string {
  const source = resolveModReference(request.link.mod, {
    baseUrl: options.baseUrl,
    defaultModsFolder: request.defaults.folder,
  });
  const switchedOffName = findSwitchedOffMod(source, request.defaults);
  if (switchedOffName !== null) {
    throw new ModSwitchedOffError(switchedOffName, source);
  }
  const hasTile = (request.link.tile ?? null) !== null;
  if (request.link.collection !== null && hasTile) {
    throw new RunLinkConflictError(source);
  }
  return source;
}

/** Whether a link's tiles come from a collection or a tile, `null` when it names neither. */
function readLinkTilesKind(link: RunLink): TilesKind | null {
  if (link.collection !== null) {
    return "collection";
  }
  if ((link.tile ?? null) !== null) {
    return "tile";
  }
  return null;
}

async function loadLinkTiles(
  mod: LoadedMod,
  link: RunLink,
  options: FileFetchOptions,
): Promise<ModTiles | null> {
  const kind = readLinkTilesKind(link);
  const location = link.collection ?? link.tile ?? null;
  if (kind === null || location === null) {
    return null;
  }
  return loadModTilesOfKind(mod, kind, location, options);
}

function listContentSources(
  mod: LoadedMod,
  modTiles: ModTiles | null,
): string[] {
  const sources = [mod.source, mod.entrypoint];
  if (mod.typeSource !== null) {
    sources.push(mod.typeSource);
  }
  if (modTiles !== null) {
    sources.push(modTiles.tilesSource);
    for (const tile of modTiles.tiles) {
      sources.push(tile.source);
    }
  }
  return sources;
}

function buildPermissionIssues(mod: LoadedMod, grants: ModGrants): ModIssue[] {
  const issues: ModIssue[] = [];
  for (const permission of grants.denied) {
    issues.push({
      level: "warning",
      source: mod.source,
      message: describeDeniedPermission(permission),
    });
  }
  return issues;
}

function buildFileIssues(mod: LoadedMod): ModIssue[] {
  const issues: ModIssue[] = [];
  if (mod.api === null) {
    issues.push({
      level: "warning",
      source: mod.source,
      message: describeMissingApiRange(),
    });
  }
  return issues;
}

function buildModContext(
  mod: LoadedMod,
  link: RunLink,
  modTiles: ModTiles | null,
  grants: ModGrants,
): LaunchContext {
  const context: LaunchContext = {
    mod: {
      source: mod.source,
      name: mod.name,
      title: mod.title,
      version: mod.version,
      description: mod.description,
    },
    api: { version: MOD_API_VERSION },
    config: structuredClone(mod.config),
    params: { ...link.params },
    tiles: modTiles === null ? [] : modTiles.tiles,
    issues: modTiles === null ? [] : modTiles.issues,
    permissions: grants,
  };
  return context;
}

function collectLaunchTileLinks(
  tiles: Tile[],
  tileBodies: TileBodies,
  contentHosts: string[],
  grants: ModGrants,
  loadsTileLinkedMedia: boolean,
): TileLinks | null {
  if (!loadsTileLinkedMedia) {
    return null;
  }
  const tileLinks = collectModTileLinks(
    tiles,
    tileBodies,
    contentHosts,
    grants.granted,
  );
  return tileLinks;
}

/**
 * Builds everything a loaded mod's frame needs from its tiles and its grants
 * (`grantModPermissions`): its policy, its frame document, its mount context
 * and its issues, and renders the bodies the tiles need collected
 * (`buildTileBodies`). With `loadsTileLinkedMedia`, the policy also allows
 * the files the tiles and their bodies link (`collectModTileLinks`); the
 * mount context does not list them. Requests nothing.
 */
export function buildModLaunch(
  mod: LoadedMod,
  link: RunLink,
  modTiles: ModTiles | null,
  grants: ModGrants,
  loadsTileLinkedMedia: boolean,
): ModLaunch {
  const contentHosts = collectContentHosts(listContentSources(mod, modTiles));
  const tiles = modTiles === null ? [] : modTiles.tiles;
  const tileBodies = buildTileBodies(tiles);
  const tileLinks = collectLaunchTileLinks(
    tiles,
    tileBodies,
    contentHosts,
    grants,
    loadsTileLinkedMedia,
  );
  const policy = buildSandboxPolicy(
    contentHosts,
    grants.granted,
    tileLinks === null ? [] : tileLinks.sources,
  );
  const launch: ModLaunch = {
    mod,
    tilesKind: modTiles === null ? null : readLinkTilesKind(link),
    tilesSource: modTiles === null ? null : modTiles.tilesSource,
    context: buildModContext(mod, link, modTiles, grants),
    contentHosts,
    tileLinks,
    tileBodies,
    policy,
    sandboxDocument: buildSandboxDocument(policy, mod.theme),
    apiCompatible: matchModApiRange(mod.api),
    fileIssues: buildFileIssues(mod),
    issues: buildPermissionIssues(mod, grants),
  };
  return launch;
}

/**
 * Builds the `srcdoc` HTML of a frame of the mod's tests: the policy and
 * theme styles of the launch's frame, with the test runner after the loader.
 */
export function buildModTestDocument(launch: ModLaunch): string {
  return buildSandboxDocument(launch.policy, launch.mod.theme, {
    testRunner: true,
  });
}

/**
 * Loads the mod of a launch: refuses a switched-off default mod and a link
 * with both a collection and a tile before any request, then loads the mod.
 * Every error propagates.
 */
export async function loadLaunchMod(
  request: ModLaunchRequest,
  options: ModLoadOptions,
): Promise<LoadedMod> {
  const source = resolveLaunchSource(request, options);
  return loadMod(source, options);
}

/**
 * Loads the rest of what a loaded mod's launch is built from: the link's
 * collection or tile, when it names one. Every error propagates.
 */
export async function loadLaunchTiles(
  mod: LoadedMod,
  link: RunLink,
  options: FileFetchOptions,
): Promise<ModLaunchInputs> {
  const modTiles = await loadLinkTiles(mod, link, options);
  const inputs: ModLaunchInputs = { mod, link, modTiles };
  return inputs;
}

/**
 * Loads what a mod's launch is built from: the mod (`loadLaunchMod`) and,
 * when the link names one, its collection or tile (`loadLaunchTiles`). A
 * link with both fails with `RunLinkConflictError` before any request. Every
 * error propagates. The launch itself is built later with `buildModLaunch`, once
 * the grants are known.
 */
export async function loadModLaunchInputs(
  request: ModLaunchRequest,
  options: FileFetchOptions,
): Promise<ModLaunchInputs> {
  const mod = await loadLaunchMod(request, options);
  return loadLaunchTiles(mod, request.link, options);
}
