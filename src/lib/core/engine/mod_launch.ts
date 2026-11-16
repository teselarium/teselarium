import type { FileFetchOptions, YamlMapping } from "../../files/index.ts";
import { loadMod, resolveModReference } from "../../mod/index.ts";
import type { LoadedMod, ModIssue, ModLoadOptions } from "../../mod/index.ts";
import {
  applyMosaicAliases,
  loadMosaicFile,
  mergeMosaicConfig,
  resolveMosaicReference,
} from "../../mosaic/index.ts";
import type { LoadedMosaic, MosaicAliases } from "../../mosaic/index.ts";
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
import {
  describeDeniedMosaicPermission,
  describeDeniedPermission,
  grantMosaicPermissions,
  joinGrants,
} from "../permissions/index.ts";
import type { ModGrants, SiteDecision } from "../permissions/index.ts";
import {
  buildSandboxDocument,
  buildSandboxPolicy,
  collectContentHosts,
} from "../sandbox/index.ts";
import type { TileLinks } from "../sandbox/index.ts";
import type { Theme } from "../theme/index.ts";
import { findSwitchedOffMod } from "./default_mod_settings.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import {
  ModSwitchedOffError,
  MosaicLinkConflictError,
  RunLinkConflictError,
} from "./engine_errors.ts";
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
 * link parameters, or a mosaic reference and the link parameters. Not an
 * address. `tile` and `mosaic` are optional so that links written without
 * them, such as sections' mod targets, stay valid; absent means `null`. A
 * mosaic link has an empty `mod`, a `null` collection and no tile: the mosaic
 * file names its mod and its collection.
 */
export interface RunLink {
  mod: string;
  collection: string | null;
  tile?: string | null;
  mosaic?: string | null;
  params: Record<string, string>;
}

/**
 * The link names the stage reads itself. They are never in a mod's `params`,
 * and `mods.open` and `mosaics.open` refuse them in theirs.
 */
export const RUN_LINK_RESERVED_NAMES: readonly string[] = [
  "mod",
  "collection",
  "tile",
  "mosaic",
];

/**
 * How wide a mod frame lays out its content: centered at the content width,
 * across the stage area (theater mode), or across the screen (fullscreen).
 */
export type FrameLayout = "contained" | "theater" | "fullscreen";

/** The mosaic a mod was opened from, as its mount context gives it. */
export interface LaunchMosaic {
  source: string;
  title: string;
  description: string;
}

/** What a mod receives as the second argument of `mount`. Plain data. */
export interface ModContext {
  mod: {
    source: string;
    name: string;
    title: string;
    version: string;
    description: string;
  };
  /** The mosaic the mod was opened from, `null` for a mod opened from a mod link. */
  mosaic: LaunchMosaic | null;
  /** The mod API the mod runs on. */
  api: {
    version: string;
  };
  /** The mod's config, merged with the mosaic's when the mod was opened from a mosaic. */
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
  /** The mosaic the mod was opened from, whose aliases "Reload tiles" applies again, or `null`. */
  mosaic: LoadedMosaic | null;
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

/**
 * The mosaic a launch was opened from, with the grants of its `show` lines
 * (`grantMosaicPermissions`), kept apart from the mod's grants so each
 * refused line is reported with what declared it.
 */
export interface LaunchMosaicGrants {
  mosaic: LoadedMosaic;
  grants: ModGrants;
}

/**
 * A launch's mosaic with the grants of its `show` lines by `decisions`
 * (`grantMosaicPermissions`), or `null` for a mod not opened from a mosaic.
 */
export function grantLaunchMosaic(
  mosaic: LoadedMosaic | null,
  appOrigin: string,
  decisions: readonly SiteDecision[],
): LaunchMosaicGrants | null {
  if (mosaic === null) {
    return null;
  }
  const mosaicGrants: LaunchMosaicGrants = {
    mosaic,
    grants: grantMosaicPermissions(mosaic, appOrigin, decisions),
  };
  return mosaicGrants;
}

export interface ModLaunchRequest {
  link: RunLink;
  defaults: ResolvedDefaultModSettings;
}

/**
 * What a launch is built from once loaded: the mod, the link and the link's
 * tiles, and the mosaic the link opened. For a mosaic, `link` is the link the
 * mosaic expands into (`expandMosaicRequest`). Plain data.
 */
export interface ModLaunchInputs {
  mod: LoadedMod;
  /** `null` when the link is not a mosaic link. */
  mosaic: LoadedMosaic | null;
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

/**
 * The collection with each tile's metadata renamed by a mosaic's aliases
 * (`applyMosaicAliases`). The tiles' `source`, `body` and `types` are kept.
 */
function aliasCollectionTiles(
  collection: TileCollection,
  aliases: MosaicAliases,
): TileCollection {
  const aliasedTiles: Tile[] = [];
  for (const tile of collection.tiles) {
    aliasedTiles.push({
      ...tile,
      metadata: applyMosaicAliases(tile.metadata, aliases),
    });
  }
  const aliasedCollection: TileCollection = {
    ...collection,
    tiles: aliasedTiles,
  };
  return aliasedCollection;
}

/**
 * Selects the tiles of a loaded collection with the mod's tile type, loading
 * the type when the mod has one. The tiles are renamed by `aliases` first, so
 * the type validates the renamed metadata.
 */
async function selectLoadedModTiles(
  mod: LoadedMod,
  collection: TileCollection,
  aliases: MosaicAliases,
  options: FileFetchOptions,
): Promise<ModTiles> {
  const aliasedCollection = aliasCollectionTiles(collection, aliases);
  if (mod.typeSource === null) {
    return selectModTiles(aliasedCollection, null);
  }
  const tileValidator = await buildTileValidator(mod.typeSource, options);
  const modTiles = selectModTiles(aliasedCollection, tileValidator);
  return modTiles;
}

/** No aliases: the tiles of a mod not opened from a mosaic keep their names. */
const NO_ALIASES: MosaicAliases = {};

/**
 * Loads a collection for a mod and selects its tiles with the mod's tile
 * type (`selectModTiles`), after renaming them by a mosaic's `aliases`. Load
 * errors propagate.
 */
export async function loadModTiles(
  mod: LoadedMod,
  collectionLocation: string,
  options: FileFetchOptions = {},
  aliases: MosaicAliases = NO_ALIASES,
): Promise<ModTiles> {
  const collection = await loadTileCollection(collectionLocation, options);
  return selectLoadedModTiles(mod, collection, aliases, options);
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
  return selectLoadedModTiles(
    mod,
    buildSingleTileCollection(tile),
    NO_ALIASES,
    options,
  );
}

/**
 * Loads the tiles of a collection or of a tile for a mod (`loadModTiles`,
 * `loadModTile`). A collection's tiles are renamed by a mosaic's `aliases`;
 * a mosaic never has a tile.
 */
export function loadModTilesOfKind(
  mod: LoadedMod,
  kind: TilesKind,
  location: string,
  options: FileFetchOptions = {},
  aliases: MosaicAliases = NO_ALIASES,
): Promise<ModTiles> {
  if (kind === "tile") {
    return loadModTile(mod, location, options);
  }
  return loadModTiles(mod, location, options, aliases);
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
  aliases: MosaicAliases,
  options: FileFetchOptions,
): Promise<ModTiles | null> {
  const kind = readLinkTilesKind(link);
  const location = link.collection ?? link.tile ?? null;
  if (kind === null || location === null) {
    return null;
  }
  return loadModTilesOfKind(mod, kind, location, options, aliases);
}

/** The aliases of a launch's mosaic, or none. */
export function readMosaicAliases(mosaic: LoadedMosaic | null): MosaicAliases {
  return mosaic === null ? NO_ALIASES : mosaic.aliases;
}

function listContentSources(
  mod: LoadedMod,
  mosaic: LoadedMosaic | null,
  modTiles: ModTiles | null,
): string[] {
  const sources = [mod.source, mod.entrypoint];
  if (mosaic !== null) {
    sources.unshift(mosaic.source);
  }
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

/** One warning per refused line: the mod's, then the mosaic's, each with what declared it as source. */
function buildPermissionIssues(
  mod: LoadedMod,
  grants: ModGrants,
  mosaic: LaunchMosaicGrants | null,
): ModIssue[] {
  const issues: ModIssue[] = [];
  for (const permission of grants.denied) {
    issues.push({
      level: "warning",
      source: mod.source,
      message: describeDeniedPermission(permission),
    });
  }
  if (mosaic === null) {
    return issues;
  }
  for (const permission of mosaic.grants.denied) {
    issues.push({
      level: "warning",
      source: mosaic.mosaic.source,
      message: describeDeniedMosaicPermission(permission, mosaic.mosaic.source),
    });
  }
  return issues;
}

/** The grants of the sandbox: the mod's lines, then the mosaic's. */
function joinLaunchGrants(
  grants: ModGrants,
  mosaic: LaunchMosaicGrants | null,
): ModGrants {
  if (mosaic === null) {
    return grants;
  }
  return joinGrants(grants, mosaic.grants);
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

function buildLaunchMosaic(mosaic: LoadedMosaic | null): LaunchMosaic | null {
  if (mosaic === null) {
    return null;
  }
  const launchMosaic: LaunchMosaic = {
    source: mosaic.source,
    title: mosaic.title,
    description: mosaic.description,
  };
  return launchMosaic;
}

/** The mod's config, merged with the mosaic's config (`mergeMosaicConfig`) for a mosaic. */
function buildLaunchConfig(
  mod: LoadedMod,
  mosaic: LoadedMosaic | null,
): YamlMapping {
  if (mosaic === null) {
    return structuredClone(mod.config);
  }
  return mergeMosaicConfig(mod.config, mosaic.config);
}

function buildModContext(
  mod: LoadedMod,
  mosaic: LoadedMosaic | null,
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
    mosaic: buildLaunchMosaic(mosaic),
    api: { version: MOD_API_VERSION },
    config: buildLaunchConfig(mod, mosaic),
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
 * mount context does not list them. For a mod opened from a mosaic, the
 * config is merged with the mosaic's, the mosaic file's origin is a content
 * host, and the mosaic's granted `show` lines join the mod's in the policy
 * and the mount context. Requests nothing.
 */
export function buildModLaunch(
  mod: LoadedMod,
  link: RunLink,
  modTiles: ModTiles | null,
  modGrants: ModGrants,
  loadsTileLinkedMedia: boolean,
  mosaicGrants: LaunchMosaicGrants | null = null,
): ModLaunch {
  const mosaic = mosaicGrants === null ? null : mosaicGrants.mosaic;
  const grants = joinLaunchGrants(modGrants, mosaicGrants);
  const contentHosts = collectContentHosts(
    listContentSources(mod, mosaic, modTiles),
  );
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
    mosaic,
    tilesKind: modTiles === null ? null : readLinkTilesKind(link),
    tilesSource: modTiles === null ? null : modTiles.tilesSource,
    context: buildModContext(mod, mosaic, link, modTiles, grants),
    contentHosts,
    tileLinks,
    tileBodies,
    policy,
    sandboxDocument: buildSandboxDocument(policy, mod.theme),
    apiCompatible: matchModApiRange(mod.api),
    fileIssues: buildFileIssues(mod),
    issues: buildPermissionIssues(mod, modGrants, mosaicGrants),
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
 * For a mosaic link, `request` is the expanded request (`expandMosaicRequest`).
 * Every error propagates.
 */
export async function loadLaunchMod(
  request: ModLaunchRequest,
  options: ModLoadOptions,
): Promise<LoadedMod> {
  const source = resolveLaunchSource(request, options);
  return loadMod(source, options);
}

/** The link's mosaic reference resolved against the app's address, or as written when it cannot be resolved. */
function resolveLinkMosaic(mosaic: string, options: FileFetchOptions): string {
  try {
    return resolveMosaicReference(mosaic, options.baseUrl);
  } catch {
    return mosaic;
  }
}

function hasLinkLocation(location: string | null | undefined): boolean {
  return location !== undefined && location !== null && location !== "";
}

/**
 * Loads the mosaic of a mosaic link, or gives `null` for a mod link. A link
 * with a mosaic and a mod, a collection or a tile fails with
 * `MosaicLinkConflictError` before any request. The mosaic's `mod` is
 * resolved with the default mods folder of `request`. Every error propagates.
 */
export async function loadLaunchMosaic(
  request: ModLaunchRequest,
  options: FileFetchOptions,
): Promise<LoadedMosaic | null> {
  const mosaic = request.link.mosaic ?? null;
  if (mosaic === null) {
    return null;
  }
  const link = request.link;
  if (
    link.mod !== "" ||
    hasLinkLocation(link.collection) ||
    hasLinkLocation(link.tile)
  ) {
    throw new MosaicLinkConflictError(resolveLinkMosaic(mosaic, options));
  }
  const loadedMosaic = await loadMosaicFile(mosaic, {
    ...options,
    defaultModsFolder: request.defaults.folder,
  });
  return loadedMosaic;
}

/**
 * The request a loaded mosaic expands into: a link to its mod with its
 * collection and the mosaic link's params, so the rest of the launch runs as
 * for a mod link. `request` itself is returned when `mosaic` is `null`.
 */
export function expandMosaicRequest(
  request: ModLaunchRequest,
  mosaic: LoadedMosaic | null,
): ModLaunchRequest {
  if (mosaic === null) {
    return request;
  }
  const expandedRequest: ModLaunchRequest = {
    link: {
      mod: mosaic.mod,
      collection: mosaic.collection,
      tile: null,
      params: { ...request.link.params },
    },
    defaults: request.defaults,
  };
  return expandedRequest;
}

/**
 * Loads the rest of what a loaded mod's launch is built from: the link's
 * collection or tile, when it names one, with the tiles renamed by the
 * `mosaic`'s aliases. Every error propagates.
 */
export async function loadLaunchTiles(
  mod: LoadedMod,
  link: RunLink,
  options: FileFetchOptions,
  mosaic: LoadedMosaic | null = null,
): Promise<ModLaunchInputs> {
  const modTiles = await loadLinkTiles(
    mod,
    link,
    readMosaicAliases(mosaic),
    options,
  );
  const inputs: ModLaunchInputs = { mod, mosaic, link, modTiles };
  return inputs;
}

/**
 * Loads what a mod's launch is built from: the mosaic of a mosaic link
 * (`loadLaunchMosaic`), the mod (`loadLaunchMod`) and, when the link or the
 * mosaic names one, its collection or tile (`loadLaunchTiles`). A link with
 * both a collection and a tile fails with `RunLinkConflictError`, and a
 * mosaic link with a mod, a collection or a tile with
 * `MosaicLinkConflictError`, before any request. Every error propagates. The
 * launch itself is built later with `buildModLaunch`, once the grants are
 * known.
 */
export async function loadModLaunchInputs(
  request: ModLaunchRequest,
  options: FileFetchOptions,
): Promise<ModLaunchInputs> {
  const mosaic = await loadLaunchMosaic(request, options);
  const launchRequest = expandMosaicRequest(request, mosaic);
  const mod = await loadLaunchMod(launchRequest, options);
  return loadLaunchTiles(mod, launchRequest.link, options, mosaic);
}
