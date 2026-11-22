// The parts of the mod API that the default mods use, typed for their
// TypeScript source (docs/mod_plugin_spec.md). The mods import it with
// `import type`, so nothing of it reaches their bundles.
//
// It imports nothing, so it can be read, and later published, by itself.
// src/lib/core/engine/mod_api_types.test.ts checks that the engine's own
// types still fit these declarations.

/** A YAML value: plain data. */
export type ModYamlValue =
  | string
  | number
  | boolean
  | null
  | ModYamlValue[]
  | { [key: string]: ModYamlValue };

/** A YAML mapping, such as a mod's `config` or a tile's metadata. */
export type ModYamlMapping = { [key: string]: ModYamlValue };

/** What a permission lets a mod reach. */
export type ModPermissionCategory =
  "show" | "connect" | "embed" | "code" | "open";

/** A declared permission, with `host` as written in the mod file. */
export interface ModPermission {
  category: ModPermissionCategory;
  host: string;
  reason: string;
}

/** What a mod gets of the permissions it declares. */
export interface ModGrants {
  granted: ModPermission[];
  denied: ModPermission[];
}

/** A tile: its source, its frontmatter, its body and the tile types it was validated against. */
export interface ModTile {
  source: string;
  metadata: ModYamlMapping;
  body: string;
  types: string[];
}

/** How serious an issue or a finding is. */
export type ModIssueLevel = "warning" | "error";

/** A problem found while loading or validating the tiles. */
export interface ModTileIssue {
  level: ModIssueLevel;
  source: string;
  message: string;
}

/** The theme the mod is drawn in. */
export interface ModTheme {
  colorScheme: "light" | "dark";
  tokens: Record<string, string>;
}

/**
 * How wide the mod's frame lays out its content: `contained` (the body at
 * most `--ot-content-width`, centered), `theater` (the whole stage area) or
 * `fullscreen` (the whole screen).
 */
export type ModLayout = "contained" | "theater" | "fullscreen";

/** The params of `layout.changed`. */
export interface ModLayoutChangedParams {
  layout: ModLayout;
}

/** The mosaic a mod was opened from, as its mount context gives it. */
export interface ModContextMosaic {
  source: string;
  title: string;
  description: string;
}

/** The collection a mod's tiles were loaded from, as its mount context gives it. */
export interface ModContextCollection {
  source: string;
  title: string;
  description: string;
}

/** The second argument of `mount`. */
export interface ModContext {
  mod: {
    source: string;
    title: string;
    version: string;
    description: string;
  };
  /** The mosaic the mod was opened from, or `null` for a mod opened from a mod link. */
  mosaic: ModContextMosaic | null;
  /**
   * The collection the mod's tiles were loaded from, or `null` for a mod
   * opened with a tile or without a collection. A mod opened from a mosaic
   * gets the mosaic's collection.
   */
  collection: ModContextCollection | null;
  api: {
    version: string;
  };
  /** The mod's config, merged with the mosaic's for a mod opened from a mosaic. */
  config: ModYamlMapping;
  params: Record<string, string>;
  tiles: ModTile[];
  issues: ModTileIssue[];
  permissions: ModGrants;
  theme: ModTheme;
  /** The frame's layout when the frame connected. */
  layout: ModLayout;
}

/** A file of a library a mod declares: its path as declared, its address and how the frame uses it. */
export interface ModLibraryFile {
  path: string;
  source: string;
  kind: "script" | "style" | "data";
}

/** A library a mod declares. `package` and `version` are `null` for files next to the mod. */
export interface ModLibrary {
  name: string;
  package: string | null;
  version: string | null;
  files: ModLibraryFile[];
}

/** What `mods.inspect` answers: a mod's metadata, without running it. */
export interface ModInspection {
  source: string;
  title: string;
  version: string;
  description: string;
  /** The mod's `api` range, or `null` when it declares none. */
  api: string | null;
  /** Whether `api` matches the app's mod API version, `null` without a range. */
  apiCompatible: boolean | null;
  typeSource: string | null;
  /** The address of the mod's default mosaic file, or `null`. It is not fetched. */
  defaultMosaic: string | null;
  testSource: string | null;
  config: ModYamlMapping;
  /** The libraries the mod declares, with the address of each file. */
  libraries: ModLibrary[];
  /** What the mod would get if it were opened. */
  permissions: ModGrants;
}

/**
 * What `collections.inspect` answers: a collection's index, read without
 * loading any tile.
 */
export interface CollectionInspection {
  source: string;
  /** The collection file's `title`. */
  title: string;
  /** Empty when the collection file has none. */
  description: string;
  /** The resolved address of each tile entry, in entry order, a repeated tile once. */
  tiles: string[];
  /** The entry issues, found before any tile request. */
  issues: ModTileIssue[];
}

/**
 * What `mosaics.inspect` answers: a mosaic file's content, read without
 * requesting its mod, its collection or any tile.
 */
export interface MosaicInspection {
  source: string;
  title: string;
  description: string;
  /** The resolved address of the mosaic's mod file. */
  mod: string;
  /** The resolved address of the mosaic's collection file, or `null`. */
  collection: string | null;
  /** The mosaic's own config, which the mod's config is merged with when it opens. */
  config: ModYamlMapping;
  /** For each field of the mod's tile type, the names a collection uses for it. */
  aliases: Record<string, string[]>;
  /** What the mosaic's `show` lines would get if it were opened without asking. */
  permissions: ModGrants;
  /** The mosaic file's text, as read, comments included. */
  content: string;
}

/** An error or a warning of a draft, at its 1-based line, or `null`. */
export interface MosaicDraftProblem {
  message: string;
  line: number | null;
}

/** What `mosaics.validate` answers: a draft's problems, and the hints for its aliases. */
export interface MosaicDraftValidation {
  errors: MosaicDraftProblem[];
  warnings: MosaicDraftProblem[];
  /** The mod's tile type's fields, in the type's order. */
  typeFields: { name: string; required: boolean }[];
  /** The metadata keys the collection's tiles use, sorted. */
  collectionFields: string[];
  /** How many tiles match after the draft's aliases, or `null` without a collection or with errors. */
  tiles: { matching: number; total: number } | null;
  /** The fields the draft holds as written, or `null` when its text cannot be read. */
  draft: MosaicDraftFields | null;
}

/** The fields a draft holds as written. A text is `null` when it is missing or not a string. */
export interface MosaicDraftFields {
  title: string | null;
  description: string | null;
  mod: string | null;
  collection: string | null;
  /** The draft's own config, `{}` when it has none. */
  config: ModYamlMapping;
  aliases: Record<string, string[]>;
  show: MosaicShowLine[];
}

/** The params of `mosaics.validate`: a draft's text, and the address it will be saved at, absent for a new mosaic. */
export interface MosaicValidateParams {
  content: string;
  mosaic?: string;
}

/** A `show` line of a draft. */
export interface MosaicShowLine {
  host: string;
  reason: string;
}

/** The form's edits of a draft. `null` removes a key, as do an empty `aliases` and an empty `show`. */
export interface MosaicDraftEdits {
  title?: string;
  description?: string | null;
  mod?: string;
  collection?: string | null;
  aliases?: Record<string, string[]>;
  show?: MosaicShowLine[];
}

/** The params of `mosaics.edit`. */
export interface MosaicEditParams {
  content: string;
  edits: MosaicDraftEdits;
}

/** Who listed a catalog entry: the instance catalog, a mod as its default mosaic, or the user. */
export type CatalogListedBy = "instance" | "default" | "user";

/** Where a catalog entry's file lives: `"browser"` for an `opentesela-browser:` address, `"remote"` for any other. */
export type CatalogPlace = "remote" | "browser";

/**
 * Where a user mosaic came from. A stored one has the picked folder's name,
 * or `null` for a single file, and its path inside the folder or its file
 * name. One added by URL has `null` for both. Times are ISO 8601 strings in UTC.
 */
export interface CatalogProvenance {
  folder: string | null;
  path: string | null;
  addedAt: string;
  updatedAt: string | null;
  /** Whether a stored mosaic's text differs from the text it was last imported, updated from a file or exported with. `false` for a remote one. */
  changedSinceExport: boolean;
  /** The address a saved copy was copied from, or `null`. */
  copiedFrom: string | null;
}

/** A mod or collection of the catalog: the resolved address of its file, who listed it and where it lives. */
export interface CatalogEntry {
  source: string;
  listedBy: CatalogListedBy;
  place: CatalogPlace;
}

/**
 * A mosaic of the catalog. `defaultOf` is the mod whose default mosaic it is,
 * or `null`. `provenance` is `null` unless `listedBy` is `"user"`.
 */
export interface CatalogMosaicEntry {
  source: string;
  listedBy: CatalogListedBy;
  place: CatalogPlace;
  defaultOf: { source: string; title: string } | null;
  provenance: CatalogProvenance | null;
}

/** What `catalog.list` answers and `catalog.changed` pushes: the catalog, each list in catalog order. */
export interface Catalog {
  mods: CatalogEntry[];
  collections: CatalogEntry[];
  mosaics: CatalogMosaicEntry[];
}

/** A problem found by a mod check. */
export interface ModCheckFinding {
  step: "bundle" | "mount" | "test";
  level: ModIssueLevel;
  source: string;
  message: string;
}

/** The result of one test case. `message` is `null` for a passing case. */
export interface ModTestResult {
  name: string;
  status: "pass" | "fail";
  message: string | null;
}

/** What `mods.check` and `mosaics.check` answer. */
export interface ModCheckReport {
  /** The checked mod file's address, or `null` when a mosaic check failed before its mod was known. */
  source: string | null;
  /** The address of the mosaic file the check used, or `null` when it used none. */
  mosaic: string | null;
  status: "pass" | "warn" | "fail";
  mountChecked: boolean;
  testsChecked: boolean;
  tests: ModTestResult[];
  findings: ModCheckFinding[];
}

/** The params of `mods.open`. A missing `collection` runs the mod without tiles. */
export interface ModOpenParams {
  mod: string;
  /** A collection location. A link has a collection or a tile, not both. */
  collection?: string;
  /** The location of one tile file, which the opened mod receives as its tiles. */
  tile?: string;
  /** Parameters other than `mod`, `collection`, `tile`, `mosaic` and `sites`, which are reserved. */
  params?: Record<string, string>;
  /** Opens the mod in place of the requesting sandbox, which is closed and gets no answer. */
  replace?: boolean;
}

/** The params of `mosaics.open`. The mosaic file names the mod and the collection. */
export interface MosaicOpenParams {
  /** A mosaic reference: the mosaic file, or a folder holding `mosaic.yaml`. */
  mosaic: string;
  /** Parameters other than `mod`, `collection`, `tile`, `mosaic` and `sites`, which are reserved. */
  params?: Record<string, string>;
  /** Opens the mosaic in place of the requesting sandbox, which is closed and gets no answer. */
  replace?: boolean;
}

/** The params of `mods.check`. A missing `collection` checks the mod with its default mosaic. */
export interface ModCheckParams {
  mod: string;
  collection?: string;
}

/** The engine methods this file types: the params each one takes and the result it answers. */
export interface ModApiMethods {
  "mods.inspect": { params: { mod: string }; result: ModInspection };
  "mods.open": { params: ModOpenParams; result: null };
  "mods.check": { params: ModCheckParams; result: ModCheckReport };
  "collections.inspect": {
    params: { collection: string };
    result: CollectionInspection;
  };
  "mosaics.inspect": { params: { mosaic: string }; result: MosaicInspection };
  "mosaics.open": { params: MosaicOpenParams; result: null };
  "mosaics.check": { params: { mosaic: string }; result: ModCheckReport };
  "mosaics.validate": {
    params: MosaicValidateParams;
    result: MosaicDraftValidation;
  };
  "mosaics.edit": { params: MosaicEditParams; result: { content: string } };
  "catalog.list": { params: Record<string, never>; result: Catalog };
  "userCatalog.import": { params: Record<string, never>; result: boolean };
  "userCatalog.update": { params: { mosaic: string }; result: boolean };
  "userCatalog.add": { params: { mosaic?: string }; result: boolean };
  "userCatalog.export": { params: { mosaic: string }; result: boolean };
  "userCatalog.remove": { params: { mosaic: string }; result: boolean };
  "userCatalog.save": {
    params: { content: string; mosaic?: string; copiedFrom?: string };
    result: string | null;
  };
  "userCatalog.history": { params: { mosaic: string }; result: boolean };
  "userCatalog.exportFolder": { params: { folder: string }; result: boolean };
}

/** The engine events this file types: the params each one pushes. */
export interface ModApiEvents {
  "layout.changed": ModLayoutChangedParams;
  "catalog.changed": Catalog;
}

/** An error the engine answers a request with. `code` is the JSON-RPC error code. */
export interface ModRequestError extends Error {
  code: number;
}

/** The first argument of `mount`: the mod's only way to reach the app. */
export interface ModEngine {
  request<Method extends keyof ModApiMethods>(
    method: Method,
    params: ModApiMethods[Method]["params"],
  ): Promise<ModApiMethods[Method]["result"]>;
  /** The methods this file does not type. */
  request(method: string, params?: ModYamlMapping): Promise<unknown>;
  on<Event extends keyof ModApiEvents>(
    event: Event,
    handler: (params: ModApiEvents[Event]) => void,
  ): void;
  /** The events this file does not type. */
  on(event: string, handler: (params: unknown) => void): void;
}

/** The default export of a mod's entrypoint. */
export type ModMount = (
  engine: ModEngine,
  context: ModContext,
) => void | Promise<void>;

/** The matchers of `expect(actual)`, or of its `not`. */
export interface CaseMatchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(item: unknown): void;
  toBeTruthy(): void;
}

/** What `expect(actual)` returns. */
export interface CaseExpectation extends CaseMatchers {
  not: CaseMatchers;
}

/** What a case's `mount` takes: replacements for the check's tiles, config keys and params. */
export interface CaseMountOptions {
  tiles?: ModTile[];
  config?: ModYamlMapping;
  params?: Record<string, string>;
  /** Replaces the context's `collection`, `null` included; without it, the check's is kept. */
  collection?: ModContextCollection | null;
}

/** A request the mod sent during a case, with its result or error once it settled. */
export interface CaseRequest {
  method: string;
  params: ModYamlMapping;
  result?: unknown;
  error?: { code: number | null; message: string };
}

/** The case's throwaway storage slot. */
export interface CaseStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: ModYamlValue): Promise<unknown>;
}

/** The methods whose next request a case can answer with a boolean. */
export type CaseBooleanAnswerMethod =
  | "links.open"
  | "files.save"
  | "ui.confirm"
  | "players.open"
  | "userCatalog.import"
  | "userCatalog.update"
  | "userCatalog.add"
  | "userCatalog.export"
  | "userCatalog.remove"
  | "userCatalog.history"
  | "userCatalog.exportFolder";

/** A catalog entry a case answers with: a missing mark is completed. */
export interface CaseCatalogEntry {
  source: string;
  listedBy?: CatalogListedBy;
  place?: CatalogPlace;
}

/**
 * A provenance a case answers with: a missing `folder`, `path`, `updatedAt`
 * or `copiedFrom` is `null`, and a missing `changedSinceExport` is `false`.
 */
export interface CaseCatalogProvenance {
  addedAt: string;
  folder?: string | null;
  path?: string | null;
  updatedAt?: string | null;
  changedSinceExport?: boolean;
  copiedFrom?: string | null;
}

/** A catalog mosaic a case answers with: a missing mark is completed. */
export interface CaseCatalogMosaicEntry extends CaseCatalogEntry {
  defaultOf?: CatalogMosaicEntry["defaultOf"];
  provenance?: CaseCatalogProvenance | null;
}

/**
 * A catalog a case answers `catalog.list` with: missing lists are empty. A
 * missing `listedBy` is `"default"` for a mosaic with a `defaultOf`, `"user"`
 * for one with a `provenance`, and `"instance"` otherwise. A missing `place`
 * is `"browser"` for an `opentesela-browser:` source and `"remote"`
 * otherwise. A missing `defaultOf` or `provenance` is `null`, and a
 * provenance is completed as `CaseCatalogProvenance` says.
 */
export interface CaseCatalogAnswer {
  mods?: CaseCatalogEntry[];
  collections?: CaseCatalogEntry[];
  mosaics?: CaseCatalogMosaicEntry[];
}

/** The values of `Value` that are truthy, which `waitFor` resolves with. */
export type CaseTruthy<Value> = Exclude<
  Value,
  null | undefined | false | 0 | 0n | ""
>;

/** What a case function receives. */
export interface CaseContext {
  mount(options?: CaseMountOptions): Promise<void>;
  /** The frame's body, where the mod draws. */
  root: HTMLElement;
  tiles: ModTile[];
  storage: CaseStorage;
  requests: readonly CaseRequest[];
  answer(method: CaseBooleanAnswerMethod, value: boolean): void;
  answer(method: "mods.open" | "mosaics.open", value: null): void;
  /** The saved mosaic's address, or `null` for a save the user cancelled. */
  answer(method: "userCatalog.save", value: string | null): void;
  answer(method: "catalog.list", value: CaseCatalogAnswer): void;
  expect(actual: unknown): CaseExpectation;
  /** Resolves with the first truthy value `fn` returns. */
  waitFor<Value>(
    fn: () => Value | Promise<Value>,
    timeout?: number,
  ): Promise<CaseTruthy<Value>>;
}

/** A test case: a function of the case context. */
export type CaseFunction = (context: CaseContext) => void | Promise<void>;

/** `t`, which the test file's default export receives. */
export interface ModTestRegistration {
  test(name: string, fn: CaseFunction): void;
}

/** The default export of a mod's test file. */
export type ModTestFile = (t: ModTestRegistration) => void | Promise<void>;
