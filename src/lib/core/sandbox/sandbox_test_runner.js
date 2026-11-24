// The test runner: lists the cases of a mod's test file, or runs one of them.
// Inlined after the frame loader and the assertions, in the same module
// script, only in the frames of a check's tests, so it shares their names
// and must never contain a closing script tag. It adds the `list` and
// `case` modes to the loader's `frameModes`.

const TESTS_LISTED_METHOD = "sandbox.testsListed";
const TESTS_FAILED_METHOD = "sandbox.testsFailed";
const ANSWER_QUEUED_METHOD = "sandbox.answerQueued";
const CASE_FINISHED_METHOD = "sandbox.caseFinished";

// The methods `answer` scripts, with the kind of answer each accepts.
const ANSWER_KINDS = {
  "links.open": "boolean",
  "files.save": "boolean",
  "ui.confirm": "boolean",
  "players.open": "boolean",
  "userCatalog.import": "boolean",
  "userCatalog.update": "boolean",
  "userCatalog.add": "boolean",
  "userCatalog.export": "boolean",
  "userCatalog.remove": "boolean",
  "userCatalog.history": "boolean",
  "userCatalog.exportFolder": "boolean",
  "userCatalog.save": "address",
  "mods.open": "null",
  "mosaics.open": "null",
  "catalog.list": "catalog",
};

// The lists of a scripted catalog, and whether their entries are mosaics,
// which may also have `defaultOf` and `provenance`.
const CATALOG_LISTS = { mods: false, collections: false, mosaics: true };

const CATALOG_LISTED_BY = ["instance", "default", "user"];
const CATALOG_PLACES = ["remote", "browser"];
const BROWSER_FILE_PROTOCOL = "teselarium-browser:";
// The keys of a scripted provenance: `addedAt` is required, and a missing
// one of the others is completed with its value here.
const PROVENANCE_DEFAULTS = {
  folder: null,
  path: null,
  updatedAt: null,
  changedSinceExport: false,
  copiedFrom: null,
};
const PROVENANCE_KEYS = ["addedAt", ...Object.keys(PROVENANCE_DEFAULTS)];

function isPlainMapping(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// `t.test(name, fn)`. A registration error is kept, so a test file that
// catches it still fails.
function registerCase(registry, name, fn) {
  const error = findRegistrationError(registry, name, fn);
  if (error !== null) {
    registry.error = registry.error ?? error;
    throw error;
  }
  registry.cases.set(name, fn);
}

function findRegistrationError(registry, name, fn) {
  if (registry.closed) {
    return new Error(
      "t.test was called after the test file registered its tests",
    );
  }
  if (typeof name !== "string" || name === "") {
    return new Error("t.test needs a non-empty name");
  }
  if (typeof fn !== "function") {
    return new Error(`t.test("${name}") needs a function`);
  }
  if (registry.cases.has(name)) {
    return new Error(`the test file registers the test "${name}" twice`);
  }
  return null;
}

// Imports the test file and calls its default export with `t`. Returns the
// cases by name, in the order they were registered.
async function registerCases(testCode) {
  const testModule = await importModCode(testCode);
  if (typeof testModule.default !== "function") {
    throw new Error("the test file has no default export function");
  }
  const registry = { cases: new Map(), error: null, closed: false };
  const t = Object.freeze({ test: registerCase.bind(undefined, registry) });
  await testModule.default(t);
  registry.closed = true;
  if (registry.error !== null) {
    throw registry.error;
  }
  if (registry.cases.size === 0) {
    throw new Error("the test file registers no test");
  }
  return registry.cases;
}

async function listCases(test) {
  const cases = await registerCases(test.code);
  sendNotification(TESTS_LISTED_METHOD, { names: Array.from(cases.keys()) });
}

function reportListFailure(error) {
  sendNotification(TESTS_FAILED_METHOD, { message: describeError(error) });
}

function startListMode(params) {
  listCases(params.test).catch(reportListFailure);
}

function describeResponseError(error) {
  const responseError = {
    code: typeof error?.code === "number" ? error.code : null,
    message: describeError(error),
  };
  return responseError;
}

// The mod's requests, each recorded with its result or error once it settles.
async function requestRecorded(requests, method, params) {
  const entry = { method, params: params ?? {} };
  requests.push(entry);
  try {
    const result = await requestEngine(method, params);
    entry.result = result;
    return result;
  } catch (error) {
    entry.error = describeResponseError(error);
    throw error;
  }
}

function buildRecordingEngine(requests) {
  const recordingEngine = Object.freeze({
    request: requestRecorded.bind(undefined, requests),
    on: onEngineEvent,
  });
  return recordingEngine;
}

function isStringMapping(value) {
  if (!isPlainMapping(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (typeof value[key] !== "string") {
      return false;
    }
  }
  return true;
}

// A mount context's `collection`: `null`, or `{ source, title, description }` with strings.
function isMountCollection(value) {
  if (value === null) {
    return true;
  }
  return (
    isPlainMapping(value) &&
    typeof value.source === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
}

function checkMountOptions(options) {
  if (options === undefined) {
    return;
  }
  if (!isPlainMapping(options)) {
    throw new Error("mount: the options must be a mapping");
  }
  if (options.tiles !== undefined && !Array.isArray(options.tiles)) {
    throw new Error('mount: "tiles" must be a list');
  }
  if (options.config !== undefined && !isPlainMapping(options.config)) {
    throw new Error('mount: "config" must be a mapping');
  }
  if (options.params !== undefined && !isStringMapping(options.params)) {
    throw new Error('mount: "params" must be a mapping of strings');
  }
  if (
    options.collection !== undefined &&
    !isMountCollection(options.collection)
  ) {
    throw new Error(
      'mount: "collection" must be a mapping with string "source", "title" and "description", or null',
    );
  }
}

// The case's `collection`, `null` included, or else the check's.
function readCaseCollection(context, mountOptions) {
  if (mountOptions.collection === undefined) {
    return context.collection;
  }
  return mountOptions.collection;
}

// A copy of the check's mount context, with the case's tiles, config keys,
// params and collection.
function buildCaseMountContext(context, options) {
  const mountOptions = options ?? {};
  const caseMountContext = {
    ...context,
    tiles: mountOptions.tiles ?? context.tiles,
    config: { ...context.config, ...mountOptions.config },
    params: mountOptions.params ?? context.params,
    collection: readCaseCollection(context, mountOptions),
  };
  return caseMountContext;
}

// `mount(options)`: mounts the mod as the loader does, but a failure rejects
// the call instead of being sent as `sandbox.mountFailed`.
async function mountInCase(caseState, options) {
  if (caseState.mounted) {
    throw new Error("the mod is already mounted");
  }
  checkMountOptions(options);
  caseState.mounted = true;
  const mountContext = buildCaseMountContext(caseState.context, options);
  const modModule = await importModCode(caseState.code);
  if (typeof modModule.default !== "function") {
    throw new Error("the entrypoint has no default export function");
  }
  loader.mounted = true;
  await modModule.default(
    buildRecordingEngine(caseState.requests),
    mountContext,
  );
}

function getCaseValue(key) {
  return requestEngine("storage.get", { key });
}

function setCaseValue(key, value) {
  return requestEngine("storage.set", { key, value });
}

function isNonEmptyText(value) {
  return typeof value === "string" && value !== "";
}

function throwNotCatalog(reason) {
  throw new Error(`the answer to catalog.list must be a catalog: ${reason}`);
}

// A mosaic entry's `defaultOf`: `null`, or `{ source, title }` with non-empty strings.
function readCatalogMark(mark, label) {
  if (mark === undefined || mark === null) {
    return null;
  }
  if (
    !isPlainMapping(mark) ||
    !isNonEmptyText(mark.source) ||
    !isNonEmptyText(mark.title) ||
    Object.keys(mark).length !== 2
  ) {
    throwNotCatalog(
      `"${label}.defaultOf" must be null or { source, title } with non-empty strings`,
    );
  }
  const readMark = { source: mark.source, title: mark.title };
  return readMark;
}

function isTextOrNull(value) {
  return value === null || typeof value === "string";
}

function hasKnownKeys(mapping, keys) {
  for (const key of Object.keys(mapping)) {
    if (!keys.includes(key)) {
      return false;
    }
  }
  return true;
}

// A scripted provenance, completed with `PROVENANCE_DEFAULTS`.
function completeProvenance(provenance) {
  const completed = { addedAt: provenance.addedAt };
  for (const [key, defaultValue] of Object.entries(PROVENANCE_DEFAULTS)) {
    completed[key] = Object.hasOwn(provenance, key)
      ? provenance[key]
      : defaultValue;
  }
  return completed;
}

function hasProvenanceShape(provenance) {
  const hasShape =
    isNonEmptyText(provenance.addedAt) &&
    isTextOrNull(provenance.folder) &&
    isTextOrNull(provenance.path) &&
    isTextOrNull(provenance.updatedAt) &&
    isTextOrNull(provenance.copiedFrom) &&
    typeof provenance.changedSinceExport === "boolean";
  return hasShape;
}

// A mosaic entry's `provenance`: `null`, or `{ folder, path, addedAt,
// updatedAt, changedSinceExport, copiedFrom }`, completed from the keys the
// case gave.
function readCatalogProvenance(provenance, label) {
  if (provenance === undefined || provenance === null) {
    return null;
  }
  if (
    !isPlainMapping(provenance) ||
    !hasKnownKeys(provenance, PROVENANCE_KEYS) ||
    !hasProvenanceShape(completeProvenance(provenance))
  ) {
    throwNotCatalog(
      `"${label}.provenance" must be null or a mapping with a non-empty "addedAt", "folder", "path", "updatedAt" and "copiedFrom" strings or null, and a boolean "changedSinceExport"`,
    );
  }
  const readProvenance = completeProvenance(provenance);
  return readProvenance;
}

function describeChoices(allowed) {
  const quoted = [];
  for (const choice of allowed) {
    quoted.push(`"${choice}"`);
  }
  return quoted.join(" or ");
}

// One of `allowed`, or the default when it is missing.
function readCatalogChoice(value, allowed, defaultValue, label) {
  if (value === undefined) {
    return defaultValue;
  }
  if (!allowed.includes(value)) {
    throwNotCatalog(`"${label}" must be ${describeChoices(allowed)}`);
  }
  return value;
}

function readDefaultPlace(source) {
  if (source.startsWith(BROWSER_FILE_PROTOCOL)) {
    return "browser";
  }
  return "remote";
}

function readDefaultListedBy(defaultOf, provenance) {
  if (defaultOf !== null) {
    return "default";
  }
  if (provenance !== null) {
    return "user";
  }
  return "instance";
}

function checkCatalogKeys(entry, label, isMosaic) {
  const keys = isMosaic
    ? ["source", "listedBy", "place", "defaultOf", "provenance"]
    : ["source", "listedBy", "place"];
  if (!isPlainMapping(entry) || !isNonEmptyText(entry.source)) {
    throwNotCatalog(`"${label}" must be a mapping with a non-empty "source"`);
  }
  for (const key of Object.keys(entry)) {
    if (!keys.includes(key)) {
      throwNotCatalog(`"${label}" has the unknown key "${key}"`);
    }
  }
}

// An entry in its complete form, with its missing marks completed.
function readCatalogEntry(entry, label, isMosaic) {
  checkCatalogKeys(entry, label, isMosaic);
  const defaultOf = isMosaic ? readCatalogMark(entry.defaultOf, label) : null;
  const provenance = isMosaic
    ? readCatalogProvenance(entry.provenance, label)
    : null;
  const marks = {
    source: entry.source,
    listedBy: readCatalogChoice(
      entry.listedBy,
      CATALOG_LISTED_BY,
      readDefaultListedBy(defaultOf, provenance),
      `${label}.listedBy`,
    ),
    place: readCatalogChoice(
      entry.place,
      CATALOG_PLACES,
      readDefaultPlace(entry.source),
      `${label}.place`,
    ),
  };
  if (!isMosaic) {
    return marks;
  }
  const readMosaic = { ...marks, defaultOf, provenance };
  return readMosaic;
}

function readCatalogList(entries, listName, isMosaic) {
  if (entries === undefined) {
    const emptyList = [];
    return emptyList;
  }
  if (!Array.isArray(entries)) {
    throwNotCatalog(`"${listName}" must be a list`);
  }
  const readEntries = [];
  for (const [index, entry] of entries.entries()) {
    readEntries.push(
      readCatalogEntry(entry, `${listName}[${index}]`, isMosaic),
    );
  }
  return readEntries;
}

// The scripted catalog in its complete form: a missing list is empty, and
// missing marks are completed. Throws naming the first key that is wrong.
function readCatalogAnswer(value) {
  if (!isPlainMapping(value)) {
    throwNotCatalog(`got ${describeValue(value)}`);
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(CATALOG_LISTS, key)) {
      throwNotCatalog(`the unknown key "${key}"`);
    }
  }
  const catalog = {};
  for (const [listName, isMosaic] of Object.entries(CATALOG_LISTS)) {
    catalog[listName] = readCatalogList(value[listName], listName, isMosaic);
  }
  return catalog;
}

function isAddressOrNull(value) {
  return value === null || isNonEmptyText(value);
}

// Checks an answer, and returns the value the engine queues.
function checkAnswer(method, value) {
  if (typeof method !== "string" || !Object.hasOwn(ANSWER_KINDS, method)) {
    throw new Error(
      `answer: ${describeValue(method)} cannot be answered, only links.open, files.save, ui.confirm, players.open, the userCatalog.* requests, mods.open, mosaics.open and catalog.list`,
    );
  }
  if (ANSWER_KINDS[method] === "catalog") {
    return readCatalogAnswer(value);
  }
  if (ANSWER_KINDS[method] === "null" && value !== null) {
    throw new Error(`the answer to ${method} must be null`);
  }
  if (ANSWER_KINDS[method] === "boolean" && typeof value !== "boolean") {
    throw new Error(`the answer to ${method} must be a boolean`);
  }
  if (ANSWER_KINDS[method] === "address" && !isAddressOrNull(value)) {
    throw new Error(`the answer to ${method} must be a mosaic address or null`);
  }
  return value;
}

// `answer(method, value)`: the engine queues it for the next request for `method`.
function queueAnswer(method, value) {
  const queuedValue = checkAnswer(method, value);
  sendNotification(ANSWER_QUEUED_METHOD, { method, value: queuedValue });
}

function buildCaseContext(params) {
  const caseState = {
    code: params.code,
    context: params.context,
    mounted: false,
    requests: [],
  };
  const caseContext = Object.freeze({
    mount: mountInCase.bind(undefined, caseState),
    root: document.body,
    tiles: params.context.tiles,
    storage: Object.freeze({ get: getCaseValue, set: setCaseValue }),
    requests: caseState.requests,
    answer: queueAnswer,
    expect,
    waitFor,
  });
  return caseContext;
}

async function runCase(params) {
  const cases = await registerCases(params.test.code);
  const caseName = params.test.caseName;
  if (!cases.has(caseName)) {
    throw new Error(`the test file no longer registers the test "${caseName}"`);
  }
  const caseFunction = cases.get(caseName);
  await caseFunction(buildCaseContext(params));
}

// The browser fires `securitypolicyviolation` as a task of its own, after
// the promise of the blocked load rejected, so the case reports its end one
// task later: the blocked requests it made are reported first.
function sendCaseFinished(status, message) {
  setTimeout(sendNotification, 0, CASE_FINISHED_METHOD, { status, message });
}

function reportCasePassed() {
  sendCaseFinished("pass", null);
}

function reportCaseFailed(error) {
  sendCaseFinished("fail", describeError(error));
}

function startCaseMode(params) {
  runCase(params).then(reportCasePassed, reportCaseFailed);
}

frameModes.list = startListMode;
frameModes.case = startCaseMode;
