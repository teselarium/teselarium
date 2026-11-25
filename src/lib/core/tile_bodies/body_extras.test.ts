import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Tile } from "../../tile/index.ts";
import { BODY_EXTRA_LOADERS } from "./body_extras.ts";
import type {
  BodyExtraLoaders,
  HtmlTreePass,
  MarkdownTreePass,
} from "./body_extras.ts";
import { buildTileBodyRenderer } from "./render_body.ts";
import type { TileBodyRenderer } from "./render_body.ts";

const TILE_SOURCE = "https://example.org/notes/extras.md";

/** The app's loaders, each one a spy, and a renderer that uses them. */
interface SpiedRenderer {
  render: TileBodyRenderer;
  math: Mock<() => Promise<HtmlTreePass>>;
  highlighting: Mock<() => Promise<HtmlTreePass>>;
  emoji: Mock<() => Promise<MarkdownTreePass>>;
}

function buildSpiedRenderer(): SpiedRenderer {
  const math = vi.fn<() => Promise<HtmlTreePass>>(BODY_EXTRA_LOADERS.math);
  const highlighting = vi.fn<() => Promise<HtmlTreePass>>(
    BODY_EXTRA_LOADERS.highlighting,
  );
  const emoji = vi.fn<() => Promise<MarkdownTreePass>>(
    BODY_EXTRA_LOADERS.emoji,
  );
  const loaders: BodyExtraLoaders = { math, highlighting, emoji };
  const spiedRenderer: SpiedRenderer = {
    render: buildTileBodyRenderer(loaders),
    math,
    highlighting,
    emoji,
  };
  return spiedRenderer;
}

function buildExtrasTile(body: string): Tile {
  const tile: Tile = {
    source: TILE_SOURCE,
    metadata: { title: "Extras" },
    body,
    types: [],
  };
  return tile;
}

/** The loaders a body made the renderer call, by name. */
async function listCalledLoaders(body: string): Promise<string[]> {
  const spied = buildSpiedRenderer();
  await spied.render(buildExtrasTile(body));
  const called: string[] = [];
  for (const name of ["math", "highlighting", "emoji"] as const) {
    if (spied[name].mock.calls.length > 0) {
      called.push(name);
    }
  }
  return called;
}

function failToFetch(): Promise<HtmlTreePass> {
  return Promise.reject(new Error("the math chunk could not be fetched"));
}

describe("Extras load only when a body needs them", function describeExtraLoading(): void {
  it("loads none for a plain body", async function loadsNoneForPlainBody(): Promise<void> {
    const called = await listCalledLoaders(
      "# Notes\n\nA *calm* state, [a link](./a.md) and `code`.",
    );

    expect(called).toEqual([]);
  });

  it("loads none for prices", async function loadsNoneForPrices(): Promise<void> {
    const called = await listCalledLoaders("It costs $5 and $10.");

    expect(called).toEqual([]);
  });

  it("loads only the math for a formula", async function loadsMath(): Promise<void> {
    for (const body of ["Inline $x^2$.", "$$\nx^2\n$$", "```math\nx^2\n```"]) {
      const called = await listCalledLoaders(body);

      expect(called).toEqual(["math"]);
    }
  });

  it("loads only the highlighting for labeled code", async function loadsHighlighting(): Promise<void> {
    const called = await listCalledLoaders("```js\nconst answer = 42;\n```");

    expect(called).toEqual(["highlighting"]);
  });

  it("loads only the emoji for a shortcode", async function loadsEmoji(): Promise<void> {
    const called = await listCalledLoaders("Done :tada:");

    expect(called).toEqual(["emoji"]);
  });

  it("loads the highlighting for a language it does not have", async function loadsHighlightingForDockerfile(): Promise<void> {
    const called = await listCalledLoaders("```dockerfile\nFROM node\n```");

    expect(called).toEqual(["highlighting"]);
  });

  it("loads nothing for mermaid blocks and unlabeled code", async function loadsNoneForMermaid(): Promise<void> {
    const called = await listCalledLoaders(
      "```mermaid\ngraph TD\n  A --> B\n```\n\n```\nplain\n```",
    );

    expect(called).toEqual([]);
  });

  it("loads nothing for shortcodes in code", async function loadsNoneForCodeShortcodes(): Promise<void> {
    const called = await listCalledLoaders("`:tada:`\n\n```\n:tada:\n```");

    expect(called).toEqual([]);
  });

  it("Name that is not an emoji", async function loadsEmojiForTime(): Promise<void> {
    const spied = buildSpiedRenderer();

    const html = await spied.render(buildExtrasTile("It starts at 10:30:45."));

    expect(spied.emoji).toHaveBeenCalledTimes(1);
    expect(html).toBe("<p>It starts at 10:30:45.</p>");
  });

  it("loads the math once for two bodies", async function loadsMathOnce(): Promise<void> {
    const spied = buildSpiedRenderer();

    await Promise.all([
      spied.render(buildExtrasTile("$a$")),
      spied.render(buildExtrasTile("$b$")),
    ]);
    await spied.render(buildExtrasTile("$c$"));

    expect(spied.math).toHaveBeenCalledTimes(1);
  });

  it("loads the math again for the next body after a failure", async function retriesFailedLoad(): Promise<void> {
    const spied = buildSpiedRenderer();
    spied.math.mockImplementationOnce(failToFetch);

    const failedRender = spied.render(buildExtrasTile("$\\frac{a}{b}$"));

    await expect(failedRender).rejects.toThrow(
      "the math chunk could not be fetched",
    );
    const html = await spied.render(buildExtrasTile("$\\frac{a}{b}$"));
    expect(spied.math).toHaveBeenCalledTimes(2);
    expect(html).toContain("<mfrac>");
  });
});
