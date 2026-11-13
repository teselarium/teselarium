import { expect, test } from "@playwright/test";
import type { Frame, Page } from "@playwright/test";
import { PREVIEW_URL } from "./app_servers.ts";
import {
  buildProbeFiles,
  findModFrame,
  readProbeAnswers,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import {
  BODIES_COLLECTION_URL,
  buildBodyProbeLink,
  openBodyProbe,
  playerDialog,
  playerFrame,
  pressPlay,
  routePlayerSites,
  showTileBodies,
  YOUTUBE_EMBED,
  YOUTUBE_FRAME,
  YOUTUBE_FRAME_HOST,
  YOUTUBE_PAGE,
} from "./tile_body_routes.ts";
import type { BodyTile, PlayerRequest } from "./tile_body_routes.ts";

const OTHER_YOUTUBE_PAGE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const OPEN_ANY_SITE_LINES = [
  "  permissions:",
  "    open:",
  '      - host: "*"',
  '        reason: "Opens mods"',
];

/** A film whose metadata links its YouTube page, and whose body pastes its player. */
const FILM_TILES: BodyTile[] = [
  {
    name: "bunny",
    metadataLines: [`video: "${YOUTUBE_PAGE}"`],
    body: `<iframe src="${YOUTUBE_EMBED}" title="Big Buck Bunny"></iframe>`,
  },
];

const ALWAYS_PLAY_LABEL = `Always play from ${YOUTUBE_FRAME_HOST}`;

interface PlayerPage {
  frame: Frame;
  playerRequests: PlayerRequest[];
}

/** Stubs the player sites and opens the probe, with `otherFiles` served next to it. */
async function openPlayerProbe(
  page: Page,
  extraLines: string[] = [],
  otherFiles: Record<string, string> = {},
): Promise<PlayerPage> {
  const playerRequests = await routePlayerSites(page);
  const { frame } = await openBodyProbe(
    page,
    FILM_TILES,
    extraLines,
    otherFiles,
  );
  const playerPage: PlayerPage = { frame, playerRequests };
  return playerPage;
}

async function askForPlayer(frame: Frame, url: string): Promise<void> {
  await frame.evaluate(startProbeRequests, [["players.open", { url }]]);
}

function readPlayerUrls(playerRequests: PlayerRequest[]): string[] {
  const urls: string[] = [];
  for (const request of playerRequests) {
    urls.push(request.url);
  }
  return urls;
}

test.describe(
  "Clicks on player placeholders",
  { tag: "@frames" },
  function describePlaceholderClicks(): void {
    test("Click on a placeholder", async function opensQuestion({
      page,
    }): Promise<void> {
      const { frame, playerRequests } = await openPlayerProbe(page);
      await frame.evaluate(showTileBodies, [0]);

      await frame.getByRole("button", { name: /Big Buck Bunny/ }).click();

      await expect(playerDialog(page)).toContainText("wants to play:");
      await expect(playerDialog(page)).toContainText("Big Buck Bunny");
      await expect(playerDialog(page)).toContainText("YouTube");
      await expect(playerDialog(page)).toContainText(YOUTUBE_FRAME_HOST);
      await expect(playerFrame(page)).toHaveCount(0);
      expect(playerRequests).toEqual([]);
    });
  },
);

test.describe(
  "Ask before contacting the site",
  { tag: "@frames" },
  function describeQuestion(): void {
    test("Cancel", async function cancelsPlayer({ page }): Promise<void> {
      const { frame, playerRequests } = await openPlayerProbe(page);
      await askForPlayer(frame, YOUTUBE_PAGE);
      await expect(playerDialog(page)).toBeVisible();
      await expect(
        playerDialog(page).getByRole("button", { name: "Cancel" }),
      ).toBeFocused();

      await playerDialog(page).getByRole("button", { name: "Cancel" }).click();

      await expect(playerDialog(page)).toBeHidden();
      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: false },
      ]);
      expect(playerRequests).toEqual([]);
    });
  },
);

test.describe(
  "Open a player",
  { tag: "@frames" },
  function describeOpenPlayer(): void {
    test("Played and closed", async function playsAndCloses({
      page,
    }): Promise<void> {
      const { frame, playerRequests } = await openPlayerProbe(page);
      await askForPlayer(frame, YOUTUBE_PAGE);

      await pressPlay(page);
      await expect(playerFrame(page)).toHaveAttribute("src", YOUTUBE_FRAME);
      await expect
        .poll(readPlayerUrls.bind(undefined, playerRequests))
        .toEqual([YOUTUBE_FRAME]);
      await playerDialog(page).getByRole("button", { name: "Close" }).click();

      await expect(playerDialog(page)).toBeHidden();
      await expect(page.locator("dialog iframe")).toHaveCount(0);
      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: true },
      ]);
    });

    test("Address not from the tiles", async function refusesOtherAddress({
      page,
    }): Promise<void> {
      const { frame } = await openPlayerProbe(page);

      await askForPlayer(frame, OTHER_YOUTUBE_PAGE);

      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        {
          code: -32002,
          message: `players.open: ${OTHER_YOUTUBE_PAGE} is not a player of the mod's tiles`,
        },
      ]);
      await expect(playerDialog(page)).toBeHidden();
    });
  },
);

test.describe(
  "Close the player",
  { tag: "@frames" },
  function describeClosePlayer(): void {
    test("Escape while playing", async function closesWithEscape({
      page,
    }): Promise<void> {
      const { frame } = await openPlayerProbe(page);
      await askForPlayer(frame, YOUTUBE_PAGE);
      await pressPlay(page);

      await page.keyboard.press("Escape");

      await expect(playerDialog(page)).toBeHidden();
      await expect(page.locator("dialog iframe")).toHaveCount(0);
      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: true },
      ]);
    });
  },
);

test.describe(
  "The player frame belongs to the app",
  { tag: "@frames" },
  function describePlayerFrame(): void {
    test("Referrer", async function sendsAppOrigin({ page }): Promise<void> {
      const { frame, playerRequests } = await openPlayerProbe(page);
      await askForPlayer(frame, YOUTUBE_PAGE);

      await pressPlay(page);

      await expect
        .poll(readPlayerUrls.bind(undefined, playerRequests))
        .toEqual([YOUTUBE_FRAME]);
      expect(playerRequests[0].referer).toBe(`${PREVIEW_URL}/`);
    });
  },
);

test.describe(
  "Always play from a site",
  { tag: "@frames" },
  function describeAlwaysPlay(): void {
    test("Remembered site", async function skipsQuestion({
      page,
    }): Promise<void> {
      const { frame } = await openPlayerProbe(
        page,
        [],
        buildProbeFiles("probe2"),
      );
      await askForPlayer(frame, YOUTUBE_PAGE);
      await playerDialog(page).getByLabel(ALWAYS_PLAY_LABEL).check();
      await pressPlay(page);
      await playerDialog(page).getByRole("button", { name: "Close" }).click();
      await expect(playerDialog(page)).toBeHidden();

      await page.goto(buildBodyProbeLink("probe2"));
      const otherFrame = await findModFrame(page, "probe2");
      await waitForProbe(otherFrame);
      await askForPlayer(otherFrame, YOUTUBE_PAGE);

      await expect(playerFrame(page)).toHaveAttribute("src", YOUTUBE_FRAME);
      await expect(
        playerDialog(page).getByRole("button", { name: "Play" }),
      ).toHaveCount(0);
    });

    test("Not checked", async function asksAgain({ page }): Promise<void> {
      const { frame } = await openPlayerProbe(page);
      await askForPlayer(frame, YOUTUBE_PAGE);
      await pressPlay(page);
      await playerDialog(page).getByRole("button", { name: "Close" }).click();

      await askForPlayer(frame, YOUTUBE_PAGE);

      await expect(
        playerDialog(page).getByRole("button", { name: "Play" }),
      ).toBeVisible();
      await expect(playerFrame(page)).toHaveCount(0);
    });
  },
);

test.describe(
  "The player dialog is an action dialog",
  { tag: "@frames" },
  function describeActionRules(): void {
    test("Confirmation after a player", async function queuesConfirmation({
      page,
    }): Promise<void> {
      const { frame } = await openPlayerProbe(page);
      await frame.evaluate(startProbeRequests, [
        ["players.open", { url: YOUTUBE_PAGE }],
        ["ui.confirm", { message: "Delete this list?" }],
      ]);
      await expect(
        playerDialog(page).getByRole("button", { name: "Play" }),
      ).toBeVisible();
      await expect(playerDialog(page)).not.toContainText("Delete this list?");

      await playerDialog(page).getByRole("button", { name: "Cancel" }).click();

      await expect(playerDialog(page)).toContainText("Delete this list?");
    });

    test("Back while playing", async function removesPlayerOnBack({
      page,
    }): Promise<void> {
      const { frame } = await openPlayerProbe(
        page,
        OPEN_ANY_SITE_LINES,
        buildProbeFiles("probe2"),
      );
      await frame.evaluate(startProbeRequests, [
        [
          "mods.open",
          { mod: "./test-mods/probe2/", collection: BODIES_COLLECTION_URL },
        ],
      ]);
      const openedFrame = await findModFrame(page, "probe2");
      await waitForProbe(openedFrame);
      await askForPlayer(openedFrame, YOUTUBE_PAGE);
      await pressPlay(page);

      await page.goBack();

      await expect(playerDialog(page)).toBeHidden();
      await expect(page.locator("dialog iframe")).toHaveCount(0);
      expect(await openedFrame.evaluate(readProbeAnswers)).toEqual([
        { result: true },
      ]);
    });
  },
);
