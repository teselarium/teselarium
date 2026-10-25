import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeValue,
  expect as expectInCase,
  isDeepEqual,
  waitFor,
} from "./sandbox_assertions.js";

/** Calls `asserting` and returns the message of the error it throws. */
function catchAssertionMessage(asserting: () => void): string {
  try {
    asserting();
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    throw error;
  }
  throw new Error("Expected the assertion to fail, but it passed");
}

function expectListNotToContainThree(): void {
  expectInCase([1, 2]).not.toContain(3);
}

function expectSameValuesToBe(): void {
  const book = { title: "Kallocain" };
  expectInCase(2).toBe(2);
  expectInCase(book).toBe(book);
  expectInCase(Number.NaN).toBe(Number.NaN);
}

function expectNestedValuesToEqual(): void {
  expectInCase({ books: [{ title: "Kallocain", years: [1940] }] }).toEqual({
    books: [{ title: "Kallocain", years: [1940] }],
  });
}

function expectReorderedKeysToEqual(): void {
  expectInCase({ a: 1, b: { c: 2, d: 3 } }).toEqual({
    b: { d: 3, c: 2 },
    a: 1,
  });
}

function expectTextToContainPart(): void {
  expectInCase("Kallocain").toContain("lloc");
}

function expectListToContainEqualItem(): void {
  expectInCase([{ title: "Kallocain" }]).toContain({ title: "Kallocain" });
}

function expectTruthiness(): void {
  expectInCase(1).toBeTruthy();
  expectInCase(0).not.toBeTruthy();
}

function expectTwoToBeThree(): void {
  expectInCase(2).toBe(3);
}

function expectTwoNotToBeTwo(): void {
  expectInCase(2).not.toBe(2);
}

function expectListToEqualOther(): void {
  expectInCase([1, [2, 3]]).toEqual([1, [2, 4]]);
}

function expectEqualListsNotToEqual(): void {
  expectInCase([1, 2]).not.toEqual([1, 2]);
}

function expectTextToContainMissing(): void {
  expectInCase("Kallocain").toContain("Fictions");
}

function expectListToContainMissing(): void {
  expectInCase([{ title: "Kallocain" }]).toContain({ title: "Fictions" });
}

function expectListNotToContainItem(): void {
  expectInCase([1, 2]).not.toContain(2);
}

function expectCopyToBeOriginal(): void {
  expectInCase({ a: 1 }).toBe({ a: 1 });
}

function countItems(items: string[]): number {
  return items.length;
}

function findTitle(): Promise<string> {
  return Promise.resolve("Kallocain");
}

function expectZeroToBeTruthy(): void {
  expectInCase(0).toBeTruthy();
}

function expectOneNotToBeTruthy(): void {
  expectInCase(1).not.toBeTruthy();
}

function expectNumberToContain(): void {
  expectInCase(12).toContain(1);
}

function expectNumberNotToContain(): void {
  expectInCase(12).not.toContain(1);
}

describe("expect", function describeExpect(): void {
  it("Failing equality", function failsEquality(): void {
    const message = catchAssertionMessage(expectTwoToBeThree);

    expect(message).toContain("2");
    expect(message).toContain("3");
    expect(message).toBe("Expected 2 to be 3");
  });

  it("Negation", function passesNegation(): void {
    expect(expectListNotToContainThree).not.toThrow();
  });

  it("passes toBe for the same value", function passesToBe(): void {
    expect(expectSameValuesToBe).not.toThrow();
  });

  it("fails toBe for equal objects that are not the same", function failsToBeForCopies(): void {
    expect(catchAssertionMessage(expectCopyToBeOriginal)).toBe(
      'Expected {"a":1} to be {"a":1}',
    );
  });

  it("fails a negated toBe with both values", function failsNotToBe(): void {
    expect(catchAssertionMessage(expectTwoNotToBeTwo)).toBe(
      "Expected 2 not to be 2",
    );
  });

  it("passes toEqual for nested arrays and objects", function passesNested(): void {
    expect(expectNestedValuesToEqual).not.toThrow();
  });

  it("passes toEqual for values that differ only in key order", function ignoresKeyOrder(): void {
    expect(expectReorderedKeysToEqual).not.toThrow();
  });

  it("fails toEqual with both values", function failsToEqual(): void {
    expect(catchAssertionMessage(expectListToEqualOther)).toBe(
      "Expected [1,[2,3]] to equal [1,[2,4]]",
    );
  });

  it("fails a negated toEqual with both values", function failsNotToEqual(): void {
    expect(catchAssertionMessage(expectEqualListsNotToEqual)).toBe(
      "Expected [1,2] not to equal [1,2]",
    );
  });

  it("passes toContain for a substring", function containsSubstring(): void {
    expect(expectTextToContainPart).not.toThrow();
  });

  it("passes toContain for a list element compared by toEqual", function containsElement(): void {
    expect(expectListToContainEqualItem).not.toThrow();
  });

  it("fails toContain on a string with both values", function failsStringContain(): void {
    expect(catchAssertionMessage(expectTextToContainMissing)).toBe(
      'Expected "Kallocain" to contain "Fictions"',
    );
  });

  it("fails toContain on a list with both values", function failsListContain(): void {
    expect(catchAssertionMessage(expectListToContainMissing)).toBe(
      'Expected [{"title":"Kallocain"}] to contain {"title":"Fictions"}',
    );
  });

  it("fails a negated toContain with both values", function failsNotToContain(): void {
    expect(catchAssertionMessage(expectListNotToContainItem)).toBe(
      "Expected [1,2] not to contain 2",
    );
  });

  it("fails toContain on a value that is neither a string nor a list", function failsOnNumber(): void {
    const expected = "toContain needs a string or a list, but got 12";

    expect(catchAssertionMessage(expectNumberToContain)).toBe(expected);
    expect(catchAssertionMessage(expectNumberNotToContain)).toBe(expected);
  });

  it("passes toBeTruthy for a truthy value", function passesTruthy(): void {
    expect(expectTruthiness).not.toThrow();
  });

  it("fails toBeTruthy with the value", function failsTruthy(): void {
    expect(catchAssertionMessage(expectZeroToBeTruthy)).toBe(
      "Expected 0 to be truthy",
    );
    expect(catchAssertionMessage(expectOneNotToBeTruthy)).toBe(
      "Expected 1 not to be truthy",
    );
  });

  it("has the same matchers under not", function hasSameMatchers(): void {
    const expectation = expectInCase(1);

    expect(Object.keys(expectation).sort()).toEqual([
      "not",
      "toBe",
      "toBeTruthy",
      "toContain",
      "toEqual",
    ]);
    expect(Object.keys(expectation.not).sort()).toEqual([
      "toBe",
      "toBeTruthy",
      "toContain",
      "toEqual",
    ]);
  });
});

describe("isDeepEqual", function describeIsDeepEqual(): void {
  it("compares plain data by content", function comparesContent(): void {
    expect(isDeepEqual([1, { a: "x" }], [1, { a: "x" }])).toBe(true);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isDeepEqual([], {})).toBe(false);
    expect(isDeepEqual(null, {})).toBe(false);
    expect(isDeepEqual({ a: undefined }, {})).toBe(false);
  });
});

describe("describeValue", function describeDescribeValue(): void {
  it("describes each kind of value", function describesValues(): void {
    expect(describeValue("Kallocain")).toBe('"Kallocain"');
    expect(describeValue(3)).toBe("3");
    expect(describeValue(-0)).toBe("-0");
    expect(describeValue(Number.NaN)).toBe("NaN");
    expect(describeValue(undefined)).toBe("undefined");
    expect(describeValue(null)).toBe("null");
    expect(describeValue(10n)).toBe("10n");
    expect(describeValue({ a: [1] })).toBe('{"a":[1]}');
    expect(describeValue(describeValue)).toBe("function describeValue");
  });

  it("shortens long values", function shortensValues(): void {
    const description = describeValue("x".repeat(500));

    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith("…")).toBe(true);
  });

  it("describes a value that JSON cannot", function describesCycle(): void {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    expect(describeValue(cycle)).toBe("[object Object]");
  });
});

describe("waitFor", function describeWaitFor(): void {
  beforeEach(function useFakeTimers(): void {
    vi.useFakeTimers();
  });

  afterEach(function useRealTimers(): void {
    vi.useRealTimers();
  });

  it("Wait for the list", async function resolvesWhenTrue(): Promise<void> {
    const items: string[] = [];

    const waiting = waitFor(countItems.bind(undefined, items));
    await vi.advanceTimersByTimeAsync(100);
    items.push("Kallocain");
    await vi.advanceTimersByTimeAsync(50);

    await expect(waiting).resolves.toBe(1);
  });

  it("Waiting too long", async function rejectsAfterTimeout(): Promise<void> {
    const stayFalse = vi.fn<() => boolean>().mockReturnValue(false);
    const waiting = waitFor(stayFalse, 100);
    const settled = vi.fn<(error: unknown) => void>();
    waiting.catch(settled);

    await vi.advanceTimersByTimeAsync(99);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toHaveBeenCalledOnce();
    await expect(waiting).rejects.toThrow(
      "The condition was not met within 100 ms",
    );
  });

  it("names the last error the condition threw", async function namesLastError(): Promise<void> {
    const waiting = waitFor(expectTwoToBeThree, 100);
    waiting.catch(vi.fn<(error: unknown) => void>());

    await vi.advanceTimersByTimeAsync(100);

    await expect(waiting).rejects.toThrow(
      "The condition was not met within 100 ms. Last error: Expected 2 to be 3",
    );
  });

  it("waits 2000 ms by default", async function waitsByDefault(): Promise<void> {
    const stayFalse = vi.fn<() => boolean>().mockReturnValue(false);
    const waiting = waitFor(stayFalse);
    const settled = vi.fn<(error: unknown) => void>();
    waiting.catch(settled);

    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toHaveBeenCalledOnce();
    await expect(waiting).rejects.toThrow("within 2000 ms");
  });

  it("calls the condition every 50 ms", async function pollsCondition(): Promise<void> {
    const stayFalse = vi.fn<() => boolean>().mockReturnValue(false);
    const waiting = waitFor(stayFalse, 200);
    waiting.catch(vi.fn<(error: unknown) => void>());

    await vi.advanceTimersByTimeAsync(200);

    expect(stayFalse).toHaveBeenCalledTimes(5);
  });

  it("resolves with an async condition's value", async function awaitsCondition(): Promise<void> {
    await expect(waitFor(findTitle)).resolves.toBe("Kallocain");
  });
});
