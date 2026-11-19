import { expect, test } from "@playwright/test";
import type {
  Frame,
  FrameLocator,
  Locator,
  Page,
  Request,
  Route,
} from "@playwright/test";
import {
  actionDialog,
  buildModConf,
  checkFromChecker,
  expectNoIssues,
  findModFrame,
  ICON_SVG,
  isFrameMarked,
  markFrame,
  openChecker,
  readLoadedCovers,
  reloadTiles,
  routeCovers,
  serveAppOriginMod,
  stageBar,
} from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";
import {
  readSampleEntrypointCode,
  SAMPLE_BOOKS_FOLDER_PATH,
  SAMPLE_COLLECTION_GLOB,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_MOSAIC_RUN_HASH,
  SAMPLE_MOD_FILE_PATH,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_TEST_PATH,
  SAMPLE_TEST_RESULTS,
} from "./sample_mod.ts";
import {
  DARK_COLORS,
  listOwnLookDeclarations,
  readBodyColors,
  readTokenAs,
} from "./theme_probes.ts";

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
    "drafts/main.js": readSampleEntrypointCode(),
    "drafts/tiles.yaml": [
      "collection:",
      '  title: "Drafts"',
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

/** Opens the sample mod at `hash`, its default mosaic unless given, with every cover answered, and waits for its books. */
async function openSample(
  page: Page,
  hash: string = SAMPLE_MOSAIC_RUN_HASH,
): Promise<Frame> {
  await routeCovers(page);
  await page.goto(`/${hash}`);
  const frame = await findModFrame(page, "Book List");
  await expect(bookButton(frame, "Kallocain")).toBeVisible();
  return frame;
}

/** Opens the sample mod again in a new document, at `hash`, so its frame starts from scratch. */
async function reopenSample(
  page: Page,
  hash: string = SAMPLE_MOSAIC_RUN_HASH,
): Promise<Frame> {
  await page.goto("about:blank");
  const frame = await openSample(page, hash);
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
      '  title: "Two books"',
      "  tiles:",
      '    - path: "./books/farenheit_451.md"',
      '    - path: "./books/fictions.md"',
    ].join("\n"),
  });
}

/** The computed transform of a raised book: moved up by 2px. */
const RAISED_TRANSFORM = "matrix(1, 0, 0, 1, 0, -2)";

interface BookLook {
  boxShadow: string;
  transform: string;
}

/** A book that is not raised: no shadow, not moved. */
const FLAT_LOOK: BookLook = { boxShadow: "none", transform: "none" };

/** Runs on a book's button: its computed shadow and transform. */
function readBookLook(button: Element): BookLook {
  const style = getComputedStyle(button);
  const look: BookLook = {
    boxShadow: style.boxShadow,
    transform: style.transform,
  };
  return look;
}

/** The value of `--ot-shadow` as the frame computes a `box-shadow`. */
async function readThemeShadow(frame: Frame): Promise<string> {
  const themeShadow = await frame.evaluate(readTokenAs, [
    "--ot-shadow",
    "box-shadow",
  ]);
  return themeShadow;
}

/** Waits until the book's look settles on `expected`, after its transition. */
async function expectBookLook(
  frame: Frame,
  title: string,
  expected: BookLook,
): Promise<void> {
  const button = bookButton(frame, title);
  await expect
    .poll(button.evaluate.bind(button, readBookLook))
    .toEqual(expected);
}

/** Runs on an element: true when it shows the focus ring, as after keyboard focus. */
function showsFocusRing(element: Element): boolean {
  return element.matches(":focus-visible");
}

/** Expects the book to have focus, and to show the focus ring or not. */
async function expectBookFocus(
  frame: Frame,
  title: string,
  hasRing: boolean,
): Promise<void> {
  const button = bookButton(frame, title);
  await expect(button).toBeFocused();
  expect(await button.evaluate(showsFocusRing)).toBe(hasRing);
}

/** Expects the `aria-expanded` of the sample's three books, in order. */
async function expectExpandedStates(
  frame: Frame,
  states: string[],
): Promise<void> {
  for (const [index, title] of SAMPLE_TITLES.entries()) {
    await expect(bookButton(frame, title)).toHaveAttribute(
      "aria-expanded",
      states[index],
    );
  }
}

test.describe(
  "Books in a grid",
  { tag: "@sample" },
  function describeGrid(): void {
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
  },
);

test.describe(
  "Placeholder book",
  { tag: "@sample" },
  function describePlaceholder(): void {
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
  },
);

test.describe(
  "Books per row",
  { tag: "@sample" },
  function describeBooksPerRow(): void {
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

    test("Another collection", async function forgetsChoiceElsewhere({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      await booksPerRow(frame).selectOption("8");
      await expect(frame.locator('ul[data-columns="8"]')).toHaveCount(1);

      const reopened = await reopenSample(page, SAMPLE_COLLECTION_RUN_HASH);

      await expect(booksPerRow(reopened)).toHaveValue("6");
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
  },
);

test.describe(
  "Book card",
  { tag: "@sample" },
  function describeBookCard(): void {
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
  },
);

test.describe(
  "Book card behind",
  { tag: "@sample" },
  function describeGridBehindCard(): void {
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
  },
);

test.describe(
  "No cover in the card",
  { tag: "@sample" },
  function describeNoCoverInCard(): void {
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
  },
);

test.describe(
  "Card body",
  { tag: "@sample" },
  function describeCardBody(): void {
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
  },
);

test.describe(
  "Closing the card",
  { tag: "@sample" },
  function describeClosingCard(): void {
    test("Escape", async function closesOnEscape({ page }): Promise<void> {
      const frame = await openSample(page);
      await openKallocainCard(frame);

      await page.keyboard.press("Escape");

      await expect(bookCard(frame)).toHaveCount(0);
      await expectBookFocus(frame, "Kallocain", true);
    });

    test("Close button", async function closesOnButton({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const card = await openKallocainCard(frame);

      await card.getByRole("button", { name: "Close" }).click();
      await page.mouse.move(0, 0);

      await expect(bookCard(frame)).toHaveCount(0);
      await expectBookFocus(frame, "Kallocain", false);
      await expectBookLook(frame, "Kallocain", FLAT_LOOK);
    });

    test("Close button with the keyboard", async function closesOnButtonKey({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const card = await openKallocainCard(frame);
      const closeButton = card.getByRole("button", { name: "Close" });
      await closeButton.focus();

      await page.keyboard.press("Enter");

      await expect(bookCard(frame)).toHaveCount(0);
      await expectBookFocus(frame, "Kallocain", true);
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
      await expectBookFocus(frame, "Kallocain", false);
    });

    test("Click inside the card", async function staysOpenOnInsideClick({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const card = await openKallocainCard(frame);

      await card.getByText("Kallocain is a 1940 dystopian novel").click();

      await expect(card).toBeVisible();
    });
  },
);

test.describe(
  "Card follows the tiles",
  { tag: "@sample" },
  function describeCardFollowsTiles(): void {
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
      await expect(bookButton(frame, "Kallocain")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
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
  },
);

test.describe(
  "Raised book",
  { tag: "@sample" },
  function describeRaisedBook(): void {
    test("Raised on hover", async function raisesHoveredBook({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const themeShadow = await readThemeShadow(frame);

      await bookButton(frame, "Kallocain").hover();

      await expectBookLook(frame, "Kallocain", {
        boxShadow: themeShadow,
        transform: RAISED_TRANSFORM,
      });
      await expectBookLook(frame, "Fahrenheit 451", FLAT_LOOK);
      await expectBookLook(frame, "The Library of Babel", FLAT_LOOK);
    });

    test("Raised while the card is open", async function raisesOpenBook({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const themeShadow = await readThemeShadow(frame);

      await openKallocainCard(frame);
      await page.mouse.move(0, 0);

      await expectBookLook(frame, "Kallocain", {
        boxShadow: themeShadow,
        transform: RAISED_TRANSFORM,
      });
    });

    test("Back after closing", async function lowersClosedBook({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const card = await openKallocainCard(frame);
      await card.getByRole("button", { name: "Close" }).click();

      await frame.getByRole("heading", { name: "Book List" }).click();

      await expectBookLook(frame, "Kallocain", FLAT_LOOK);
    });

    test("Reduced motion", async function raisesWithoutMoving({
      page,
    }): Promise<void> {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const frame = await openSample(page);
      const themeShadow = await readThemeShadow(frame);

      await bookButton(frame, "Kallocain").hover();

      await expectBookLook(frame, "Kallocain", {
        boxShadow: themeShadow,
        transform: "none",
      });
    });
  },
);

test.describe(
  "The open book's state",
  { tag: "@sample" },
  function describeOpenBookState(): void {
    test("State while the card is open", async function marksOpenBook({
      page,
    }): Promise<void> {
      const frame = await openSample(page);

      await openKallocainCard(frame);

      await expect(
        frame.locator('li > button[aria-haspopup="dialog"]'),
      ).toHaveCount(3);
      await expectExpandedStates(frame, ["false", "true", "false"]);
    });

    test("State after closing", async function unmarksClosedBook({
      page,
    }): Promise<void> {
      const frame = await openSample(page);
      const card = await openKallocainCard(frame);

      await card.getByRole("button", { name: "Close" }).click();

      await expect(bookCard(frame)).toBeHidden();
      await expectExpandedStates(frame, ["false", "false", "false"]);
    });
  },
);

test.describe("Mod file", { tag: "@sample" }, function describeModFile(): void {
  test("Books with covers", async function showsCovers({
    page,
  }): Promise<void> {
    const frame = await openSample(page);

    for (const title of SAMPLE_TITLES) {
      await expect(bookButton(frame, title)).toBeVisible();
    }
    await expect(frame.getByText("Karin Boye")).toBeVisible();
    await expect(frame.getByText("Ray Bradbury")).toBeVisible();
    await expect(frame.getByText("Jorge Luis Borges")).toBeVisible();
    await expect
      .poll(frame.evaluate.bind(frame, readLoadedCovers))
      .toEqual([
        "Cover of Fahrenheit 451",
        "Cover of Kallocain",
        "Cover of The Library of Babel",
      ]);
  });

  test("The mod declares no permissions", async function inspectsSample({
    page,
  }): Promise<void> {
    await page.goto(`/#/run?mod=mod_viewer&target=${SAMPLE_MOD_REFERENCE}`);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
    await expect(
      viewer.getByRole("heading", { level: 1, name: /Book List/ }),
    ).toBeVisible();

    await expect(viewerDefinition(viewer, "Default mosaic")).toHaveText(
      /samples\/mods\/book_list\/mosaic\.yaml$/,
    );
    await expect(viewerDefinition(viewer, "API range")).toContainText(
      "^0.1.14",
    );
    await expect(viewerDefinition(viewer, "API range")).toContainText(
      "matches",
    );
    await expect(viewer.locator("dt", { hasText: /^Name$/ })).toHaveCount(0);
    await expect(
      viewer
        .getByRole("heading", { name: "Permissions" })
        .locator("xpath=following-sibling::*[1]"),
    ).toHaveText("(none)");
  });

  test("Sample matches the app's API", async function startsWithoutAsking({
    page,
  }): Promise<void> {
    await openSample(page);

    await expect(stageBar(page)).toContainText("Book List");
    await expectNoIssues(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

/** The description of `term` in the mod viewer's metadata list. */
function viewerDefinition(viewer: FrameLocator, term: string): Locator {
  return viewer
    .locator("dt", { hasText: new RegExp(`^${term}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

/** Records the address of each request whose path is `path`. */
function recordRequestTo(
  path: string,
  requestedUrls: string[],
  request: Request,
): void {
  if (new URL(request.url()).pathname === path) {
    requestedUrls.push(request.url());
  }
}

test.describe(
  "Mod tests",
  { tag: "@sample" },
  function describeModTests(): void {
    test("Sample tests", async function runsSampleTests({
      page,
    }): Promise<void> {
      const testFileRequests: string[] = [];
      page.on(
        "request",
        recordRequestTo.bind(undefined, SAMPLE_TEST_PATH, testFileRequests),
      );
      await openChecker(page, {});

      const report = await checkFromChecker(page, SAMPLE_MOD_REFERENCE);

      expect(report.tests).toEqual(SAMPLE_TEST_RESULTS);
      expect(testFileRequests).toHaveLength(1);
    });
  },
);

test.describe(
  "Theme look",
  { tag: "@sample" },
  function describeThemeLook(): void {
    test("Dark sample mod", async function drawsDarkSample({
      page,
    }): Promise<void> {
      await page.emulateMedia({ colorScheme: "dark" });

      const frame = await openSample(page);

      expect((await frame.evaluate(readBodyColors)).background).toBe(
        DARK_COLORS.background.computed,
      );
    });

    test("Sample mod's own styles", async function keepsOwnStylesToLayout({
      page,
    }): Promise<void> {
      const frame = await openSample(page);

      expect(await frame.evaluate(listOwnLookDeclarations)).toEqual([]);
    });
  },
);
