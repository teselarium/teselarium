import { describe, expect, it } from "vitest";
import { limitFetch } from "./fetch_limit.ts";

/** A request held until the test settles it. */
interface HeldRequest {
  url: string;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
}

/** A fake `fetch` that holds each request, and counts the pending ones. */
interface HeldFetch {
  held: HeldRequest[];
  pending: number;
  maxPending: number;
}

function holdRequest(
  state: HeldFetch,
  url: string,
  resolve: (response: Response) => void,
  reject: (error: Error) => void,
): void {
  state.held.push({ url, resolve, reject });
}

function markSettled(state: HeldFetch): void {
  state.pending -= 1;
}

function fetchHeld(
  state: HeldFetch,
  input: RequestInfo | URL,
): Promise<Response> {
  state.pending += 1;
  state.maxPending = Math.max(state.maxPending, state.pending);
  const url = String(input);
  const request = new Promise<Response>(
    holdRequest.bind(undefined, state, url),
  );
  void request.then(
    markSettled.bind(undefined, state),
    markSettled.bind(undefined, state),
  );
  return request;
}

function readText(response: Response): Promise<string> {
  return response.text();
}

function readMessage(error: Error): string {
  return error.message;
}

/** Lets the queue start what the settled requests freed. */
async function flushPromises(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await Promise.resolve();
  }
}

describe("limitFetch", function describeLimitFetch(): void {
  it("keeps at most 6 of 20 requests pending, and settles each with its own response or error", async function limitsRequests(): Promise<void> {
    const state: HeldFetch = { held: [], pending: 0, maxPending: 0 };
    const limitedFetch = limitFetch(fetchHeld.bind(undefined, state), 6);
    const results: Promise<string>[] = [];
    for (let index = 0; index < 20; index += 1) {
      const response = limitedFetch(`https://example.org/${index}`);
      results.push(response.then(readText, readMessage));
    }
    await flushPromises();
    expect(state.held).toHaveLength(6);

    let settled = 0;
    while (settled < state.held.length) {
      const request = state.held[settled];
      if (settled % 2 === 0) {
        request.resolve(new Response(`body of ${request.url}`));
      } else {
        request.reject(new Error(`failed ${request.url}`));
      }
      settled += 1;
      await flushPromises();
      expect(state.pending).toBeLessThanOrEqual(6);
    }

    const texts = await Promise.all(results);
    expect(state.held).toHaveLength(20);
    expect(state.maxPending).toBe(6);
    for (let index = 0; index < 20; index += 1) {
      const url = `https://example.org/${index}`;
      expect(texts[index]).toBe(
        index % 2 === 0 ? `body of ${url}` : `failed ${url}`,
      );
    }
  });
});
