import { describe, expect, it } from "vitest";
import { SAMPLE_MOD_SOURCE } from "../../test/sample_mods.ts";
import { ModFormatError } from "./mod_errors.ts";

describe("ModFormatError", function describeModFormatError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new ModFormatError(
      SAMPLE_MOD_SOURCE,
      'a "mod" mapping is required',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ModFormatError);
    expect(error.name).toBe("ModFormatError");
  });

  it("exposes the source", function exposesSource(): void {
    const error = new ModFormatError(
      SAMPLE_MOD_SOURCE,
      'a "mod" mapping is required',
    );

    expect(error.source).toBe(SAMPLE_MOD_SOURCE);
  });

  it("builds the message from the source and the reason", function buildsMessage(): void {
    const error = new ModFormatError(
      SAMPLE_MOD_SOURCE,
      'a "mod" mapping is required',
    );

    expect(error.message).toBe(
      `Invalid mod "${SAMPLE_MOD_SOURCE}": a "mod" mapping is required`,
    );
  });

  it("keeps the cause when given", function keepsCause(): void {
    const formatError = new Error("not a mapping");

    const error = new ModFormatError(
      SAMPLE_MOD_SOURCE,
      'a "mod" mapping is required',
      { cause: formatError },
    );

    expect(error.cause).toBe(formatError);
  });
});
