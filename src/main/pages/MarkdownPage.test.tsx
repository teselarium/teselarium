import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_FRAME_STYLES } from "../../lib/core/theme/index.ts";
import { waitForMessages } from "../../test/fake_frames.ts";
import { fetchTestFile, testTexts } from "../../test/test_files.ts";
import { MarkdownPage } from "./MarkdownPage.tsx";
import type { PageFile } from "./page_links.ts";

const GUIDES_INDEX: PageFile = {
  section: "guides",
  url: "https://example.org/pages/guides/index.md",
};

const ABOUT_INDEX: PageFile = {
  section: "about",
  url: "https://example.org/pages/about/index.md",
};

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function readShadowRoot(container: HTMLElement): ShadowRoot {
  const host = container.querySelector<HTMLElement>("[data-page-host]");
  if (host?.shadowRoot === null || host?.shadowRoot === undefined) {
    throw new Error("Expected the page host to have a shadow root");
  }
  return host.shadowRoot;
}

async function waitForLoad(): Promise<void> {
  await act(async function settleFetch(): Promise<void> {
    await waitForMessages();
  });
}

/** Pending answers of a held fetch, by URL. */
type HeldAnswers = Map<string, (response: Response) => void>;

function holdRequest(
  answers: HeldAnswers,
  url: string,
  resolve: (response: Response) => void,
): void {
  answers.set(url, resolve);
}

/** A fetch that answers each URL only when the test calls `answerHeld`. */
function heldFetch(
  answers: HeldAnswers,
  input: RequestInfo | URL,
): Promise<Response> {
  return new Promise(holdRequest.bind(undefined, answers, String(input)));
}

function answerHeld(answers: HeldAnswers, url: string, text: string): void {
  answers.get(url)?.(new Response(text, { status: 200 }));
}

describe("MarkdownPage", function describeMarkdownPage(): void {
  it("renders the page in a shadow root with the mods' styles", async function rendersInShadowRoot(): Promise<void> {
    testTexts.set(GUIDES_INDEX.url, "# Guides\n\nHow to use the app.");
    const { container } = render(
      <MarkdownPage
        file={GUIDES_INDEX}
        fetchOptions={{ fetch: fetchTestFile }}
      />,
    );

    await waitForLoad();

    const shadowRoot = readShadowRoot(container);
    expect(shadowRoot.querySelector("h1")?.textContent).toBe("Guides");
    expect(shadowRoot.querySelector("style")?.textContent).toContain(
      THEME_FRAME_STYLES,
    );
    expect(shadowRoot.querySelector(".page-body > h1")).not.toBeNull();
    expect(container.querySelector("h1")).toBeNull();
  });

  it("Front matter", async function dropsFrontMatter(): Promise<void> {
    testTexts.set(GUIDES_INDEX.url, '---\ntitle: "Draft"\n---\n\n# Guides\n');
    const { container } = render(
      <MarkdownPage
        file={GUIDES_INDEX}
        fetchOptions={{ fetch: fetchTestFile }}
      />,
    );

    await waitForLoad();

    const body = readShadowRoot(container).querySelector(".page-body");
    expect(body?.textContent).toContain("Guides");
    expect(body?.textContent).not.toContain("title");
    expect(body?.textContent).not.toContain("Draft");
  });

  it("Missing page", async function showsLoadError(): Promise<void> {
    const missing: PageFile = {
      section: "guides",
      url: "https://example.org/pages/guides/missing.md",
    };
    render(
      <MarkdownPage file={missing} fetchOptions={{ fetch: fetchTestFile }} />,
    );

    await waitForLoad();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(missing.url);
    expect(alert).toHaveTextContent("404");
  });

  it("ignores a page that loads after the user moved on", async function ignoresStaleFetch(): Promise<void> {
    const answers: HeldAnswers = new Map();
    const fetchOptions = {
      fetch: heldFetch.bind(undefined, answers) as typeof globalThis.fetch,
    };
    const { container, rerender } = render(
      <MarkdownPage file={GUIDES_INDEX} fetchOptions={fetchOptions} />,
    );
    rerender(<MarkdownPage file={ABOUT_INDEX} fetchOptions={fetchOptions} />);

    await act(async function answerBoth(): Promise<void> {
      answerHeld(answers, ABOUT_INDEX.url, "# About");
      await waitForMessages();
      answerHeld(answers, GUIDES_INDEX.url, "# Guides");
      await waitForMessages();
    });

    expect(readShadowRoot(container).querySelector("h1")?.textContent).toBe(
      "About",
    );
  });
});
