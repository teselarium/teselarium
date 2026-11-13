import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  actionDialog,
  isFrameMarked,
  markFrame,
  MEDIA_HOST,
} from "./mod_routes.ts";
import {
  MAP_EMBED,
  openBodyProbe,
  routePlayerSites,
  showTileBodies,
  YOUTUBE_EMBED,
} from "./tile_body_routes.ts";
import type { BodyProbe, BodyTile } from "./tile_body_routes.ts";

function buildFiller(): string {
  const paragraphs: string[] = [];
  for (let index = 1; index <= 40; index += 1) {
    paragraphs.push(`Filler paragraph ${index}.`);
  }
  return paragraphs.join("\n\n");
}

/** Paragraphs that make a body taller than the frame, so a fragment link has to scroll. */
const FILLER = buildFiller();

/** A title too long for the two title lines of a placeholder. */
const LONG_PLAYER_TITLE =
  "A very long title of a recorded lecture about the history of tiles, mosaics and the people who laid them";

/** A tile with every kind of content a body can hold. */
const RICH_TILE: BodyTile = {
  name: "rich",
  body: [
    "# Notes",
    "Kallocain is a *dystopian* novel.",
    "![Cover](./cover.png)",
    "[Peach](https://peach.blender.org)",
    "[See more](#more-notes)",
    "## More notes",
    `<iframe src="${YOUTUBE_EMBED}" title="Big Buck Bunny"></iframe>`,
    `<iframe src="${MAP_EMBED}" title="Map" width="400" height="300"></iframe>`,
    `<iframe src="${MAP_EMBED}&long" title="${LONG_PLAYER_TITLE}"></iframe>`,
    `<video src="${MEDIA_HOST}/trailer.mp4" poster="${MEDIA_HOST}/still.png"></video>`,
    `<picture><source srcset="${MEDIA_HOST}/dark.png" media="(prefers-color-scheme: dark)"><img src="${MEDIA_HOST}/light.png" alt="Logo"></picture>`,
    "> [!WARNING]\n> Spoilers below.",
    "Inline $x*y*z$.",
    "```mermaid\ngraph TD\n  A --> B\n```",
  ].join("\n\n"),
};

/** Two tiles whose bodies both have a `Notes` heading after the filler; the second links to it first. */
const FIRST_NOTES_TILE: BodyTile = {
  name: "first-notes",
  body: `${FILLER}\n\n## Notes\n\nFirst notes.`,
};

const SECOND_NOTES_TILE: BodyTile = {
  name: "second-notes",
  body: `[See notes](#notes)\n\n${FILLER}\n\n## Notes\n\nSecond notes.\n\n${FILLER}`,
};

const BODY_TILES = [RICH_TILE, FIRST_NOTES_TILE, SECOND_NOTES_TILE];

/** Opens the probe with the body tiles and shows the rich tile's body. */
async function showRichBody(page: Page): Promise<BodyProbe> {
  const bodyProbe = await openBodyProbe(page, BODY_TILES);
  await bodyProbe.frame.evaluate(showTileBodies, [0]);
  return bodyProbe;
}

/** Runs in the probe's frame: counts the `ot-rendered` events that reach `document`. */
function countRenderedEvents(): void {
  const probeGlobal = globalThis as unknown as { renderedCount: number };
  probeGlobal.renderedCount = 0;
  document.addEventListener("ot-rendered", function countRendered(): void {
    probeGlobal.renderedCount += 1;
  });
}

function readRenderedCount(): number {
  return (globalThis as unknown as { renderedCount: number }).renderedCount;
}

/** Runs in the probe's frame: shows a tile that is not one of the mod's. */
function showOtherTile(): void {
  const body = document.createElement("ot-tile-body") as HTMLElement & {
    tile: unknown;
  };
  document.body.append(body);
  body.tile = { source: "https://example.org/other.md" };
}

/** Runs in the probe's frame: cancels every click on a body link in the mod's own listener. */
function handleLinksInMod(): void {
  document.addEventListener("click", function cancelLinkClick(event): void {
    if ((event.target as Element).closest("a[data-ot-link]") !== null) {
      event.preventDefault();
    }
  });
}

/** Runs in the probe's frame: where the `Notes` heading of each body is, relative to the frame's top. */
function readNotesHeadingTops(): number[] {
  const tops: number[] = [];
  for (const heading of document.querySelectorAll("#user-content-notes")) {
    tops.push(Math.round(heading.getBoundingClientRect().top));
  }
  return tops;
}

/**
 * Runs in the probe's frame: scrolls to the dark-mode picture, which loads
 * lazily, and gives its shown address once it loaded, or `""` before.
 */
function readLoadedPictureSource(): string {
  const image = document.querySelector("picture img") as HTMLImageElement;
  image.scrollIntoView();
  if (!image.complete || image.naturalWidth === 0) {
    return "";
  }
  return image.currentSrc;
}

/** Runs in the probe's frame: the computed style property of the first element matching `selector`. */
function readComputedProperty([selector, property]: string[]): string {
  const element = document.querySelector(selector) as Element;
  return getComputedStyle(element).getPropertyValue(property);
}

/** Runs in the probe's frame: the color `--ot-warning` computes to, as the browser writes colors. */
function readWarningColor(): string {
  const probe = document.createElement("span");
  probe.style.color = "var(--ot-warning)";
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

test.describe(
  "The tile body element",
  { tag: "@frames" },
  function describeTileBodyElement(): void {
    test("Show a body with no code", async function showsBody({
      page,
    }): Promise<void> {
      const { frame } = await openBodyProbe(page, BODY_TILES);
      await frame.evaluate(countRenderedEvents);

      await frame.evaluate(showTileBodies, [0]);

      await expect(
        frame.locator("ot-tile-body h1", { hasText: "Notes" }),
      ).toBeVisible();
      await expect(frame.locator("ot-tile-body em")).toHaveText("dystopian");
      expect(await frame.evaluate(readRenderedCount)).toBe(1);
    });

    test("Tile that is not the mod's", async function showsError({
      page,
    }): Promise<void> {
      const { frame } = await openBodyProbe(page, BODY_TILES);

      await frame.evaluate(showOtherTile);

      await expect(frame.locator('ot-tile-body [role="alert"]')).toHaveText(
        "tiles.renderBody: the source https://example.org/other.md is not one of the mod's tiles",
      );
    });
  },
);

test.describe(
  "Links in bodies open through the app",
  { tag: "@frames" },
  function describeBodyLinks(): void {
    test("Click on a body link", async function opensBodyLink({
      page,
    }): Promise<void> {
      const { frame } = await showRichBody(page);
      await markFrame(frame);

      await frame.getByRole("link", { name: "Peach" }).click();

      await expect(actionDialog(page)).toContainText(
        "https://peach.blender.org",
      );
      expect(await isFrameMarked(frame)).toBe(true);
    });

    test("Mod handles the click itself", async function leavesHandledClick({
      page,
    }): Promise<void> {
      const { frame } = await showRichBody(page);
      await frame.evaluate(handleLinksInMod);
      await markFrame(frame);

      await frame.getByRole("link", { name: "Peach" }).click();

      await expect(actionDialog(page)).toBeHidden();
      expect(await isFrameMarked(frame)).toBe(true);
    });
  },
);

test.describe(
  "Heading anchors",
  { tag: "@frames" },
  function describeHeadingAnchors(): void {
    test("Link to a heading", async function scrollsToOwnHeading({
      page,
    }): Promise<void> {
      const { frame } = await openBodyProbe(page, BODY_TILES);
      await frame.evaluate(showTileBodies, [1, 2]);
      await markFrame(frame);

      await frame.getByRole("link", { name: "See notes" }).click();

      await expect
        .poll(async function readSecondHeadingTop(): Promise<number> {
          const tops = await frame.evaluate(readNotesHeadingTops);
          return Math.abs(tops[1]);
        })
        .toBeLessThan(2);
      const tops = await frame.evaluate(readNotesHeadingTops);
      expect(Math.abs(tops[0])).toBeGreaterThan(100);
      expect(await isFrameMarked(frame)).toBe(true);
    });
  },
);

test.describe(
  "Players in bodies become placeholders",
  { tag: "@frames" },
  function describePlaceholders(): void {
    test("Nothing requested before a click", async function requestsNothing({
      page,
    }): Promise<void> {
      const playerRequests = await routePlayerSites(page);
      const { frame } = await showRichBody(page);

      await expect(
        frame.getByRole("button", { name: /Big Buck Bunny/ }),
      ).toBeVisible();
      await expect(frame.getByRole("button", { name: /Map/ })).toBeVisible();
      await expect(frame.locator("iframe")).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(playerRequests).toEqual([]);
    });
  },
);

test.describe(
  "Pictures in bodies",
  { tag: "@frames" },
  function describePictures(): void {
    test("Dark-mode picture", async function showsDarkPicture({
      page,
    }): Promise<void> {
      await page.emulateMedia({ colorScheme: "dark" });
      const { frame, mediaUrls } = await showRichBody(page);

      await expect
        .poll(function readPictureSource(): Promise<string> {
          return frame.evaluate(readLoadedPictureSource);
        })
        .toBe(`${MEDIA_HOST}/dark.png`);
      expect(mediaUrls).toContain(`${MEDIA_HOST}/dark.png`);
    });
  },
);

test.describe(
  "Rendered bodies follow the theme",
  { tag: "@frames" },
  function describeBodyTheme(): void {
    test("Warning color", async function colorsWarning({
      page,
    }): Promise<void> {
      const { frame } = await showRichBody(page);

      expect(
        await frame.evaluate(readComputedProperty, [
          'aside[data-ot-alert="warning"]',
          "border-left-color",
        ]),
      ).toBe(await frame.evaluate(readWarningColor));
    });
  },
);

test.describe(
  "Placeholder box",
  { tag: "@frames" },
  function describePlaceholderBox(): void {
    test("Placeholder shape", async function shapesPlaceholder({
      page,
    }): Promise<void> {
      const { frame } = await showRichBody(page);
      const shortPlaceholder = frame.getByRole("button", { name: /^Map/ });
      const longPlaceholder = frame.getByRole("button", {
        name: /^A very long/,
      });
      const shortBox = await shortPlaceholder.boundingBox();
      const longBox = await longPlaceholder.boundingBox();
      const bodyBox = await frame.locator("ot-tile-body").boundingBox();

      expect(longBox?.width).toBeCloseTo(shortBox?.width ?? 0, 1);
      expect(longBox?.height).toBeCloseTo(shortBox?.height ?? 0, 1);
      expect(shortBox?.height).toBeLessThan(96);
      expect(shortBox?.width).toBeLessThan(bodyBox?.width ?? 0);
    });

    test("Long title on hover", async function expandsOnHover({
      page,
    }): Promise<void> {
      const { frame } = await showRichBody(page);
      const longPlaceholder = frame.getByRole("button", {
        name: /^A very long/,
      });
      const visibleBox = longPlaceholder.locator("> span");
      await longPlaceholder.scrollIntoViewIfNeeded();
      const slotBefore = await longPlaceholder.boundingBox();
      const boxBefore = await visibleBox.boundingBox();

      await longPlaceholder.hover();

      const slotAfter = await longPlaceholder.boundingBox();
      const boxAfter = await visibleBox.boundingBox();
      expect(slotAfter).toEqual(slotBefore);
      expect(boxAfter?.height).toBeGreaterThan(boxBefore?.height ?? 0);
    });
  },
);
