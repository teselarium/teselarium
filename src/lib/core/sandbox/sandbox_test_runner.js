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
  "mods.open": "null",
};

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
}

// A copy of the check's mount context, with the case's tiles, config keys and params.
function buildCaseMountContext(context, options) {
  const mountOptions = options ?? {};
  const caseMountContext = {
    ...context,
    tiles: mountOptions.tiles ?? context.tiles,
    config: { ...context.config, ...mountOptions.config },
    params: mountOptions.params ?? context.params,
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

function checkAnswer(method, value) {
  if (typeof method !== "string" || !Object.hasOwn(ANSWER_KINDS, method)) {
    throw new Error(
      `answer: ${describeValue(method)} cannot be answered, only links.open, files.save, ui.confirm, players.open and mods.open`,
    );
  }
  if (ANSWER_KINDS[method] === "null" && value !== null) {
    throw new Error(`the answer to ${method} must be null`);
  }
  if (ANSWER_KINDS[method] === "boolean" && typeof value !== "boolean") {
    throw new Error(`the answer to ${method} must be a boolean`);
  }
}

// `answer(method, value)`: the engine queues it for the next request for `method`.
function queueAnswer(method, value) {
  checkAnswer(method, value);
  sendNotification(ANSWER_QUEUED_METHOD, { method, value });
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
