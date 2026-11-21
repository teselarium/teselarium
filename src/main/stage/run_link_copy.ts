/** How long a copy button says how the copy went. */
export const COPY_FEEDBACK_MS = 2000;

/** The app's full address with the sandbox's run link as its hash. */
export function buildRunLinkAddress(hash: string): string {
  const { origin, pathname, search } = window.location;
  const address = `${origin}${pathname}${search}${hash}`;
  return address;
}

function writeToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/** Writes `text` to the clipboard. Rejects when the clipboard refuses it or the browser has none. */
export function copyText(text: string): Promise<void> {
  // Starting from a resolved promise turns a missing clipboard's TypeError into a rejection.
  return Promise.resolve(text).then(writeToClipboard);
}

function clearCopyTimer(timer: ReturnType<typeof setTimeout>): void {
  clearTimeout(timer);
}

/** Calls `endFeedback` after `COPY_FEEDBACK_MS`. Returns the function that cancels it. */
export function scheduleFeedbackEnd(endFeedback: () => void): () => void {
  const timer = setTimeout(endFeedback, COPY_FEEDBACK_MS);
  return clearCopyTimer.bind(undefined, timer);
}
