/** A `fetch` as the file loaders take it. */
export type FetchFunction = typeof globalThis.fetch;

/** The requests of a limited `fetch`: how many are pending, and those waiting for a slot. Mutable. */
interface FetchQueue {
  fetch: FetchFunction;
  limit: number;
  pending: number;
  waiting: (() => void)[];
}

function addWaiting(queue: FetchQueue, start: () => void): void {
  queue.waiting.push(start);
}

/** Resolves once the request may start, taking one of the queue's slots. */
function takeSlot(queue: FetchQueue): Promise<void> {
  if (queue.pending < queue.limit) {
    queue.pending += 1;
    return Promise.resolve();
  }
  return new Promise<void>(addWaiting.bind(undefined, queue));
}

/** Hands the slot of a settled request to the oldest waiting one, or frees it. */
function releaseSlot(queue: FetchQueue): void {
  const next = queue.waiting.shift();
  if (next === undefined) {
    queue.pending -= 1;
    return;
  }
  next();
}

async function fetchInQueue(
  queue: FetchQueue,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  await takeSlot(queue);
  try {
    const response = await queue.fetch(input, init);
    return response;
  } finally {
    releaseSlot(queue);
  }
}

/**
 * A `fetch` that keeps at most `limit` requests of `fetch` pending. Each
 * further request waits, in order, until one settles. Every request settles
 * with its own response or error.
 */
export function limitFetch(fetch: FetchFunction, limit: number): FetchFunction {
  const queue: FetchQueue = { fetch, limit, pending: 0, waiting: [] };
  const limitedFetch: FetchFunction = fetchInQueue.bind(undefined, queue);
  return limitedFetch;
}
