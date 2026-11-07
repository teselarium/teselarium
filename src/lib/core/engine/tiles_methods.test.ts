import { describe, expect, it, vi } from "vitest";
import {
  buildMethodContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import {
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_MOD_REFERENCE,
} from "../../../test/sample_mods.ts";
import { launchTestMod } from "../../../test/test_launches.ts";
import type { Tile } from "../../tile/index.ts";
import { renderTileBody } from "../tile_bodies/index.ts";
import type { TileBodyRenderer } from "../tile_bodies/index.ts";
import { INVALID_PARAMS } from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";
import { buildTileBodies } from "./mod_tile_bodies.ts";
import { TILES_METHODS } from "./tiles_methods.ts";

vi.mock(
  "../tile_bodies/index.ts",
  async function spyOnRenderer(importOriginal): Promise<object> {
    const original =
      await importOriginal<typeof import("../tile_bodies/index.ts")>();
    const spiedModule = {
      ...original,
      renderTileBody: vi.fn<TileBodyRenderer>(original.renderTileBody),
    };
    return spiedModule;
  },
);

const TILE_SOURCE = "https://tiles.example.net/books/notes.md";

function buildNotesTile(body: string): Tile {
  const tile: Tile = {
    source: TILE_SOURCE,
    metadata: { title: "Notes" },
    body,
    types: [],
  };
  return tile;
}

function buildTilesContext(tiles: Tile[]): ModMethodContext {
  const context = buildMethodContext([]);
  context.tileBodies = buildTileBodies(tiles);
  return context;
}

function findTileSource(tiles: Tile[], ending: string): string {
  for (const tile of tiles) {
    if (tile.source.endsWith(ending)) {
      return tile.source;
    }
  }
  throw new Error(`No tile of the launch ends with ${ending}`);
}

function renderBody(
  context: ModMethodContext,
  params: object,
): Promise<unknown> {
  return TILES_METHODS["tiles.renderBody"](context, params as never);
}

describe("tiles.renderBody", function describeRenderBody(): void {
  it("Body of a tile", async function rendersSampleTile(): Promise<void> {
    const launch = await launchTestMod({
      mod: SAMPLE_MOD_REFERENCE,
      collection: SAMPLE_COLLECTION_REFERENCE,
      params: {},
    });
    const context = buildMethodContext([]);
    context.tileBodies = launch.tileBodies;
    const source = findTileSource(launch.context.tiles, "/kallocain.md");

    const result = await renderBody(context, { source });

    expect(result).toEqual({ html: expect.stringMatching(/^<p>Kallocain is/) });
  });

  it("renders emphasis as <em>", async function rendersEmphasis(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("A *calm* state.")]);

    const result = await renderBody(context, { source: TILE_SOURCE });

    expect(result).toEqual({ html: "<p>A <em>calm</em> state.</p>" });
  });

  it("Not a tile of the mod", async function rejectsOtherTile(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("Text.")]);

    const error = await catchMethodError(
      renderBody.bind(undefined, context, {
        source: "https://example.org/other.md",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      "tiles.renderBody: the source https://example.org/other.md is not one of the mod's tiles",
    );
  });

  it("rejects a source that is not a string", async function rejectsNonStringSource(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("Text.")]);

    for (const params of [{}, { source: 7 }, { source: null }]) {
      const error = await catchMethodError(
        renderBody.bind(undefined, context, params),
      );

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe('tiles.renderBody: "source" must be a string');
    }
  });

  it("renders an empty body as an empty string", async function rendersEmptyBody(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("")]);

    const result = await renderBody(context, { source: TILE_SOURCE });

    expect(result).toEqual({ html: "" });
  });

  it("After reloading the tiles", async function rendersReloadedTile(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("Old text.")]);
    await renderBody(context, { source: TILE_SOURCE });

    context.tileBodies = buildTileBodies([buildNotesTile("New text.")]);
    const result = await renderBody(context, { source: TILE_SOURCE });

    expect(result).toEqual({ html: "<p>New text.</p>" });
  });

  it("renders a body once for two requests at once", async function rendersOnce(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("Inline $x^2$.")]);
    vi.mocked(renderTileBody).mockClear();

    const results = await Promise.all([
      renderBody(context, { source: TILE_SOURCE }),
      renderBody(context, { source: TILE_SOURCE }),
    ]);

    expect(renderTileBody).toHaveBeenCalledTimes(1);
    expect(results[1]).toEqual(results[0]);
  });

  it("Formula beside an image", async function rendersFormulaBesideImage(): Promise<void> {
    const context = buildTilesContext([
      buildNotesTile("![Cover](./cover.jpg) and $\\frac{a}{b}$"),
    ]);

    const result = (await renderBody(context, { source: TILE_SOURCE })) as {
      html: string;
    };

    expect(result.html).toContain(
      '<img src="https://tiles.example.net/books/cover.jpg" alt="Cover"',
    );
    expect(result.html).toContain("<mfrac><mi>a</mi><mi>b</mi></mfrac>");
    expect(context.tileBodies.mediaByTile.get(TILE_SOURCE)).toEqual([
      "https://tiles.example.net/books/cover.jpg",
    ]);
  });

  it("forgets a body that fails to render", async function forgetsFailedBody(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("Text.")]);
    vi.mocked(renderTileBody).mockRejectedValueOnce(
      new Error("the math chunk could not be fetched"),
    );

    const failedRender = renderBody(context, { source: TILE_SOURCE });

    await expect(failedRender).rejects.toThrow(
      "the math chunk could not be fetched",
    );
    expect(context.tileBodies.renderedBodies.size).toBe(0);
    const result = await renderBody(context, { source: TILE_SOURCE });
    expect(result).toEqual({ html: "<p>Text.</p>" });
  });

  it("keeps a rendered body for later requests", async function keepsRenderedBody(): Promise<void> {
    const context = buildTilesContext([buildNotesTile("Text.")]);

    await renderBody(context, { source: TILE_SOURCE });

    expect([...context.tileBodies.renderedBodies.keys()]).toEqual([
      TILE_SOURCE,
    ]);
  });
});
