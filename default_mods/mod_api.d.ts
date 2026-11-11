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

/** The second argument of `mount`. */
export interface ModContext {
  mod: {
    source: string;
    name: string;
    title: string;
    version: string;
    description: string;
  };
  api: {
    version: string;
  };
  config: ModYamlMapping;
  params: Record<string, string>;
  tiles: ModTile[];
  issues: ModTileIssue[];
  permissions: ModGrants;
  theme: ModTheme;
  /** The frame's layout when the frame connected. */
  layout: ModLayout;
}

/** What `mods.inspect` answers: a mod's metadata, without running it. */
export interface ModInspection {
  source: string;
  name: string;
  title: string;
  version: string;
  description: string;
  /** The mod's `api` range, or `null` when it declares none. */
  api: string | null;
  /** Whether `api` matches the app's mod API version, `null` without a range. */
  apiCompatible: boolean | null;
  typeSource: string | null;
  sampleCollection: string | null;
  testSource: string | null;
  config: ModYamlMapping;
  /** What the mod would get if it were opened. */
  permissions: ModGrants;
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

/** What `mods.check` answers. */
export interface ModCheckReport {
  source: string;
  status: "pass" | "warn" | "fail";
  mountChecked: boolean;
  testsChecked: boolean;
  tests: ModTestResult[];
  findings: ModCheckFinding[];
}

/** The params of `mods.open`. A missing `collection` runs the mod without tiles. */
export interface ModOpenParams {
  mod: string;
  collection?: string;
  params?: Record<string, string>;
}

/** The params of `mods.check`. A missing `collection` checks with the mod's sample collection. */
export interface ModCheckParams {
  mod: string;
  collection?: string;
}

/** The engine methods this file types: the params each one takes and the result it answers. */
export interface ModApiMethods {
  "mods.inspect": { params: { mod: string }; result: ModInspection };
  "mods.open": { params: ModOpenParams; result: null };
  "mods.check": { params: ModCheckParams; result: ModCheckReport };
}

/** The engine events this file types: the params each one pushes. */
export interface ModApiEvents {
  "layout.changed": ModLayoutChangedParams;
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
  "links.open" | "files.save" | "ui.confirm" | "players.open";

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
  answer(method: "mods.open", value: null): void;
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
