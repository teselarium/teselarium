import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

function collectBrowserErrors(page: Page): string[] {
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

test("renders the app shell without browser errors", async function rendersAppShell({
  page,
}): Promise<void> {
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OpenTesela" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
