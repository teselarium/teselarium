import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page, Route } from "@playwright/test";
import {
  actionDialog,
  buildModConf,
  findModFrame,
  ICON_SVG,
  isFrameMarked,
  markFrame,
  routeCovers,
  serveAppOriginMod,
  stageBar,
} from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";
import {
  SAMPLE_BOOKS_FOLDER_PATH,
  SAMPLE_COLLECTION_GLOB,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_ENTRYPOINT_CODE,
  SAMPLE_MOD_FILE_PATH,
} from "./sample_mod.ts";
import { readTokenAs } from "./theme_probes.ts";

const SAMPLE_TITLES = ["Fahrenheit 451", "Kallocain", "The Library of Babel"];

/** The address of Kallocain's cover in its tile. */
const KALLOCAIN_COVER_GLOB = "**/KallocainCover.jpg";

/** The sample's Kallocain tile, which a test can serve with other metadata. */
const KALLOCAIN_TILE_GLOB = `**${SAMPLE_BOOKS_FOLDER_PATH}/kallocain.md`;

/** 4.5rem at the frame's 16px root font size: the narrowest a book may be. */
const BOOK_MIN_WIDTH = 72;

/** How much narrower than the viewport the mod's frame is, with the sidebar open (wide) and collapsed (narrow). */
const WIDE_FRAME_INSET = 272;
const NARROW_FRAME_INSET = 80;

const DRAFT_RUN_HASH =
  "#/run?mod=./test-mods/drafts/&collection=./test-mods/drafts/tiles.yaml";

/** A test mod that runs the sample's entrypoint on a tile without `image` and one with a cover. */
function buildDraftFiles(): ModFiles {
  const files: ModFiles = {
    "drafts/mod_conf.yaml": buildModConf("drafts", [
      '  title: "Drafts"',
      "  config:",
      "    show_covers: true",
    ]),
    "drafts/main.js": SAMPLE_ENTRYPOINT_CODE,
    "drafts/tiles.yaml": [
      "collection:",
      '  name: "Drafts"',
      "  tiles:",
      '    - path: "./books/kallocain.md"',
      '    - path: "./books/untitled_draft.md"',
    ].join("\n"),
    "drafts/books/kallocain.md":
      '---\ntitle: "Kallocain"\nimage: "./cover.svg"\n---\n\nA tile with a cover.\n',
    "drafts/books/untitled_draft.md":
      '---\ntitle: "Untitled draft"\n---\n\nA tile without a cover.\n',
    "drafts/books/cover.svg": ICON_SVG,
  };
  return files;
}

/** Sets the viewport so that the mod's frame gets `frameWidth`. */
async function sizeFrame(
  page: Page,
  frameWidth: number,
  inset: number,
): Promise<void> {
  await page.setViewportSize({ width: frameWidth + inset, height: 800 });
}

async function expectFrameWidth(page: Page, frameWidth: number): Promise<void> {
  const box = await page.locator('iframe[title="Book List"]').boundingBox();
  expect(box?.width).toBe(frameWidth);
}

/** Opens the sample mod on the sample collection, with every cover answered, and waits for its books. */
async function openSample(page: Page): Promise<Frame> {
  await routeCovers(page);
  await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
  const frame = await findModFrame(page, "Book List");
  await expect(bookButton(frame, "Kallocain")).toBeVisible();
  return frame;
}

/** Opens the sample mod again in a new document, so its frame starts from scratch. */
async function reopenSample(page: Page): Promise<Frame> {
  await page.goto("about:blank");
  const frame = await openSample(page);
  return frame;
}

function bookButton(frame: Frame, title: string): Locator {
  return frame.getByRole("button", { name: new RegExp(`^${title}(,|$)`) });
}

function bookItem(frame: Frame, title: string): Locator {
  return frame.getByRole("listitem").filter({ has: bookButton(frame, title) });
}

function booksPerRow(frame: Frame): Locator {
  return frame.getByLabel("Books per row");
}

function bookCard(frame: Frame): Locator {
  return frame.getByRole("dialog");
}

async function openKallocainCard(frame: Frame): Promise<Locator> {
  await bookButton(frame, "Kallocain").click();
  const card = frame.getByRole("dialog", { name: "Kallocain" });
  await expect(card).toBeVisible();
  return card;
}

interface BookBox {
  width: number;
  height: number;
}

/** Runs in the sample's frame: the size of each book's button, in order. */
function readBookBoxes(): BookBox[] {
  const boxes: BookBox[] = [];
  for (const button of document.querySelectorAll("li > button")) {
    const rectangle = button.getBoundingClientRect();
    boxes.push({ width: rectangle.width, height: rectangle.height });
  }
  return boxes;
}

/** Runs in the sample's frame: the number of columns of the grid. */
function readColumnCount(): number {
  const list = document.querySelector("ul");
  if (list === null) {
    throw new Error("Expected the sample's list of books");
  }
  const tracks = getComputedStyle(list).gridTemplateColumns.split(" ");
  return tracks.length;
}

interface CornerRadii {
  topLeft: string;
  bottomLeft: string;
  topRight: string;
  bottomRight: string;
}

/** Runs in the sample's frame: the corner radii of each book's button. */
function readBookCorners(): CornerRadii[] {
  const corners: CornerRadii[] = [];
  for (const button of document.querySelectorAll("li > button")) {
    const style = getComputedStyle(button);
    corners.push({
      topLeft: style.borderTopLeftRadius,
      bottomLeft: style.borderBottomLeftRadius,
      topRight: style.borderTopRightRadius,
      bottomRight: style.borderBottomRightRadius,
    });
  }
  return corners;
}

async function readFirstBookWidth(frame: Frame): Promise<number> {
  const boxes = await frame.evaluate(readBookBoxes);
  return boxes[0].width;
}

/** Answers the sample's mod file with `show_covers: false`. */
async function answerCoversOff(route: Route): Promise<void> {
  const response = await route.fetch();
  const text = await response.text();
  await route.fulfill({
    response,
    body: text.replace("show_covers: true", "show_covers: false"),
  });
}

async function answerMissingCover(route: Route): Promise<void> {
  await route.fulfill({ status: 404, body: "Not Found" });
}

/** Answers Kallocain's tile with `pages: 230` once `changed.isOn` is set. */
async function answerChangedKallocain(
  changed: { isOn: boolean },
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
    body: text.replace("pages: 220", "pages: 230"),
  });
}

/** Answers the sample collection without Kallocain once `withoutKallocain.isOn` is set. */
async function answerCollectionWithoutKallocain(
  withoutKallocain: { isOn: boolean },
  route: Route,
): Promise<void> {
  if (!withoutKallocain.isOn) {
    await route.fallback();
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "text/yaml",
    body: [
      "collection:",
      '  name: "Two books"',
      "  tiles:",
      '    - path: "./books/farenheit_451.md"',
      '    - path: "./books/fictions.md"',
    ].join("\n"),
  });
}

async function reloadTiles(page: Page): Promise<void> {
  await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();
}

test.describe("Books in a grid", function describeGrid(): void {
  test("The sample books", async function showsSampleBooks({
    page,
  }): Promise<void> {
    const frame = await openSample(page);

    await expect(frame.getByRole("listitem")).toHaveCount(3);
    await expect(frame.locator("li > p > strong")).toHaveText(SAMPLE_TITLES);
    const boxes = await frame.evaluate(readBookBoxes);
    for (const box of boxes) {
      expect(box.width).toBe(boxes[0].width);
      expect(box.height).toBe(boxes[0].height);
      expect(Math.abs(box.height - 1.5 * box.width)).toBeLessThanOrEqual(1);
    }
  });

  test("Corners of a book", async function shapesBooks({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const radius = await frame.evaluate(readTokenAs, [
      "--ot-radius",
      "border-top-right-radius",
    ]);

    const corners = await frame.evaluate(readBookCorners);

    expect(corners).toHaveLength(3);
    for (const corner of corners) {
      expect(corner).toEqual({
        topLeft: "0px",
        bottomLeft: "0px",
        topRight: radius,
        bottomRight: radius,
      });
    }
  });

  test("Text under the cover", async function showsTextUnderCover({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const item = bookItem(frame, "Kallocain");
    const title = item.getByText("Kallocain", { exact: true });

    await expect(title).toBeVisible();
    await expect(item.getByText("Karin Boye")).toBeVisible();
    const buttonBox = await bookButton(frame, "Kallocain").boundingBox();
    const titleBox = await title.boundingBox();
    expect(titleBox?.y).toBeGreaterThanOrEqual(
      (buttonBox?.y ?? 0) + (buttonBox?.height ?? 0),
    );
  });
});

test.describe("Placeholder book", function describePlaceholder(): void {
  test("Cover fails to load", async function showsPlaceholderForMissingCover({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.route(KALLOCAIN_COVER_GLOB, answerMissingCover);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const frame = await findModFrame(page, "Book List");
    const kallocain = bookButton(frame, "Kallocain");

    await expect(kallocain.locator("span")).toHaveText("Kallocain");
    await expect(kallocain.locator("img")).toHaveCount(0);
  });

  test("No image", async function showsPlaceholderWithoutImage({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildDraftFiles());
    await page.goto(`/${DRAFT_RUN_HASH}`);
    const frame = await findModFrame(page, "Drafts");
    const draft = bookButton(frame, "Untitled draft");

    await expect(draft.locator("span")).toHaveText("Untitled draft");
    await expect(draft.locator("img")).toHaveCount(0);
    const boxes = await frame.evaluate(readBookBoxes);
    expect(boxes[1]).toEqual(boxes[0]);
  });
});

test.describe("Books per row", function describeBooksPerRow(): void {
  test("Default books per row", async function showsSixPerRow({
    page,
  }): Promise<void> {
    await sizeFrame(page, 1200, WIDE_FRAME_INSET);
    const frame = await openSample(page);
    await expectFrameWidth(page, 1200);

    await expect(booksPerRow(frame)).toHaveValue("6");
    expect(await frame.evaluate(readColumnCount)).toBe(6);
  });

  test("Choosing books per row", async function choosesFourPerRow({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const widthBefore = await readFirstBookWidth(frame);

    await booksPerRow(frame).selectOption("4");

    expect(await frame.evaluate(readColumnCount)).toBe(4);
    expect(await readFirstBookWidth(frame)).toBeGreaterThan(widthBefore);
  });

  test("Authors left out at 10 per row", async function leavesOutAuthors({
    page,
  }): Promise<void> {
    const frame = await openSample(page);

    await booksPerRow(frame).selectOption("10");

    await expect(
      bookItem(frame, "Kallocain").getByText("Karin Boye"),
    ).toBeHidden();
    await expect(bookButton(frame, "Kallocain")).toHaveAccessibleName(
      /Karin Boye/,
    );
  });

  test("Choice kept across starts", async function keepsChoice({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    await booksPerRow(frame).selectOption("8");
    await expect(frame.locator('ul[data-columns="8"]')).toHaveCount(1);

    const reopened = await reopenSample(page);

    await expect(booksPerRow(reopened)).toHaveValue("8");
  });

  test("Ten per row in a narrow frame", async function fitsNarrowFrame({
    page,
  }): Promise<void> {
    await sizeFrame(page, 400, NARROW_FRAME_INSET);
    const frame = await openSample(page);
    await expectFrameWidth(page, 400);

    await booksPerRow(frame).selectOption("10");

    await expect(booksPerRow(frame)).toHaveValue("10");
    expect(await frame.evaluate(readColumnCount)).toBeLessThan(10);
    for (const box of await frame.evaluate(readBookBoxes)) {
      expect(box.width).toBeGreaterThanOrEqual(BOOK_MIN_WIDTH);
    }
  });
});

test.describe("Book card", function describeBookCard(): void {
  test("Open Kallocain's card", async function opensCard({
    page,
  }): Promise<void> {
    const frame = await openSample(page);

    const card = await openKallocainCard(frame);

    await expect(
      card.getByRole("heading", { level: 2, name: "Kallocain" }),
    ).toBeVisible();
    await expect(
      card.getByText("Kallocain is a 1940 dystopian novel"),
    ).toBeVisible();
  });
});

test.describe("Book card behind", function describeGridBehindCard(): void {
  test("Grid behind the card", async function keepsGridInert({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const fahrenheitBox = await bookButton(
      frame,
      "Fahrenheit 451",
    ).boundingBox();
    if (fahrenheitBox === null) {
      throw new Error("Expected Fahrenheit 451's book to be shown");
    }
    await openKallocainCard(frame);

    await page.mouse.click(
      fahrenheitBox.x + fahrenheitBox.width / 2,
      fahrenheitBox.y + fahrenheitBox.height / 2,
    );

    await expect(bookCard(frame)).toHaveCount(0);
    await expect(
      frame.getByRole("dialog", { name: "Fahrenheit 451" }),
    ).toHaveCount(0);
  });
});

test.describe("No cover in the card", function describeNoCoverInCard(): void {
  test("Covers switched off in the card", async function leavesOutSmallBook({
    page,
  }): Promise<void> {
    await page.route(`**${SAMPLE_MOD_FILE_PATH}`, answerCoversOff);
    const frame = await openSample(page);

    const card = await openKallocainCard(frame);

    await expect(card.locator("img, figure")).toHaveCount(0);
    await expect(
      card.getByRole("heading", { level: 2, name: "Kallocain" }),
    ).toBeVisible();
  });
});

test.describe("Card body", function describeCardBody(): void {
  test("A link in the body", async function opensBodyLink({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);
    await markFrame(frame);

    await card
      .getByRole("link", { name: "https://en.wikipedia.org/wiki/Kallocain" })
      .click();

    await expect(actionDialog(page)).toContainText(
      "https://en.wikipedia.org/wiki/Kallocain",
    );
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Closing the card", function describeClosingCard(): void {
  test("Escape", async function closesOnEscape({ page }): Promise<void> {
    const frame = await openSample(page);
    await openKallocainCard(frame);

    await page.keyboard.press("Escape");

    await expect(bookCard(frame)).toHaveCount(0);
    await expect(bookButton(frame, "Kallocain")).toBeFocused();
  });

  test("Close button", async function closesOnButton({ page }): Promise<void> {
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);

    await card.getByRole("button", { name: "Close" }).click();

    await expect(bookCard(frame)).toHaveCount(0);
    await expect(bookButton(frame, "Kallocain")).toBeFocused();
  });

  test("Backdrop", async function closesOnBackdrop({ page }): Promise<void> {
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);
    const frameBox = await page
      .locator('iframe[title="Book List"]')
      .boundingBox();
    const cardBox = await card.boundingBox();
    if (frameBox === null || cardBox === null) {
      throw new Error("Expected the frame and the card to be shown");
    }
    const x = frameBox.x + 4;
    expect(x).toBeLessThan(cardBox.x);

    await page.mouse.click(x, cardBox.y + cardBox.height / 2);

    await expect(bookCard(frame)).toHaveCount(0);
  });

  test("Click inside the card", async function staysOpenOnInsideClick({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);

    await card.getByText("Kallocain is a 1940 dystopian novel").click();

    await expect(card).toBeVisible();
  });
});

test.describe("Card follows the tiles", function describeCardFollowsTiles(): void {
  test("Tiles reloaded with the book", async function updatesOpenCard({
    page,
  }): Promise<void> {
    const changed = { isOn: false };
    await page.route(
      KALLOCAIN_TILE_GLOB,
      answerChangedKallocain.bind(undefined, changed),
    );
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);
    await expect(card.getByText("220", { exact: true })).toBeVisible();
    changed.isOn = true;

    await reloadTiles(page);

    await expect(card.getByText("230", { exact: true })).toBeVisible();
    await expect(card).toBeVisible();
  });

  test("Tiles reloaded without the book", async function closesOpenCard({
    page,
  }): Promise<void> {
    const withoutKallocain = { isOn: false };
    await page.route(
      SAMPLE_COLLECTION_GLOB,
      answerCollectionWithoutKallocain.bind(undefined, withoutKallocain),
    );
    const frame = await openSample(page);
    await openKallocainCard(frame);
    withoutKallocain.isOn = true;

    await reloadTiles(page);

    await expect(bookCard(frame)).toHaveCount(0);
    await expect(frame.getByRole("listitem")).toHaveCount(2);
  });
});

test.describe("Last opened book", function describeLastOpenedBook(): void {
  test("Mark after opening", async function marksOpenedBook({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);

    await card.getByRole("button", { name: "Close" }).click();

    await expect(bookButton(frame, "Kallocain")).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(frame.locator("[aria-current]")).toHaveCount(1);
  });

  test("Remembered across starts", async function remembersOpenedBook({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    const card = await openKallocainCard(frame);
    await card.getByRole("button", { name: "Close" }).click();
    await expect(bookButton(frame, "Kallocain")).toHaveAttribute(
      "aria-current",
      "true",
    );

    const reopened = await reopenSample(page);

    await expect(bookButton(reopened, "Kallocain")).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(bookCard(reopened)).toHaveCount(0);
  });
});
