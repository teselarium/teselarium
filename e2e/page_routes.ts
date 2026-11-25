import type { Page, Route } from "@playwright/test";

export async function answerMarkdown(
  markdown: string,
  route: Route,
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/markdown",
    body: markdown,
  });
}

/** Serves `markdown` as the file of a page, e.g. `home/index` for `pages/home/index.md`. */
export async function servePage(
  page: Page,
  pagePath: string,
  markdown: string,
): Promise<void> {
  await page.route(
    `**/pages/${pagePath}.md`,
    answerMarkdown.bind(undefined, markdown),
  );
}
