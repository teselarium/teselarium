import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageMarkdown } from "./page_markdown.tsx";
import type { PageFile } from "./page_links.ts";

const HOME_INDEX: PageFile = {
  section: "home",
  url: "https://example.org/pages/home/index.md",
};

/** The HTML a page's markdown becomes, as the page renders it. */
function renderPage(markdown: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <PageMarkdown markdown={markdown} file={HOME_INDEX} />,
  );
  return container;
}

describe("page markdown", function describePageMarkdown(): void {
  it("renders markdown with GitHub's tables", function rendersMarkdown(): void {
    const page = renderPage(
      "# Welcome\n\n| Name | Year |\n|---|---|\n| Kallocain | 1940 |\n",
    );

    expect(page.querySelector("h1")?.textContent).toBe("Welcome");
    expect(page.querySelector("table td")?.textContent).toBe("Kallocain");
  });

  it("Card from markdown", function keepsArticle(): void {
    const page = renderPage("<article><h2>Start here</h2></article>");

    expect(page.querySelector("article > h2")?.textContent).toBe("Start here");
  });

  it("Badge from markdown", function keepsBadge(): void {
    const page = renderPage('<span data-ot-variant="success">New</span>');

    const badge = page.querySelector("span");
    expect(badge?.getAttribute("data-ot-variant")).toBe("success");
    expect(badge?.textContent).toBe("New");
  });

  it("keeps the sectioning elements, details, alerts and color scheme sections", function keepsAllowed(): void {
    const page = renderPage(
      [
        "<section><header>Head</header><aside>Note</aside><footer>Foot</footer></section>",
        "<details><summary>More</summary>Hidden</details>",
        '<div role="alert">Careful</div>',
        '<div role="status">Work in progress</div>',
        '<section data-ot-color-scheme="dark">Dark</section>',
      ].join("\n\n"),
    );

    for (const selector of [
      "section header",
      "section aside",
      "section footer",
    ]) {
      expect(page.querySelector(selector)).not.toBeNull();
    }
    expect(page.querySelector("details > summary")?.textContent).toBe("More");
    expect(page.querySelector('[role="alert"]')?.textContent).toBe("Careful");
    expect(page.querySelector('[role="status"]')).not.toBeNull();
    expect(
      page.querySelector('[data-ot-color-scheme="dark"]')?.textContent,
    ).toBe("Dark");
  });

  it("Script removed", function removesScript(): void {
    const page = renderPage("<script>window.pwned = true</script>\n\nText");

    expect(page.querySelector("script")).toBeNull();
    expect(page.innerHTML).not.toContain("pwned");
  });

  it("Event handler removed", function removesHandler(): void {
    const page = renderPage('<img src="x.png" onerror="window.pwned = true">');

    const image = page.querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.hasAttribute("onerror")).toBe(false);
    expect(page.innerHTML).not.toContain("pwned");
  });

  it("Style attribute removed", function removesStyle(): void {
    const page = renderPage('<p style="position: fixed">Text</p>');

    expect(page.querySelector("p")?.hasAttribute("style")).toBe(false);
    expect(page.querySelector("p")?.textContent).toBe("Text");
  });

  it("removes javascript: links", function removesJavascriptLinks(): void {
    const page = renderPage(
      '[Click](javascript:alert(1))\n\n<a href="javascript:alert(1)">Raw</a>',
    );

    for (const link of page.querySelectorAll("a")) {
      expect(link.getAttribute("href") ?? "").not.toContain("javascript");
    }
  });

  it("removes frames, forms and other elements", function removesElements(): void {
    const page = renderPage(
      [
        '<iframe src="https://example.com/"></iframe>',
        '<form action="https://example.com/"><input name="q"></form>',
        "<style>h1 { color: red }</style>",
        '<object data="x.swf"></object>',
      ].join("\n\n"),
    );

    for (const tag of ["iframe", "form", "style", "object"]) {
      expect(page.querySelector(tag)).toBeNull();
    }
    expect(page.querySelector('input[name="q"]')).toBeNull();
  });

  it("removes other roles and misplaced variants", function removesAttributes(): void {
    const page = renderPage(
      [
        '<div role="button">Fake button</div>',
        '<div data-ot-variant="success">Not a badge</div>',
        '<span data-ot-variant="loud">Unknown</span>',
        '<section data-ot-color-scheme="sepia">Unknown scheme</section>',
      ].join("\n\n"),
    );

    expect(page.querySelector("[role]")).toBeNull();
    expect(page.querySelector("[data-ot-variant]")).toBeNull();
    expect(page.querySelector("[data-ot-color-scheme]")).toBeNull();
  });

  it("Other site", function opensOtherSiteElsewhere(): void {
    const page = renderPage("[Example](https://example.com/)");

    const link = page.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("maps links and images with the page's rules", function mapsLinks(): void {
    const page = renderPage(
      [
        "[Guides](../guides/index.md) [Next](next.md) [Run](#/run?mod=mod_explorer)",
        "[Elsewhere](https://example.com/)",
        "![Logo](./logo.svg)",
      ].join("\n\n"),
    );
    const links = page.querySelectorAll("a");

    expect(links[1].getAttribute("href")).toBe("#/home/next");
    expect(links[2].getAttribute("href")).toBe("#/run?mod=mod_explorer");
    expect(links[3].getAttribute("target")).toBe("_blank");
    expect(links[3].getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[1].hasAttribute("target")).toBe(false);
    expect(page.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.org/pages/home/logo.svg",
    );
  });
});
