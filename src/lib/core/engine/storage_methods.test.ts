import { describe, expect, it } from "vitest";
import { createFullStorage } from "../../../test/memory_storage.ts";
import { buildMethodContext } from "../../../test/method_contexts.ts";
import { ModMethodError } from "./engine_errors.ts";
import { INVALID_PARAMS, STORAGE_FAILED } from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";
import { STORAGE_METHODS } from "./storage_methods.ts";

const SELECTED_VALUE = {
  source: "https://example.org/samples/tiles/books/kallocain.md",
};

function getValue(context: ModMethodContext, params: object): Promise<unknown> {
  return STORAGE_METHODS["storage.get"](context, params as never);
}

function setValue(context: ModMethodContext, params: object): Promise<unknown> {
  return STORAGE_METHODS["storage.set"](context, params as never);
}

async function catchMethodError(
  calling: Promise<unknown>,
): Promise<ModMethodError> {
  try {
    await calling;
  } catch (error) {
    if (error instanceof ModMethodError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the request to fail, but it passed");
}

describe("storage methods", function describeStorageMethods(): void {
  it("Store and read a value", async function storesValue(): Promise<void> {
    const context = buildMethodContext([]);

    const setResult = await setValue(context, {
      key: "selected",
      value: SELECTED_VALUE,
    });
    const value = await getValue(context, { key: "selected" });

    expect(setResult).toBeNull();
    expect(value).toEqual(SELECTED_VALUE);
  });

  it("Missing key", async function readsMissingKey(): Promise<void> {
    const context = buildMethodContext([]);

    expect(await getValue(context, { key: "selected" })).toBeNull();
  });

  it("Remove a value", async function removesValue(): Promise<void> {
    const context = buildMethodContext([]);
    await setValue(context, { key: "selected", value: "kallocain" });

    await setValue(context, { key: "selected", value: null });

    expect(await getValue(context, { key: "selected" })).toBeNull();
  });

  it("Wrong params", async function rejectsWrongKey(): Promise<void> {
    const context = buildMethodContext([]);

    const error = await catchMethodError(getValue(context, { key: 3 }));

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('storage.get: "key" must be a non-empty string');
  });

  it("rejects an empty key for storage.set", async function rejectsEmptyKey(): Promise<void> {
    const context = buildMethodContext([]);

    const error = await catchMethodError(
      setValue(context, { key: "", value: 1 }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toContain("storage.set");
  });

  it("Value that is not plain data", async function rejectsDate(): Promise<void> {
    const context = buildMethodContext([]);

    const error = await catchMethodError(
      setValue(context, { key: "selected", value: new Date() }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toContain('storage.set: "value" must be plain data');
  });

  it("rejects values that are not plain data at any depth", async function rejectsNestedValues(): Promise<void> {
    const context = buildMethodContext([]);
    const cyclicValue: Record<string, unknown> = {};
    cyclicValue.self = cyclicValue;
    const values = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      [1, new Map()],
      { nested: { at: new Date() } },
      cyclicValue,
    ];

    for (const value of values) {
      const error = await catchMethodError(
        setValue(context, { key: "selected", value }),
      );
      expect(error.code).toBe(INVALID_PARAMS);
    }
  });

  it("accepts nested plain data", async function acceptsNestedData(): Promise<void> {
    const context = buildMethodContext([]);
    const value = {
      list: [1, "two", true, null, { deep: [] }],
      empty: Object.create(null) as object,
    };

    await setValue(context, { key: "selected", value });

    expect(await getValue(context, { key: "selected" })).toEqual({
      list: [1, "two", true, null, { deep: [] }],
      empty: {},
    });
  });

  it("Storage fails", async function reportsStorageError(): Promise<void> {
    const context = buildMethodContext([]);
    context.storage = createFullStorage();

    const error = await catchMethodError(
      setValue(context, { key: "selected", value: "kallocain" }),
    );

    expect(error.code).toBe(STORAGE_FAILED);
    expect(error.message).toBe("The quota has been exceeded.");
  });
});
