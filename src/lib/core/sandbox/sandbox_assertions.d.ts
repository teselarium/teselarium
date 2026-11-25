// The types of `sandbox_assertions.js` for the tests that import it. The
// script itself runs only in the frames of a check's tests.

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

export function isDeepEqual(actual: unknown, expected: unknown): boolean;

export function describeValue(value: unknown): string;

export function expect(actual: unknown): CaseExpectation;

export function waitFor<Value>(
  fn: () => Value | Promise<Value>,
  timeout?: number,
): Promise<Value>;
