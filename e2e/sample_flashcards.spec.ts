import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page, Route } from "@playwright/test";
import { findModFrame, stageBar } from "./mod_routes.ts";
import {
  FLASHCARDS_CARDS_FOLDER_PATH,
  FLASHCARDS_COLLECTION_GLOB,
  FLASHCARDS_COLLECTION_RUN_HASH,
  FLASHCARDS_MOD_REFERENCE,
} from "./sample_mod.ts";
import { readTokenAs } from "./theme_probes.ts";

/** The sample deck's tiles, in the collection's order. */
const SAMPLE_CARD_FILES = [
  "emphasis.md",
  "links.md",
  "task_lists.md",
  "tables.md",
  "code_blocks.md",
  "math.md",
  "diagrams.md",
  "alerts.md",
];

const TILES_CHANGED_NOTICE = "The tiles changed, so the session ended.";

/**
 * Tiles served next to the sample deck, for the names the sample has none of.
 * A tile whose `title` is not a string does not match the flashcard type, so
 * the app never gives it to the mod: test.js mounts the mod with one.
 */
const EXTRA_CARDS: Record<string, string> = {
  "monad.md":
    "---\nlevel: 3\n---\n\n## What is a monad?\n\nA monoid in the category of endofunctors.\n",
  "notes_03.md": "---\nlevel: 1\n---\n\nSome notes without a heading.\n",
};

/** Whether a route answers its changed version: off at first, switched on before "Reload tiles". */
interface RouteSwitch {
  isOn: boolean;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCollectionYaml(cardFiles: string[]): string {
  const lines = ["collection:", '  name: "Test deck"', "  tiles:"];
  for (const cardFile of cardFiles) {
    lines.push(`    - path: "./cards/${cardFile}"`);
  }
  const yaml = lines.join("\n");
  return yaml;
}

/** Answers the sample deck with these cards. */
async function answerDeck(cardFiles: string[], route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/yaml",
    body: buildCollectionYaml(cardFiles),
  });
}

/** Answers the sample deck with `changedFiles` once `changed.isOn` is set. */
async function answerChangedDeck(
  changed: RouteSwitch,
  changedFiles: string[],
  route: Route,
): Promise<void> {
  if (!changed.isOn) {
    await route.fallback();
    return;
  }
  await answerDeck(changedFiles, route);
}

/** Answers Tables with a new `answer` once `changed.isOn` is set. */
async function answerChangedTables(
  changed: RouteSwitch,
  route: Route,
): Promise<void> {
  if (!changed.isOn) {
    await route.fallback();
    return;
  }
  const response = await route.fetch();
  const text = await response.text();
  await route.fulfill({
    response,
    body: text.replace('answer: "The pipe, |"', 'answer: "A vertical bar"'),
  });
}

async function answerExtraCard(text: string, route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/markdown",
    body: text,
  });
}

async function serveDeck(page: Page, cardFiles: string[]): Promise<void> {
  await page.route(
    FLASHCARDS_COLLECTION_GLOB,
    answerDeck.bind(undefined, cardFiles),
  );
}

async function serveExtraCards(page: Page): Promise<void> {
  for (const [fileName, text] of Object.entries(EXTRA_CARDS)) {
    await page.route(
      `**${FLASHCARDS_CARDS_FOLDER_PATH}/${fileName}`,
      answerExtraCard.bind(undefined, text),
    );
  }
}

function rowButton(frame: Frame, name: string): Locator {
  return frame.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(name)}, `),
  });
}

/** Opens the mod on the sample deck, or on the deck a route serves, and waits for its first row. */
async function openFlashcards(page: Page, firstName: string): Promise<Frame> {
  await page.goto(`/${FLASHCARDS_COLLECTION_RUN_HASH}`);
  const frame = await findModFrame(page, "Flashcards");
  await expect(rowButton(frame, firstName)).toBeVisible();
  return frame;
}

async function openSampleDeck(page: Page): Promise<Frame> {
  const frame = await openFlashcards(page, "Emphasis");
  return frame;
}

/** Opens the mod on a deck of one sample card. */
async function openOneCard(
  page: Page,
  cardFile: string,
  name: string,
): Promise<Frame> {
  await serveDeck(page, [cardFile]);
  const frame = await openFlashcards(page, name);
  return frame;
}

function modeButton(frame: Frame, name: string): Locator {
  return frame.getByRole("button", { name, exact: true });
}

function tileTable(frame: Frame): Locator {
  return frame.getByRole("table");
}

function tileCard(frame: Frame, name: string): Locator {
  return frame.getByRole("dialog", { name });
}

function setupDialog(frame: Frame): Locator {
  return frame.getByRole("dialog", { name: "Study setup" });
}

function anyDialog(frame: Frame): Locator {
  return frame.getByRole("dialog");
}

function cardPosition(frame: Frame): Locator {
  return frame.locator("#study-position");
}

function flashcard(frame: Frame): Locator {
  return frame.locator("article[data-flashcard]");
}

function questionSide(frame: Frame): Locator {
  return frame.locator('[data-side="question"]');
}

function answerSide(frame: Frame): Locator {
  return frame.locator('[data-side="answer"]');
}

async function openTablesCard(frame: Frame): Promise<Locator> {
  await rowButton(frame, "Tables").click();
  const card = tileCard(frame, "Tables");
  await expect(card).toBeVisible();
  return card;
}

/** Presses Study, chooses the question when given, and presses Start. */
async function startStudying(frame: Frame, question?: string): Promise<void> {
  await modeButton(frame, "Study").click();
  const setup = setupDialog(frame);
  await expect(setup).toBeVisible();
  if (question !== undefined) {
    await setup.getByLabel("Question").selectOption({ label: question });
  }
  await setup.getByRole("button", { name: "Start" }).click();
  await expect(setup).toBeHidden();
}

async function stepToThirdCard(frame: Frame): Promise<void> {
  for (let step = 0; step < 2; step += 1) {
    await frame.getByRole("button", { name: "Show answer" }).click();
    await frame.getByRole("button", { name: "I knew it" }).press("Enter");
  }
  await expect(cardPosition(frame)).toHaveText("Card 3 of 8");
}

async function reloadTiles(page: Page): Promise<void> {
  await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();
}

/** Opens the mod again in a new document, so its frame starts from scratch. */
async function reopenSampleDeck(page: Page): Promise<Frame> {
  await page.goto("about:blank");
  const frame = await openSampleDeck(page);
  return frame;
}

interface TextLook {
  fontStyle: string;
  color: string;
}

/** Runs on an element: its computed font style and color. */
function readTextLook(element: Element): TextLook {
  const style = getComputedStyle(element);
  const look: TextLook = { fontStyle: style.fontStyle, color: style.color };
  return look;
}

/** Runs in a frame: `value` as the frame computes `property`, such as a `calc()` of tokens. */
function readValueAs(valueAndProperty: string[]): string {
  const [value, property] = valueAndProperty;
  const probe = document.createElement("div");
  probe.style.setProperty(property, value);
  document.body.append(probe);
  const computed = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return computed;
}

interface CardLook {
  background: string;
  shadow: string;
  radius: string;
}

/** Runs on the flashcard: its computed background, shadow and corner radius. */
function readCardLook(element: Element): CardLook {
  const style = getComputedStyle(element);
  const look: CardLook = {
    background: style.backgroundColor,
    shadow: style.boxShadow,
    radius: style.borderTopLeftRadius,
  };
  return look;
}

/** Runs on an element: one of its computed properties. */
function readComputed(element: Element, property: string): string {
  return getComputedStyle(element).getPropertyValue(property);
}

interface Point {
  x: number;
  y: number;
}

/** Runs on an element: its center, in the frame's coordinates. */
function readCenter(element: Element): Point {
  const box = element.getBoundingClientRect();
  const center: Point = {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
  return center;
}

/** Runs in a frame: the text of the button at a point, or "" when there is none. */
function readButtonTextAt(point: Point): string {
  const button = document.elementFromPoint(point.x, point.y)?.closest("button");
  return button?.textContent?.trim() ?? "";
}

/** Runs in a frame: the height of its viewport. */
function readViewportHeight(): number {
  return window.innerHeight;
}

/** Opens the sample deck in a color scheme, and starts a session with the default fields. */
async function startSampleSession(
  page: Page,
  colorScheme: "light" | "dark",
): Promise<Frame> {
  await page.emulateMedia({ colorScheme });
  const frame = await openSampleDeck(page);
  await startStudying(frame);
  return frame;
}

/** Opens the mod viewer on the flashcards mod. */
async function openViewer(page: Page): Promise<Frame> {
  await page.goto(`/#/run?mod=mod_viewer&target=${FLASHCARDS_MOD_REFERENCE}`);
  const viewer = await findModFrame(page, "Mod Viewer");
  await expect(
    viewer.getByRole("heading", { level: 1, name: /Flashcards/ }),
  ).toBeVisible();
  return viewer;
}

test.describe(
  "The sample in the app",
  { tag: "@sample" },
  function describeSampleInApp(): void {
    test("Inspect the sample", async function inspectsSample({
      page,
    }): Promise<void> {
      const viewer = await openViewer(page);

      const permissions = viewer
        .getByRole("heading", { name: "Permissions" })
        .locator("xpath=following-sibling::*[1]");
      await expect(permissions).toHaveText("(none)");
    });

    test("Check mod passes", async function checksSample({
      page,
    }): Promise<void> {
      // The check runs every case of test.js, each in a fresh frame.
      test.setTimeout(180000);
      const viewer = await openViewer(page);

      await viewer.getByRole("button", { name: "Check mod" }).click();

      const report = viewer.getByRole("region", { name: "Check report" });
      await expect(report.getByRole("heading")).toContainText("Check passed", {
        timeout: 170000,
      });
      await expect(report.getByText("No findings.")).toBeVisible();
    });
  },
);

test.describe(
  "Explore and Study modes",
  { tag: "@sample" },
  function describeModes(): void {
    test("Start in Explore", async function startsInExplore({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);

      await expect(modeButton(frame, "Explore")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(modeButton(frame, "Study")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(tileTable(frame)).toBeVisible();
      await expect(frame.getByRole("row")).toHaveCount(
        SAMPLE_CARD_FILES.length + 1,
      );
    });

    test("Switch to Study", async function switchesToStudy({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);

      await modeButton(frame, "Study").click();

      await expect(setupDialog(frame)).toBeVisible();
      await expect(modeButton(frame, "Study")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(modeButton(frame, "Explore")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(tileTable(frame)).toHaveCount(0);
    });
  },
);

test.describe(
  "Tile table",
  { tag: "@sample" },
  function describeTileTable(): void {
    test("Click on the file cell", async function opensFromFileCell({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);

      await frame.getByRole("cell", { name: "tables.md", exact: true }).click();

      await expect(tileCard(frame, "Tables")).toBeVisible();
    });

    test("Names from the tiles", async function namesTiles({
      page,
    }): Promise<void> {
      await serveExtraCards(page);
      await serveDeck(page, ["monad.md", "notes_03.md"]);

      const frame = await openFlashcards(page, "What is a monad?");

      await expect(frame.locator("td > button")).toHaveText([
        "What is a monad?",
        "No title",
      ]);
    });

    test("No title and no heading", async function showsNoTitle({
      page,
    }): Promise<void> {
      await serveExtraCards(page);
      await serveDeck(page, ["notes_03.md"]);
      const frame = await openFlashcards(page, "No title");
      const button = rowButton(frame, "No title");
      const mutedColor = await frame.evaluate(readTokenAs, [
        "--ot-muted-foreground",
        "color",
      ]);

      const look = await button.locator("span").evaluate(readTextLook);

      expect(look).toEqual({ fontStyle: "italic", color: mutedColor });
      await expect(button).toHaveAccessibleName(/No title.*notes_03\.md/);
      await button.click();
      await expect(tileCard(frame, "notes_03.md")).toBeVisible();
    });
  },
);

test.describe(
  "Tile card",
  { tag: "@sample" },
  function describeTileCard(): void {
    test("Open the card of Tables", async function opensTablesCard({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);

      const card = await openTablesCard(frame);

      await expect(card.getByRole("table").first()).toBeVisible();
      await expect(
        card.getByRole("heading", { name: "See also" }),
      ).toBeVisible();
      await expect(rowButton(frame, "Tables")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(rowButton(frame, "Links")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    test("Escape", async function closesOnEscape({ page }): Promise<void> {
      const frame = await openSampleDeck(page);
      await openTablesCard(frame);

      await page.keyboard.press("Escape");

      await expect(anyDialog(frame)).toHaveCount(0);
      await expect(rowButton(frame, "Tables")).toBeFocused();
    });

    test("Backdrop", async function closesOnBackdrop({ page }): Promise<void> {
      const frame = await openSampleDeck(page);
      const card = await openTablesCard(frame);
      const frameBox = await page
        .locator('iframe[title="Flashcards"]')
        .boundingBox();
      const cardBox = await card.boundingBox();
      if (frameBox === null || cardBox === null) {
        throw new Error("Expected the frame and the card to be shown");
      }
      const x = frameBox.x + 4;
      expect(x).toBeLessThan(cardBox.x);

      await page.mouse.click(x, cardBox.y + cardBox.height / 2);

      await expect(anyDialog(frame)).toHaveCount(0);
      await expect(rowButton(frame, "Tables")).toBeFocused();
    });

    test("Click inside", async function staysOpenOnInsideClick({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);
      const card = await openTablesCard(frame);

      await card.getByText("Pipes separate the cells").click();

      await expect(card).toBeVisible();
    });

    test("Reloaded with the tile", async function followsTile({
      page,
    }): Promise<void> {
      const changed: RouteSwitch = { isOn: false };
      await page.route(
        `**${FLASHCARDS_CARDS_FOLDER_PATH}/tables.md`,
        answerChangedTables.bind(undefined, changed),
      );
      const frame = await openSampleDeck(page);
      const card = await openTablesCard(frame);
      changed.isOn = true;

      await reloadTiles(page);

      await expect(card.getByText("A vertical bar")).toBeVisible();
      await expect(card).toBeVisible();
    });

    test("Reloaded without the tile", async function closesWithoutTile({
      page,
    }): Promise<void> {
      const changed: RouteSwitch = { isOn: false };
      await page.route(
        FLASHCARDS_COLLECTION_GLOB,
        answerChangedDeck.bind(undefined, changed, ["emphasis.md", "links.md"]),
      );
      const frame = await openSampleDeck(page);
      await openTablesCard(frame);
      changed.isOn = true;

      await reloadTiles(page);

      await expect(anyDialog(frame)).toHaveCount(0);
      await expect(frame.locator("td > button")).toHaveCount(2);
    });
  },
);

test.describe(
  "Study session",
  { tag: "@sample" },
  function describeStudySession(): void {
    test("Step with Enter", async function stepsWithEnter({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);
      await startStudying(frame);
      await expect(
        frame.getByRole("button", { name: "Show answer" }),
      ).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(
        frame.getByRole("button", { name: "I knew it" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(cardPosition(frame)).toHaveText("Card 2 of 8");
      await expect(
        frame.getByRole("button", { name: "Show answer" }),
      ).toBeFocused();
    });

    test("Math in the heading", async function showsMathHeading({
      page,
    }): Promise<void> {
      const frame = await openOneCard(page, "math.md", "Math");

      await startStudying(frame, "First heading");

      await expect(questionSide(frame).locator("h2 math")).toHaveCount(1);
      await expect(questionSide(frame).locator("h2")).toBeVisible();
      await expect(
        questionSide(frame).getByText("A formula inside a sentence"),
      ).toBeHidden();
    });

    test("A diagram waits for the answer", async function drawsDiagramAfterFlip({
      page,
    }): Promise<void> {
      const frame = await openOneCard(page, "diagrams.md", "Diagrams");
      await startStudying(frame, "First heading");
      const question = questionSide(frame);
      await expect(
        question.getByRole("heading", { name: "Diagrams" }),
      ).toBeVisible();
      // A diagram in view is drawn in about a second: long enough to see one.
      await page.waitForTimeout(3000);

      await expect(
        question.locator("figure[data-mermaid-source] svg"),
      ).toHaveCount(0);
      await expect(question.getByText("This note was written")).toBeHidden();
      await frame.getByRole("button", { name: "Show answer" }).click();

      const answer = answerSide(frame);
      await expect(
        answer.locator("figure[data-mermaid-source] svg"),
      ).toBeVisible();
      await expect(answer.getByText("This note was written")).toBeHidden();
      await expect(question.getByText("This note was written")).toBeHidden();
    });

    test("Back to the session", async function returnsFromFullTile({
      page,
    }): Promise<void> {
      const frame = await openOneCard(page, "tables.md", "Tables");
      await startStudying(frame);
      await frame.getByRole("button", { name: "Show answer" }).click();
      await frame.getByRole("button", { name: "Open full tile" }).click();
      const card = tileCard(frame, "Tables");
      await expect(
        card.getByRole("heading", { name: "See also" }),
      ).toBeVisible();

      await page.keyboard.press("Escape");

      await expect(anyDialog(frame)).toHaveCount(0);
      await expect(
        frame.getByRole("button", { name: "Open full tile" }),
      ).toBeFocused();
      await expect(cardPosition(frame)).toHaveText("Card 1 of 1");
      await expect(answerSide(frame).locator("[data-side-text]")).toHaveText(
        "The pipe, |",
      );
    });
  },
);

test.describe(
  "Study card look",
  { tag: "@sample" },
  function describeStudyCardLook(): void {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`A flashcard (${colorScheme})`, async function showsFlashcard({
        page,
      }): Promise<void> {
        const frame = await startSampleSession(page, colorScheme);
        const expected: CardLook = {
          background: await frame.evaluate(readTokenAs, [
            "--ot-card",
            "background-color",
          ]),
          shadow: await frame.evaluate(readTokenAs, [
            "--ot-shadow",
            "box-shadow",
          ]),
          radius: await frame.evaluate(readValueAs, [
            "calc(var(--ot-radius) * 2)",
            "border-top-left-radius",
          ]),
        };

        const card = flashcard(frame);

        expect(await card.evaluate(readCardLook)).toEqual(expected);
        const box = await card.boundingBox();
        expect(box?.width).toBeLessThanOrEqual(512);
      });

      test(`The two sides (${colorScheme})`, async function showsSides({
        page,
      }): Promise<void> {
        const frame = await startSampleSession(page, colorScheme);
        const primary = await frame.evaluate(readTokenAs, [
          "--ot-primary",
          "border-top-color",
        ]);
        const muted = await frame.evaluate(readTokenAs, [
          "--ot-muted",
          "background-color",
        ]);

        await frame.getByRole("button", { name: "Show answer" }).click();

        await expect(questionSide(frame).getByText("Question")).toBeVisible();
        await expect(answerSide(frame).getByText("Answer")).toBeVisible();
        expect(
          await questionSide(frame).evaluate(readComputed, "border-top-color"),
        ).toBe(primary);
        expect(
          await answerSide(frame).evaluate(readComputed, "background-color"),
        ).toBe(muted);
      });
    }

    test("The position", async function showsPosition({ page }): Promise<void> {
      const frame = await startSampleSession(page, "light");
      const mutedText = await frame.evaluate(readTokenAs, [
        "--ot-muted-foreground",
        "color",
      ]);

      await stepToThirdCard(frame);

      expect(await cardPosition(frame).evaluate(readComputed, "color")).toBe(
        mutedText,
      );
      const progress = frame.locator("[data-session-bar] > progress");
      await expect(progress).toHaveJSProperty("value", 2);
      await expect(progress).toHaveJSProperty("max", 8);
      await expect(
        flashcard(frame).getByRole("button", { name: "Restart" }),
      ).toHaveCount(0);
      const barBox = await frame.locator("[data-session-bar]").boundingBox();
      const cardBox = await flashcard(frame).boundingBox();
      expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeLessThanOrEqual(
        cardBox?.y ?? 0,
      );
    });

    test("Same place after the flip", async function keepsButtonRow({
      page,
    }): Promise<void> {
      const frame = await startSampleSession(page, "light");
      const showAnswerBox = await frame
        .getByRole("button", { name: "Show answer" })
        .boundingBox();

      await frame.getByRole("button", { name: "Show answer" }).click();

      const knewItBox = await frame
        .getByRole("button", { name: "I knew it" })
        .boundingBox();
      const answerBox = await answerSide(frame).boundingBox();
      expect(knewItBox?.y).toBe(showAnswerBox?.y);
      expect(
        (knewItBox?.y ?? 0) + (knewItBox?.height ?? 0),
      ).toBeLessThanOrEqual(answerBox?.y ?? 0);
    });

    test("Double-click on Show answer", async function ignoresSecondClick({
      page,
    }): Promise<void> {
      const frame = await startSampleSession(page, "light");
      const showAnswer = frame.getByRole("button", { name: "Show answer" });
      const point = await showAnswer.evaluate(readCenter);

      await showAnswer.dblclick();

      await expect(answerSide(frame)).toBeVisible();
      expect(await frame.evaluate(readButtonTextAt, point)).toBe("Not yet");
      // The second click lands on the grade under the pointer, within the pause.
      await page.waitForTimeout(600);
      await expect(cardPosition(frame)).toHaveText("Card 1 of 8");
    });

    test("Click after the pause", async function gradesAfterPause({
      page,
    }): Promise<void> {
      const frame = await startSampleSession(page, "light");
      await frame.getByRole("button", { name: "Show answer" }).click();
      await page.waitForTimeout(600);

      await frame.getByRole("button", { name: "Not yet" }).click();

      await expect(cardPosition(frame)).toHaveText("Card 2 of 8");
    });

    test("A long answer", async function keepsButtonsInView({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1100, height: 520 });
      const frame = await openOneCard(page, "tables.md", "Tables");
      await startStudying(frame, "First heading");

      await frame.getByRole("button", { name: "Show answer" }).click();

      await expect(answerSide(frame).getByRole("table").first()).toBeAttached();
      const frameHeight = await frame.evaluate(readViewportHeight);
      const cardBox = await flashcard(frame).boundingBox();
      const frameBox = await page
        .locator('iframe[title="Flashcards"]')
        .boundingBox();
      // The card with its answer is taller than the frame shows.
      expect(
        (cardBox?.y ?? 0) + (cardBox?.height ?? 0) - (frameBox?.y ?? 0),
      ).toBeGreaterThan(frameHeight);
      await expect(
        frame.getByRole("button", { name: "I knew it" }),
      ).toBeInViewport();
    });

    test("Reduced motion", async function showsAnswerWithoutMotion({
      page,
    }): Promise<void> {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const frame = await openSampleDeck(page);
      await startStudying(frame);

      await frame.getByRole("button", { name: "Show answer" }).click();

      expect(
        await answerSide(frame).evaluate(readComputed, "animation-name"),
      ).toBe("none");
    });

    test("Focus at the end of a round", async function focusesRoundEnd({
      page,
    }): Promise<void> {
      const frame = await openOneCard(page, "tables.md", "Tables");
      await startStudying(frame);
      await frame.getByRole("button", { name: "Show answer" }).click();

      await frame.getByRole("button", { name: "Not yet" }).press("Enter");

      await expect(frame.getByText("You knew 0 of 1 card.")).toBeVisible();
      await expect(
        frame.getByRole("list", { name: "Not yet · 1 card" }),
      ).toHaveText("Tables");
      const missedButton = frame.getByRole("button", {
        name: "Study this card again",
      });
      await expect(missedButton).toBeFocused();
      await missedButton.click();
      await expect(frame.getByText("Round 2")).toBeVisible();
      await frame.getByRole("button", { name: "Show answer" }).click();
      await frame.getByRole("button", { name: "I knew it" }).press("Enter");
      await expect(frame.getByText("You knew 1 of 1 card.")).toBeVisible();
      await expect(
        frame.getByRole("button", { name: "Start again" }),
      ).toBeFocused();
    });
  },
);

test.describe(
  "Tiles changed during a session",
  { tag: "@sample" },
  function describeTilesChanged(): void {
    test("Reload while studying", async function endsSessionOnReload({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);
      await startStudying(frame);
      await stepToThirdCard(frame);

      await reloadTiles(page);

      const setup = setupDialog(frame);
      await expect(setup).toBeVisible();
      await expect(setup).toContainText(TILES_CHANGED_NOTICE);
      await expect(setup.getByLabel("Question")).toHaveValue("key:question");
    });

    test("Reload while the full tile is open", async function closesFullTileOnReload({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);
      await startStudying(frame);
      await frame.getByRole("button", { name: "Show answer" }).click();
      await frame.getByRole("button", { name: "Open full tile" }).click();
      await expect(anyDialog(frame)).toHaveCount(1);

      await reloadTiles(page);

      await expect(setupDialog(frame)).toBeVisible();
      await expect(anyDialog(frame)).toHaveCount(1);
    });

    test("Reload while the setup dialog is open", async function updatesOpenSetup({
      page,
    }): Promise<void> {
      const changed: RouteSwitch = { isOn: false };
      await page.route(
        FLASHCARDS_COLLECTION_GLOB,
        answerChangedDeck.bind(
          undefined,
          changed,
          SAMPLE_CARD_FILES.slice(0, 5),
        ),
      );
      const frame = await openSampleDeck(page);
      await modeButton(frame, "Study").click();
      await expect(setupDialog(frame)).toContainText("of 8 tiles");
      changed.isOn = true;

      await reloadTiles(page);

      await expect(setupDialog(frame)).toContainText(
        "5 of 5 tiles have these fields.",
      );
    });
  },
);

test.describe(
  "Remembered fields",
  { tag: "@sample" },
  function describeRememberedFields(): void {
    test("Fields kept across starts", async function keepsFields({
      page,
    }): Promise<void> {
      const frame = await openSampleDeck(page);
      await modeButton(frame, "Study").click();
      const setup = setupDialog(frame);
      await setup.getByLabel("Question").selectOption({ label: "title" });
      await setup.getByLabel("Answer").selectOption({ label: "Body" });
      await setup.getByRole("button", { name: "Start" }).click();
      await expect(cardPosition(frame)).toHaveText("Card 1 of 8");

      const reopened = await reopenSampleDeck(page);
      await modeButton(reopened, "Study").click();

      const reopenedSetup = setupDialog(reopened);
      await expect(reopenedSetup.getByLabel("Question")).toHaveValue(
        "key:title",
      );
      await expect(reopenedSetup.getByLabel("Answer")).toHaveValue("body");
    });
  },
);
