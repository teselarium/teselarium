// The assertions of a mod's test cases: `expect` and `waitFor`. Inlined
// after the frame loader, in the same module script, only in the frames of a
// check's tests, so it must never contain a closing script tag. Its
// functions are exported for Vitest; nothing in the frame imports them.

const MAX_VALUE_DESCRIPTION_LENGTH = 200;
const WAIT_INTERVAL_MS = 50;
const DEFAULT_WAIT_TIMEOUT_MS = 2000;

function isMapping(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function areListsEqual(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (!isDeepEqual(actual[index], expected[index])) {
      return false;
    }
  }
  return true;
}

function areMappingsEqual(actual, expected) {
  const actualKeys = Object.keys(actual);
  if (actualKeys.length !== Object.keys(expected).length) {
    return false;
  }
  for (const key of actualKeys) {
    if (!Object.hasOwn(expected, key)) {
      return false;
    }
    if (!isDeepEqual(actual[key], expected[key])) {
      return false;
    }
  }
  return true;
}

/** Whether two values of plain data are equal by content: lists by their items in order, mappings by their keys in any order. */
export function isDeepEqual(actual, expected) {
  if (Object.is(actual, expected)) {
    return true;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return areListsEqual(actual, expected);
  }
  if (isMapping(actual) && isMapping(expected)) {
    return areMappingsEqual(actual, expected);
  }
  return false;
}

function describeObject(value) {
  try {
    const text = JSON.stringify(value);
    if (text !== undefined) {
      return text;
    }
  } catch {
    // A cycle or a BigInt inside: fall back to the plain string.
  }
  return String(value);
}

function describeFullValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Object.is(value, -0)) {
    return "-0";
  }
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  if (typeof value === "function") {
    return `function ${value.name}`;
  }
  if (typeof value === "object" && value !== null) {
    return describeObject(value);
  }
  return String(value);
}

/** The text that names a value in a failure message, at most 200 characters. */
export function describeValue(value) {
  const description = describeFullValue(value);
  if (description.length <= MAX_VALUE_DESCRIPTION_LENGTH) {
    return description;
  }
  const shortDescription = `${description.slice(0, MAX_VALUE_DESCRIPTION_LENGTH - 1)}…`;
  return shortDescription;
}

function buildExpectationMessage(actual, negated, verb, expectedText) {
  const negation = negated ? "not " : "";
  const message = `Expected ${describeValue(actual)} ${negation}${verb}${expectedText}`;
  return message;
}

function checkExpectation(isMet, negated, message) {
  if (isMet === negated) {
    throw new Error(message);
  }
}

function matchToBe(actual, negated, expected) {
  checkExpectation(
    Object.is(actual, expected),
    negated,
    buildExpectationMessage(actual, negated, "to be ", describeValue(expected)),
  );
}

function matchToEqual(actual, negated, expected) {
  checkExpectation(
    isDeepEqual(actual, expected),
    negated,
    buildExpectationMessage(
      actual,
      negated,
      "to equal ",
      describeValue(expected),
    ),
  );
}

function listContains(list, item) {
  for (const element of list) {
    if (isDeepEqual(element, item)) {
      return true;
    }
  }
  return false;
}

function readContains(actual, item) {
  if (typeof actual === "string") {
    return typeof item === "string" && actual.includes(item);
  }
  if (Array.isArray(actual)) {
    return listContains(actual, item);
  }
  throw new Error(
    `toContain needs a string or a list, but got ${describeValue(actual)}`,
  );
}

function matchToContain(actual, negated, item) {
  checkExpectation(
    readContains(actual, item),
    negated,
    buildExpectationMessage(
      actual,
      negated,
      "to contain ",
      describeValue(item),
    ),
  );
}

function matchToBeTruthy(actual, negated) {
  checkExpectation(
    Boolean(actual),
    negated,
    buildExpectationMessage(actual, negated, "to be truthy", ""),
  );
}

function buildMatchers(actual, negated) {
  const matchers = {
    toBe: matchToBe.bind(undefined, actual, negated),
    toEqual: matchToEqual.bind(undefined, actual, negated),
    toContain: matchToContain.bind(undefined, actual, negated),
    toBeTruthy: matchToBeTruthy.bind(undefined, actual, negated),
  };
  return matchers;
}

/**
 * The matchers on `actual`: `toBe` by `Object.is`, `toEqual` by deep
 * equality, `toContain` for a substring or a list item, and `toBeTruthy`.
 * Each throws an error naming both values when it fails. `not` has the same
 * matchers with the opposite result.
 */
export function expect(actual) {
  const expectation = buildMatchers(actual, false);
  expectation.not = buildMatchers(actual, true);
  return expectation;
}

function pauseFor(milliseconds) {
  const pause = Promise.withResolvers();
  setTimeout(pause.resolve, milliseconds);
  return pause.promise;
}

async function attemptCondition(fn) {
  try {
    const value = await fn();
    const attempt = { value, error: null, threw: false };
    return attempt;
  } catch (error) {
    const failedAttempt = { value: undefined, error, threw: true };
    return failedAttempt;
  }
}

function isConditionMet(attempt) {
  return !attempt.threw && Boolean(attempt.value);
}

function describeWaitError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return describeValue(error);
}

function buildWaitError(timeout, lastFailure) {
  const message = `The condition was not met within ${timeout} ms`;
  if (lastFailure === null) {
    return new Error(message);
  }
  const errorMessage = `${message}. Last error: ${describeWaitError(lastFailure.error)}`;
  return new Error(errorMessage, { cause: lastFailure.error });
}

/**
 * Calls `fn` every 50 milliseconds until it returns a truthy value without
 * throwing, and resolves with that value. Rejects when `timeout`
 * milliseconds pass first, with the last error `fn` threw, if any.
 */
export async function waitFor(fn, timeout = DEFAULT_WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeout;
  let lastFailure = null;
  let attempt = await attemptCondition(fn);
  while (!isConditionMet(attempt)) {
    if (attempt.threw) {
      lastFailure = attempt;
    }
    if (Date.now() >= deadline) {
      throw buildWaitError(timeout, lastFailure);
    }
    await pauseFor(WAIT_INTERVAL_MS);
    attempt = await attemptCondition(fn);
  }
  return attempt.value;
}
