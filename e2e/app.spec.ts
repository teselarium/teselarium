import { expect, test } from "@playwright/test";
import { collectBrowserErrors } from "./browser_errors.ts";

test("renders the app shell without browser errors", async function rendersAppShell({
  page,
}): Promise<void> {
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/");

  await expect(
    page.getByRole("main").getByRole("heading", { name: "Teselarium" }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});
