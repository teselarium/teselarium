import type { FileFetchOptions, YamlMapping } from "../../files/index.ts";
import { loadMod, resolveModReference } from "../../mod/index.ts";
import type { LoadedMod, ModIssue } from "../../mod/index.ts";
import {
  buildTileValidator,
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
import { ModSwitchedOffError } from "./engine_errors.ts";
import {
  describeMissingApiRange,
  matchModApiRange,
  MOD_API_VERSION,
} from "./mod_api_version.ts";
import { buildTileBodies, collectModTileLinks } from "./mod_tile_bodies.ts";
import type { TileBodies } from "./mod_tile_bodies.ts";
import { resolveTilePaths } from "./tile_paths.ts";

/** What to run: a mod reference, a collection location and the link parameters. Not an address. */
export interface RunLink {
  mod: string;
  collection: string | null;
  params: Record<string, string>;
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
}

/**
 * The mount context as built when the mod starts loading: everything but the
 * theme, which is only known when the frame connects.
 */
export type LaunchContext = Omit<ModContext, "theme">;

/** Everything needed to start a mod's frame. Plain data. */
export interface ModLaunch {
  mod: LoadedMod;
  collectionSource: string | null;
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
  /** `null` when the link names no collection. */
  modTiles: ModTiles | null;
}

/** The tiles a mod receives from a collection, and the collection's issues. */
export interface ModTiles {
  collectionSource: string;
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
    collectionSource: collection.source,
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
 * Loads a collection for a mod and selects its tiles with the mod's tile
 * type (`selectModTiles`). Load errors propagate.
 */
export async function loadModTiles(
  mod: LoadedMod,
  collectionLocation: string,
  options: FileFetchOptions = {},
): Promise<ModTiles> {
  const collection = await loadTileCollection(collectionLocation, options);
  if (mod.typeSource === null) {
    return selectModTiles(collection, null);
  }
  const tileValidator = await buildTileValidator(mod.typeSource, options);
  const modTiles = selectModTiles(collection, tileValidator);
  return modTiles;
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
  return source;
}

function loadLinkTiles(
  mod: LoadedMod,
  link: RunLink,
  options: FileFetchOptions,
): Promise<ModTiles> | null {
  if (link.collection === null) {
    return null;
  }
  return loadModTiles(mod, link.collection, options);
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
    sources.push(modTiles.collectionSource);
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
    collectionSource: modTiles === null ? null : modTiles.collectionSource,
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
 * Loads what a mod's launch is built from: refuses a switched-off default mod
 * before any request, loads the mod and, when the link names one, its
 * collection. Every error propagates. The launch itself is built later with
 * `buildModLaunch`, once the grants are known.
 */
export async function loadModLaunchInputs(
  request: ModLaunchRequest,
  options: FileFetchOptions,
): Promise<ModLaunchInputs> {
  const source = resolveLaunchSource(request, options);
  const mod = await loadMod(source, options);
  const modTiles = await loadLinkTiles(mod, request.link, options);
  const inputs: ModLaunchInputs = { mod, link: request.link, modTiles };
  return inputs;
}
