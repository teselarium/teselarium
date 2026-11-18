import { afterEach, describe, expect, it, vi } from "vitest";
import gt from "semver/functions/gt.js";
import { createFakeFrame, readModPort } from "../../../test/fake_frames.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOSAIC_REFERENCE,
  TEST_DEFAULTS,
} from "../../../test/sample_mods.ts";
import { fetchTestFile } from "../../../test/test_files.ts";
import { MOD_FILE_KEYS, PERMISSION_CATEGORIES } from "../../mod/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { AppAction } from "./app_actions.ts";
import { MOD_API_VERSION } from "./mod_api_version.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import {
  readEmptyCatalog,
  readNoSiteDecisions,
} from "../../../test/method_contexts.ts";
import { launchTestMod } from "../../../test/test_launches.ts";
import type { RunLink } from "./mod_launch.ts";
import type {
  ModCheckRequest,
  OpenLinkOptions,
  OpenLinkOutcome,
  UserNotification,
} from "./mod_methods.ts";
import {
  CATALOG_CHANGED_METHOD,
  connectModSession,
  ENGINE_METHODS,
  LAYOUT_CHANGED_METHOD,
  THEME_CHANGED_METHOD,
  TILES_CHANGED_METHOD,
} from "./mod_session.ts";

/** What a mod relies on, by name. Every list is sorted. */
interface ModApiSurface {
  methods: string[];
  events: string[];
  /** The mount context's keys. */
  contextKeys: string[];
  /**
   * The keys of the mount context's fixed mappings. `mosaic`, added in
   * `0.1.13`, is read from a mod opened from a mosaic, since it is `null`
   * otherwise.
   */
  contextMappingKeys: {
    mod: string[];
    mosaic?: string[];
    api: string[];
    permissions: string[];
    theme: string[];
  };
  /** The keys of the `mod` mapping of a mod file. */
  modFileKeys: string[];
  permissionCategories: string[];
}

/**
 * The surface of each mod API version. A change to the surface bumps
 * `MOD_API_VERSION` and adds an entry here for the new version; older entries
 * are never edited, so the record shows how the API grew. See "Mod API
 * version" in docs/modules/lib/core/engine/README.md.
 */
const SURFACE_BY_VERSION: Record<string, ModApiSurface> = {
  "0.1.0": {
    methods: [
      "files.save",
      "links.open",
      "mods.inspect",
      "mods.open",
      "storage.get",
      "storage.set",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.1": {
    methods: [
      "files.save",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "storage.get",
      "storage.set",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.2": {
    methods: [
      "files.save",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "storage.get",
      "storage.set",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.3": {
    methods: [
      "files.save",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "storage.get",
      "storage.set",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.4": {
    methods: [
      "files.save",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "storage.get",
      "storage.set",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.5": {
    methods: [
      "files.save",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.6": {
    methods: [
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.7": {
    methods: [
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.8": {
    methods: [
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.9": {
    methods: [
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["layout.changed", "theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.10": {
    methods: [
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["layout.changed", "theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "libraries",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.11": {
    methods: [
      "collections.inspect",
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["layout.changed", "theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "libraries",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.12": {
    methods: [
      "collections.inspect",
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["layout.changed", "theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "libraries",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.13": {
    methods: [
      "collections.inspect",
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "mosaics.inspect",
      "mosaics.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["layout.changed", "theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "mosaic",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "name", "source", "title", "version"],
      mosaic: ["description", "source", "title"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "description",
      "entrypoint",
      "libraries",
      "name",
      "permissions",
      "sample_collection",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.14": {
    methods: [
      "collections.inspect",
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "mosaics.check",
      "mosaics.inspect",
      "mosaics.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: ["layout.changed", "theme.changed", "tiles.changed"],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "mosaic",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "source", "title", "version"],
      mosaic: ["description", "source", "title"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "default_mosaic",
      "description",
      "entrypoint",
      "libraries",
      "permissions",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
  "0.1.15": {
    methods: [
      "catalog.list",
      "collections.inspect",
      "files.save",
      "libs.load",
      "links.open",
      "mods.check",
      "mods.inspect",
      "mods.open",
      "mosaics.check",
      "mosaics.inspect",
      "mosaics.open",
      "players.open",
      "storage.get",
      "storage.set",
      "tiles.renderBody",
      "ui.confirm",
      "ui.notify",
    ],
    events: [
      "catalog.changed",
      "layout.changed",
      "theme.changed",
      "tiles.changed",
    ],
    contextKeys: [
      "api",
      "config",
      "issues",
      "layout",
      "mod",
      "mosaic",
      "params",
      "permissions",
      "theme",
      "tiles",
    ],
    contextMappingKeys: {
      mod: ["description", "source", "title", "version"],
      mosaic: ["description", "source", "title"],
      api: ["version"],
      permissions: ["denied", "granted"],
      theme: ["colorScheme", "tokens"],
    },
    modFileKeys: [
      "api",
      "config",
      "default_mosaic",
      "description",
      "entrypoint",
      "libraries",
      "permissions",
      "test_path",
      "theme",
      "title",
      "type_path",
      "version",
    ],
    permissionCategories: ["code", "connect", "embed", "open", "show"],
  },
};

const BUMP_RULE = `The mod API surface does not match the entry of MOD_API_VERSION (${MOD_API_VERSION}). Bump MOD_API_VERSION in mod_api_version.ts as "Mod API version" in docs/modules/lib/core/engine/README.md says (while it is 0.x, a breaking change bumps the minor version, an addition or a fix the patch version), and add an entry for the new version to SURFACE_BY_VERSION`;

const openPorts: MessagePort[] = [];

afterEach(function closePorts(): void {
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

function listSortedKeys(mapping: object): string[] {
  const keys = Object.keys(mapping).sort();
  return keys;
}

/** The link of the sample mod with the sample collection. */
const SAMPLE_LINK: RunLink = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: SAMPLE_COLLECTION_REFERENCE,
  params: {},
};

/** The link of the fixture mosaic of the sample mod and collection. */
const SAMPLE_MOSAIC_LINK: RunLink = {
  mod: "",
  collection: null,
  mosaic: SAMPLE_MOSAIC_REFERENCE,
  params: {},
};

/** The mount context the mod of `link` receives in its `sandbox.connect`. */
async function readSampleMountContext(
  link: RunLink,
): Promise<Record<string, object>> {
  const launch = await launchTestMod(link);
  const fakeFrame = createFakeFrame();
  const session = connectModSession(fakeFrame.target, launch, {
    storage: createMemoryStorage(),
    appOrigin: APP_ORIGIN,
    defaults: TEST_DEFAULTS,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
    readSiteDecisions: readNoSiteDecisions,
    readCatalog: readEmptyCatalog,
    onIssue: vi.fn<(issue: ModIssue) => void>(),
    onOpenLink:
      vi.fn<(link: RunLink, options: OpenLinkOptions) => OpenLinkOutcome>(),
    onRequestAction: vi.fn<(action: AppAction) => Promise<boolean> | null>(),
    onCheckMod:
      vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>(),
    onNotify: vi.fn<(notification: UserNotification) => void>(),
    theme: buildTheme("light"),
    layout: "contained",
  });
  openPorts.push(session.port, readModPort(fakeFrame));
  const connect = fakeFrame.posted[0].message as {
    params: { context: Record<string, object> };
  };
  return connect.params.context;
}

/** The surface built from the code. */
async function buildCurrentSurface(): Promise<ModApiSurface> {
  const context = await readSampleMountContext(SAMPLE_LINK);
  const mosaicContext = await readSampleMountContext(SAMPLE_MOSAIC_LINK);
  const surface: ModApiSurface = {
    methods: listSortedKeys(ENGINE_METHODS),
    events: [
      CATALOG_CHANGED_METHOD,
      LAYOUT_CHANGED_METHOD,
      THEME_CHANGED_METHOD,
      TILES_CHANGED_METHOD,
    ].sort(),
    contextKeys: listSortedKeys(context),
    contextMappingKeys: {
      mod: listSortedKeys(context.mod),
      mosaic: listSortedKeys(mosaicContext.mosaic),
      api: listSortedKeys(context.api),
      permissions: listSortedKeys(context.permissions),
      theme: listSortedKeys(context.theme),
    },
    modFileKeys: [...MOD_FILE_KEYS].sort(),
    permissionCategories: [...PERMISSION_CATEGORIES].sort(),
  };
  return surface;
}

function listVersionsAbove(version: string): string[] {
  const versions: string[] = [];
  for (const recordedVersion of Object.keys(SURFACE_BY_VERSION)) {
    if (gt(recordedVersion, version)) {
      versions.push(recordedVersion);
    }
  }
  return versions;
}

describe("mod API surface", function describeModApiSurface(): void {
  it("matches the entry of MOD_API_VERSION", async function matchesEntry(): Promise<void> {
    const surface = await buildCurrentSurface();

    // The failure names the bump rule, with the assertion's diff as its cause.
    try {
      expect(surface).toEqual(SURFACE_BY_VERSION[MOD_API_VERSION]);
    } catch (error) {
      throw new Error(`${BUMP_RULE}. ${String(error)}`, { cause: error });
    }
  });

  it("records no version above MOD_API_VERSION", function isHighest(): void {
    expect(listVersionsAbove(MOD_API_VERSION)).toEqual([]);
  });
});
