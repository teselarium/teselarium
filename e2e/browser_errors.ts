import type { ConsoleMessage, Page } from "@playwright/test";

/** Records the console errors and uncaught errors the page raises from now on. */
export function collectBrowserErrors(page: Page): string[] {
  const browserErrors: string[] = [];
  page.on(
    "console",
    function recordConsoleError(message: ConsoleMessage): void {
      if (message.type() === "error") {
        browserErrors.push(message.text());
      }
    },
  );
  page.on("pageerror", function recordPageError(error: Error): void {
    browserErrors.push(error.message);
  });
  return browserErrors;
}
