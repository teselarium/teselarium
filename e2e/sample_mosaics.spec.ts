import { expect, test } from "@playwright/test";
import type { Frame, FrameLocator, Locator, Page } from "@playwright/test";
import {
  expectNoIssues,
  findModFrame,
  routeCovers,
  routeImages,
} from "./mod_routes.ts";
import { routeNpmFiles } from "./sample_mod.ts";

// The shipped sample mosaics (public/samples/mosaics/): what each one opens,
// and that each passes its check. The covers and portraits are answered
// locally, so no test needs the network.

const BOOKS_MOSAIC_REFERENCE = "./samples/mosaics/nobel_books_list.yaml";
const MAP_MOSAIC_REFERENCE = "./samples/mosaics/nobel_laureates_map.yaml";

/** The sample books: every tile of `literature_nobel_laureates_books`. */
const SAMPLE_BOOK_COUNT = 51;

/** The covers of the sample books that are not on upload.wikimedia.org, which `routeCovers` answers. */
const OPEN_LIBRARY_COVERS_GLOB = "https://covers.openlibrary.org/**";

/** Where Open Library's cover of "The Years" redirects to, then its mirror. */
const ARCHIVE_COVER_URL =
  "https://archive.org/download/m_covers_0000/968944-L.jpg";
const ARCHIVE_MIRROR_COVER_URL =
  "https://ia800100.us.archive.org/view_archive.php?archive=m_covers_0000.zip&file=968944-L.jpg";

/** The markers of the 17 laureates, one per country of birth, sorted. */
const LAUREATE_MARKER_NAMES = [
  "Austria, 1 tile",
  "Canada, 2 tiles",
  "China, 1 tile",
  "France, 2 tiles",
  "Hungary, 1 tile",
  "Japan, 1 tile",
  "Norway, 1 tile",
  "Peru, 1 tile",
  "Poland, 1 tile",
  "South Korea, 1 tile",
  "Sweden, 1 tile",
  "Tanzania, 1 tile",
  "Ukraine, 1 tile",
  "United States, 2 tiles",
];

/** How long a sample mosaic's check may take: it runs every case of its mod's test file, each in a fresh frame. */
const SAMPLE_CHECK_TIMEOUT = 170000;

function buildMosaicRunLink(mosaic: string): string {
  const link = `/#/run?mosaic=${mosaic}`;
  return link;
}

/** Runs in the page before the app: "Load media linked by tiles" off, so only the mosaic's permissions allow the covers. */
function turnOffTileLinkedMedia(): void {
  localStorage.setItem("opentesela.tile-linked-media", "false");
}

/** Answers every host the samples' covers and portraits load from with a 1×1 PNG. */
async function routeSampleImages(page: Page): Promise<void> {
  await routeCovers(page);
  await routeImages(page, OPEN_LIBRARY_COVERS_GLOB);
  await routeImages(page, "https://archive.org/**");
  await routeImages(page, "https://ia800100.us.archive.org/**");
}

function bookButton(frame: Frame, title: string): Locator {
  return frame.getByRole("button", { name: new RegExp(`^${title}(,|$)`) });
}

async function openBooksMosaic(page: Page): Promise<Frame> {
  await routeSampleImages(page);
  await page.goto(buildMosaicRunLink(BOOKS_MOSAIC_REFERENCE));
  const frame = await findModFrame(page, "Book List");
  await expect(bookButton(frame, "The Years")).toBeVisible();
  return frame;
}

async function openMapMosaic(page: Page): Promise<Frame> {
  await routeNpmFiles(page);
  await routeSampleImages(page);
  await page.goto(buildMosaicRunLink(MAP_MOSAIC_REFERENCE));
  const frame = await findModFrame(page, "Country Map");
  await expect(markerButtons(frame).first()).toBeVisible();
  return frame;
}

/** The map's markers, and the "Not on the map" button when some tiles are not on it. */
function markerButtons(frame: Frame): Locator {
  return frame.getByRole("button", { name: /, \d+ tiles?$/ });
}

async function readMarkerNames(frame: Frame): Promise<string[]> {
  const names = await markerButtons(frame).evaluateAll(listAriaLabels);
  names.sort();
  return names;
}

/** Runs in the frame: the `aria-label` of each element. */
function listAriaLabels(elements: Element[]): string[] {
  const labels: string[] = [];
  for (const element of elements) {
    labels.push(element.getAttribute("aria-label") ?? "");
  }
  return labels;
}

/** Runs in the book list's frame: the number of columns of the grid. */
function readColumnCount(): number {
  const list = document.querySelector("ul");
  if (list === null) {
    throw new Error("Expected the book list's list of books");
  }
  const tracks = getComputedStyle(list).gridTemplateColumns.split(" ");
  return tracks.length;
}

function readNaturalWidth(image: Element): number {
  return (image as HTMLImageElement).naturalWidth;
}

/** Runs in the frame: whether each image loads. It is sent to the frame whole, so it defines its own listener. */
async function loadImages(urls: string[]): Promise<boolean[]> {
  const loads: Promise<boolean>[] = [];
  for (const url of urls) {
    const image = new Image();
    loads.push(
      new Promise<boolean>(function waitForImage(resolve): void {
        image.addEventListener("load", resolve.bind(undefined, true));
        image.addEventListener("error", resolve.bind(undefined, false));
      }),
    );
    image.src = url;
  }
  const loaded = await Promise.all(loads);
  return loaded;
}

function mosaicViewerFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Mosaic Viewer"]');
}

/** Checks a sample mosaic in the visible mosaic viewer, as a user would, and gives the report once its status heading is shown. */
async function checkSampleMosaic(page: Page, mosaic: string): Promise<Locator> {
  await page.goto(
    `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(mosaic)}`,
  );
  const viewer = mosaicViewerFrame(page);
  await viewer.getByRole("button", { name: "Check mosaic" }).click();
  const report = viewer.getByRole("region", { name: "Check report" });
  await expect(report.getByRole("heading")).toBeVisible({
    timeout: SAMPLE_CHECK_TIMEOUT,
  });
  return report;
}

async function expectPassingReport(report: Locator): Promise<void> {
  await expect(report.getByRole("heading")).toHaveText("Check passed pass");
  await expect(report.getByText("No findings.")).toBeVisible();
}

test.describe(
  "Books by Nobel laureates",
  { tag: "@sample" },
  function describeBooksMosaic(): void {
    test("Open the books", async function opensBooks({ page }): Promise<void> {
      await page.setViewportSize({ width: 1600, height: 900 });
      const frame = await openBooksMosaic(page);

      await expect(frame.locator("li > button")).toHaveCount(SAMPLE_BOOK_COUNT);
      await expect(frame.getByLabel("Books per row")).toHaveValue("8");
      expect(await frame.evaluate(readColumnCount)).toBe(8);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectNoIssues(page);
    });

    // Playwright routes only the first request of a redirect, so the test
    // checks each host of Open Library's redirect on its own, with "Load
    // media linked by tiles" off: only the mosaic's permissions allow them.
    test("Open Library cover", async function showsRedirectedCover({
      page,
    }): Promise<void> {
      await page.addInitScript(turnOffTileLinkedMedia);
      const frame = await openBooksMosaic(page);

      await bookButton(frame, "The Years").click();

      const cover = frame
        .getByRole("dialog", { name: "The Years" })
        .locator("figure > img");
      await expect
        .poll(cover.evaluate.bind(cover, readNaturalWidth))
        .toBeGreaterThan(0);
      expect(
        await frame.evaluate(loadImages, [
          ARCHIVE_COVER_URL,
          ARCHIVE_MIRROR_COVER_URL,
        ]),
      ).toEqual([true, true]);
      await expectNoIssues(page);
    });
  },
);

test.describe(
  "Nobel laureates on the map",
  { tag: "@sample" },
  function describeMapMosaic(): void {
    test("Every laureate reaches the map", async function placesLaureates({
      page,
    }): Promise<void> {
      const frame = await openMapMosaic(page);

      await expect
        .poll(readMarkerNames.bind(undefined, frame))
        .toEqual(LAUREATE_MARKER_NAMES);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectNoIssues(page);
    });

    test("A laureate's card", async function opensDylanCard({
      page,
    }): Promise<void> {
      await page.addInitScript(turnOffTileLinkedMedia);
      const frame = await openMapMosaic(page);
      const marker = frame.getByRole("button", {
        name: "United States, 2 tiles",
      });

      await marker.focus();
      await marker.press("Enter");
      await frame
        .locator("aside")
        .getByRole("button", { name: "Bob Dylan", exact: true })
        .click();

      const card = frame.getByRole("dialog", { name: "Bob Dylan" });
      await expect(card.getByRole("heading", { level: 2 })).toHaveText(
        "Bob Dylan",
      );
      const portrait = card.locator("figure > img");
      await expect
        .poll(portrait.evaluate.bind(portrait, readNaturalWidth))
        .toBeGreaterThan(0);
      const labels = await card.locator("dt").allTextContents();
      expect(labels).toContain("country");
      expect(labels).not.toContain("name");
      expect(labels).not.toContain("birth_country");
      await expectNoIssues(page);
    });
  },
);

test.describe(
  "The mosaic viewer opens the laureates' map",
  { tag: "@sample" },
  function describeViewerOpensMap(): void {
    test("Open the mosaic", async function opensMapFromViewer({
      page,
    }): Promise<void> {
      await routeNpmFiles(page);
      await routeSampleImages(page);
      await page.goto(
        `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(MAP_MOSAIC_REFERENCE)}`,
      );

      await mosaicViewerFrame(page)
        .getByRole("button", { name: "Open mosaic" })
        .click();

      const frame = await findModFrame(page, "Country Map");
      await expect
        .poll(readMarkerNames.bind(undefined, frame))
        .toEqual(LAUREATE_MARKER_NAMES);
      await expect(page.locator('iframe[title="Mosaic Viewer"]')).toBeHidden();
      await expect(
        page.locator('iframe[title="Mosaic Viewer"]'),
      ).toBeAttached();
    });
  },
);

test.describe(
  "The sample mosaics pass their checks",
  { tag: "@sample" },
  function describeSampleChecks(): void {
    test("Check the laureates' map", async function checksMapMosaic({
      page,
    }): Promise<void> {
      test.setTimeout(SAMPLE_CHECK_TIMEOUT + 10000);
      await routeNpmFiles(page);
      await routeSampleImages(page);

      const report = await checkSampleMosaic(page, MAP_MOSAIC_REFERENCE);

      await expectPassingReport(report);
    });

    test("Check the books", async function checksBooksMosaic({
      page,
    }): Promise<void> {
      test.setTimeout(SAMPLE_CHECK_TIMEOUT + 10000);
      await routeSampleImages(page);

      const report = await checkSampleMosaic(page, BOOKS_MOSAIC_REFERENCE);

      await expectPassingReport(report);
    });
  },
);
