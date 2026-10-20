import type { YamlMapping, YamlValue } from "../../files/index.ts";
import { readModValue, writeModValue } from "../storage/index.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
import { STORAGE_FAILED } from "./mod_messages.ts";
import { readRequiredText, throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

function isPlainScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isPlainList(list: unknown[], ancestors: Set<object>): boolean {
  for (const item of list) {
    if (!isPlainData(item, ancestors)) {
      return false;
    }
  }
  return true;
}

function isPlainMapping(mapping: object, ancestors: Set<object>): boolean {
  const prototype: unknown = Object.getPrototypeOf(mapping);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  return isPlainList(Object.values(mapping), ancestors);
}

/**
 * Plain data: null, strings, booleans, finite numbers, and lists and mappings
 * of plain data. `ancestors` holds the lists and mappings being checked, so a
 * value that contains itself is not plain data.
 */
function isPlainData(value: unknown, ancestors: Set<object>): boolean {
  if (isPlainScalar(value)) {
    return true;
  }
  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    return false;
  }
  ancestors.add(value);
  const isPlain = Array.isArray(value)
    ? isPlainList(value, ancestors)
    : isPlainMapping(value, ancestors);
  ancestors.delete(value);
  return isPlain;
}

function readStorageValue(params: YamlMapping, method: string): YamlValue {
  const value: unknown = params.value;
  if (!isPlainData(value, new Set())) {
    throwInvalidParams(
      method,
      '"value" must be plain data: strings, finite numbers, booleans, null, lists and mappings',
    );
  }
  return value as YamlValue;
}

function throwStorageFailed(error: unknown): never {
  throw new ModMethodError(STORAGE_FAILED, describeEngineError(error), {
    cause: error,
  });
}

/** `storage.get { key }`: the value stored under `key` in the mod's slot, or `null`. */
async function getStorageValue(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<YamlValue | null> {
  const key = readRequiredText(params, "key", "storage.get");
  try {
    const value = readModValue(context.storage, context.mod.source, key);
    return value;
  } catch (error) {
    throwStorageFailed(error);
  }
}

/** `storage.set { key, value }`: stores the value and answers `null`. Storing `null` removes the key. */
async function setStorageValue(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<null> {
  const key = readRequiredText(params, "key", "storage.set");
  const value = readStorageValue(params, "storage.set");
  try {
    writeModValue(context.storage, context.mod.source, key, value);
  } catch (error) {
    throwStorageFailed(error);
  }
  return null;
}

/** The `storage.*` requests: each mod's own slot, keyed by its source. */
export const STORAGE_METHODS: ModMethodTable = {
  "storage.get": getStorageValue,
  "storage.set": setStorageValue,
};
