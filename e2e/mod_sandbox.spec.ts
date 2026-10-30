import { expect, test } from "@playwright/test";
import type { Dialog, Frame, Page, Request, Route } from "@playwright/test";
import {
  addFullscreenButton,
  buildProbeFiles,
  COVER_HOST,
  embedObject,
  fetchFromFrame,
  findModFrame,
  FOREIGN_HOST,
  ICON_SVG,
  importFromFrame,
  isPageFullscreen,
  isPopupBlocked,
  issueList,
  navigateFrame,
  navigateTop,
  readFrameOrigin,
  readFullscreenOutcome,
  readLoadedCovers,
  readParentDocumentError,
  readProbeContext,
  readStorageError,
  recordHost,
  requestFromProbe,
  routeCovers,
  routeImages,
  serveAppOriginMod,
  serveForeignMod,
  showAssetNextToMod,
  showImage,
  stageBar,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import {
  SAMPLE_COLLECTION_GLOB,
  SAMPLE_COLLECTION_PATH,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_ENTRYPOINT_PATH,
} from "./sample_mod.ts";

const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";
const APP_PROBE_LINK = "/#/run?mod=./test-mods/probe/";
const FOREIGN_PROBE_LINK = `/#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/probe/`)}`;
const IMAGES_HOST = "https://images.example.net";
const API_HOST = "https://api.example.net";
const SHOW_COVERS_LINES = [
  "  permissions:",
  "    show:",
  `      - host: "${COVER_HOST}"`,
  '        reason: "Shows the book covers"',
];
const WILDCARD_COVERS_HOST = "https://*.covers.example.net";
const WILDCARD_COVERS_OWN_HOST = "https://covers.example.net";
const WILDCARD_COVERS_SUBDOMAIN = "https://a.covers.example.net";
const SHOW_WILDCARD_COVERS_LINES = buildPermissionLines(
  "show",
  WILDCARD_COVERS_HOST,
);

/** The `permissions` lines of a probe's mod file that declare one host in one category. */
function buildPermissionLines(category: string, host: string): string[] {
  const lines = [
    "  permissions:",
    `    ${category}:`,
    `      - host: "${host}"`,
    '        reason: "Test reason"',
  ];
  return lines;
}

async function openAppProbe(
  page: Page,
  extraLines: string[] = [],
  link: string = APP_PROBE_LINK,
): Promise<Frame> {
  await serveAppOriginMod(page, buildProbeFiles("probe", extraLines));
  await page.goto(link);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

async function openForeignProbe(
  page: Page,
  extraLines: string[] = [],
): Promise<{ frame: Frame; seenUrls: string[] }> {
  const seenUrls = await serveForeignMod(
    page,
    buildProbeFiles("probe", extraLines),
  );
  await page.goto(FOREIGN_PROBE_LINK);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  const openedProbe = { frame, seenUrls };
  return openedProbe;
}

test.describe("Each mod runs in its own sandboxed frame", function describeFrames(): void {
  test("Frame sandbox", async function checksFrameSandbox({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const frameElement = page.locator('iframe[title="Book List"]');

    await expect(frameElement).toHaveAttribute("sandbox", "allow-scripts");
    await expect(frameElement).not.toHaveAttribute("src");
    const frame = await findModFrame(page, "Book List");
    expect(await frame.evaluate(readFrameOrigin)).toBe("null");
  });

  test("No storage access", async function blocksStorage({
    page,
  }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    await page.evaluate(setAppStorageItem);
    const frame = await openAppProbe(page);

    expect(await frame.evaluate(readStorageError)).toBe("SecurityError");
    expect(await page.evaluate(readAppStorageItem)).toBe("kept");
  });

  test("No access to the app page", async function blocksParentDocument({
    page,
  }): Promise<void> {
    const frame = await openAppProbe(page);

    expect(await frame.evaluate(readParentDocumentError)).toBe("SecurityError");
  });

  test("Mod opened by another mod", async function opensSiblingFrame({
    page,
  }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = await findModFrame(page, "Mods");

    await explorer.getByRole("button", { name: /Book List/ }).click();
    await expect(stageBar(page)).toContainText("Mod Viewer");

    expect(page.mainFrame().childFrames()).toHaveLength(2);
    expect(explorer.childFrames()).toHaveLength(0);
    const viewer = await findModFrame(page, "Mod Viewer");
    expect(viewer.parentFrame()).toBe(page.mainFrame());
  });
});

function setAppStorageItem(): void {
  localStorage.setItem("app-item", "kept");
}

function readAppStorageItem(): string | null {
  return localStorage.getItem("app-item");
}

test.describe("A mod cannot navigate the app or open windows", function describeNavigation(): void {
  test("Top navigation is blocked", async function blocksTopNavigation({
    page,
  }): Promise<void> {
    const frame = await openAppProbe(page);
    const appUrl = page.url();

    const errorName = await frame.evaluate(navigateTop, "https://example.org/");

    expect(errorName).toBe("SecurityError");
    expect(page.url()).toBe(appUrl);
  });

  test("Popups are blocked", async function blocksPopups({
    page,
    context,
  }): Promise<void> {
    const frame = await openAppProbe(page);

    expect(await frame.evaluate(isPopupBlocked, "https://example.org/")).toBe(
      true,
    );
    expect(context.pages()).toHaveLength(1);
  });
});

test.describe("The engine delivers the mod code", function describeDelivery(): void {
  test("Entrypoint requested by the app", async function requestsEntrypoint({
    page,
  }): Promise<void> {
    const entrypointRequests: Request[] = [];
    page.on(
      "request",
      recordEntrypointRequest.bind(undefined, entrypointRequests),
    );
    await routeCovers(page);

    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    await findModFrame(page, "Book List");
    await expect(
      page.frameLocator('iframe[title="Book List"]').getByText("Kallocain"),
    ).toBeVisible();

    expect(entrypointRequests).toHaveLength(1);
    expect(entrypointRequests[0].frame()).toBe(page.mainFrame());
  });
});

function recordEntrypointRequest(requests: Request[], request: Request): void {
  if (request.url().endsWith(SAMPLE_ENTRYPOINT_PATH)) {
    requests.push(request);
  }
}

test.describe("The mod entrypoint is mounted", function describeMount(): void {
  test("Sample mod mounts", async function mountsSampleMod({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const sampleFrame = page.frameLocator('iframe[title="Book List"]');

    await expect(sampleFrame.getByText("Fahrenheit 451")).toBeVisible();
    await expect(sampleFrame.getByText("Kallocain")).toBeVisible();
    await expect(sampleFrame.getByText("The Library of Babel")).toBeVisible();
  });

  test("No default export function", async function reportsMissingMount({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {
      "broken/mod_conf.yaml":
        'mod:\n  name: "broken"\n  version: "0.1.0"\n  entrypoint: "./main.js"',
      "broken/main.js": "export const notMount = 1;\n",
    });

    await page.goto("/#/run?mod=./test-mods/broken/");

    await expect(issueList(page)).toContainText("error");
    await expect(issueList(page)).toContainText(
      "the entrypoint has no default export function",
    );
  });

  test("Mount throws", async function reportsMountError({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {
      "broken/mod_conf.yaml":
        'mod:\n  name: "broken"\n  version: "0.1.0"\n  entrypoint: "./main.js"',
      "broken/main.js":
        'export default function mount() { throw new Error("map failed"); }\n',
    });

    await page.goto("/#/run?mod=./test-mods/broken/");

    await expect(issueList(page)).toContainText("map failed");
    await expect(issueList(page)).toContainText(
      "/test-mods/broken/mod_conf.yaml",
    );
  });
});

test.describe("Default content policy", function describeDefaultPolicy(): void {
  test("Image from a content host", async function loadsContentHostImage({
    page,
  }): Promise<void> {
    const frame = await openAppProbe(page);
    const appOrigin = new URL(page.url()).origin;

    expect(await frame.evaluate(showImage, `${appOrigin}/favicon.svg`)).toBe(
      true,
    );
  });

  test("Image from another host", async function blocksOtherImage({
    page,
  }): Promise<void> {
    const seenUrls = await recordHost(page, `${IMAGES_HOST}/**`);
    const frame = await openAppProbe(page);

    expect(await frame.evaluate(showImage, `${IMAGES_HOST}/cover.jpg`)).toBe(
      false,
    );
    await expect(issueList(page)).toContainText(IMAGES_HOST);
    expect(seenUrls).toEqual([]);
  });

  test("Connections are blocked", async function blocksConnections({
    page,
  }): Promise<void> {
    const seenUrls = await recordHost(page, SAMPLE_COLLECTION_GLOB);
    const frame = await openAppProbe(page);
    const appOrigin = new URL(page.url()).origin;

    const outcome = await frame.evaluate(
      fetchFromFrame,
      `${appOrigin}${SAMPLE_COLLECTION_PATH}`,
    );

    expect(outcome).not.toBe("sent");
    expect(seenUrls).toEqual([]);
  });

  test("Remote scripts are blocked", async function blocksRemoteScripts({
    page,
  }): Promise<void> {
    const seenUrls = await recordHost(page, "https://cdn.example.net/**");
    const frame = await openAppProbe(page);

    const outcome = await frame.evaluate(
      importFromFrame,
      "https://cdn.example.net/library.js",
    );

    expect(outcome).not.toBe("imported");
    expect(seenUrls).toEqual([]);
    await expect(issueList(page)).toContainText("permissions.code");
  });
});

test.describe("Content hosts", function describeContentHosts(): void {
  test("Sample content hosts", async function usesAppOrigin({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const appOrigin = new URL(page.url()).origin;

    const sandboxDocument = await page
      .locator('iframe[title="Book List"]')
      .getAttribute("srcdoc");

    expect(sandboxDocument).toContain(
      `img-src data: blob: ${appOrigin} https://*.archive.org https://archive.org https://covers.openlibrary.org ${COVER_HOST};`,
    );
    expect(sandboxDocument).toContain("connect-src 'none'");
  });

  test("Tile from another host", async function allowsTileHost({
    page,
  }): Promise<void> {
    await page.route("https://tiles.example.net/**", answerRemoteTile);
    await serveAppOriginMod(page, {
      ...buildProbeFiles("probe"),
      "remote_tiles.yaml": [
        "collection:",
        '  name: "Remote tiles"',
        "  tiles:",
        '    - url: "https://tiles.example.net/books/kallocain.md"',
      ].join("\n"),
    });
    await page.goto(
      `${APP_PROBE_LINK}&collection=./test-mods/remote_tiles.yaml`,
    );
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);

    const context = await frame.evaluate(readProbeContext);

    expect(context.tiles).toHaveLength(1);
    expect(
      await frame.evaluate(showImage, "https://tiles.example.net/cover.png"),
    ).toBe(true);
  });
});

async function answerRemoteTile(route: Route): Promise<void> {
  const url = route.request().url();
  if (url.endsWith(".md")) {
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '---\ntitle: "Kallocain"\n---\n\nA remote tile.\n',
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  });
}

test.describe("Grant declared permissions to mods from the app's origin", function describeGrants(): void {
  test("Sample covers are shown", async function showsCovers({
    page,
  }): Promise<void> {
    const coverUrls = await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const frame = await findModFrame(page, "Book List");
    await expect(
      page.frameLocator('iframe[title="Book List"]').getByRole("img"),
    ).toHaveCount(3);

    await expect
      .poll(function countCovers(): Promise<number> {
        return frame.evaluate(readLoadedCovers).then(countItems);
      })
      .toBe(3);
    expect(coverUrls).toHaveLength(3);
  });

  test("Declared connection", async function sendsDeclaredConnection({
    page,
  }): Promise<void> {
    const seenUrls = await recordHost(page, `${API_HOST}/**`);
    const frame = await openAppProbe(page, [
      "  permissions:",
      "    connect:",
      `      - host: "${API_HOST}"`,
      '        reason: "Reads the data"',
    ]);

    expect(await frame.evaluate(fetchFromFrame, `${API_HOST}/data`)).toBe(
      "sent",
    );
    expect(seenUrls).toEqual([`${API_HOST}/data`]);
  });
});

function countItems(items: unknown[]): number {
  return items.length;
}

test.describe("Mods from other origins run with the default policy", function describeForeignMods(): void {
  test("Foreign mod with a show permission", async function deniesForeignShow({
    page,
  }): Promise<void> {
    const coverUrls = await routeCovers(page);
    const { frame } = await openForeignProbe(page, SHOW_COVERS_LINES);

    await expect(issueList(page)).toContainText("warning");
    await expect(issueList(page)).toContainText(
      `show content from ${COVER_HOST} ("Shows the book covers")`,
    );
    expect(await frame.evaluate(showImage, `${COVER_HOST}/cover.jpg`)).toBe(
      false,
    );
    expect(coverUrls).toEqual([]);
  });

  test("Foreign mod without permissions", async function reportsNothing({
    page,
  }): Promise<void> {
    await openForeignProbe(page);

    await expect(stageBar(page)).toContainText("No issues.");
  });
});

test.describe("Report blocked requests with the fix", function describeReports(): void {
  test("Undeclared image host", async function reportsImageHost({
    page,
  }): Promise<void> {
    await recordHost(page, `${IMAGES_HOST}/**`);
    const frame = await openAppProbe(page);

    await frame.evaluate(showImage, `${IMAGES_HOST}/cover.jpg`);

    await expect(issueList(page)).toContainText(
      `Blocked image request to ${IMAGES_HOST}. Add it to permissions.show in mod_conf.yaml.`,
    );
  });

  test("Undeclared connection", async function reportsConnection({
    page,
  }): Promise<void> {
    await recordHost(page, `${API_HOST}/**`);
    const frame = await openAppProbe(page);

    await frame.evaluate(fetchFromFrame, `${API_HOST}/data`);

    await expect(issueList(page)).toContainText(
      `Blocked connection request to ${API_HOST}. Add it to permissions.connect in mod_conf.yaml.`,
    );
  });

  test("Declared but not granted", async function reportsDenied({
    page,
  }): Promise<void> {
    await routeCovers(page);
    const { frame } = await openForeignProbe(page, SHOW_COVERS_LINES);

    await frame.evaluate(showImage, `${COVER_HOST}/cover.jpg`);

    await expect(issueList(page)).toContainText(
      `Blocked image request to ${COVER_HOST}: the mod declares it in permissions.show, but the permission was not granted.`,
    );
  });

  test("Request blocked by another rule", async function reportsObjectSrc({
    page,
  }): Promise<void> {
    await recordHost(page, "https://example.org/**");
    const frame = await openAppProbe(page);

    await frame.evaluate(embedObject, "https://example.org/file.pdf");

    await expect(issueList(page)).toContainText(
      "Blocked by the sandbox policy (object-src).",
    );
  });

  test("Repeated block is reported once", async function reportsOnce({
    page,
  }): Promise<void> {
    await recordHost(page, `${IMAGES_HOST}/**`);
    const frame = await openAppProbe(page);

    await frame.evaluate(showImage, `${IMAGES_HOST}/a.jpg`);
    await frame.evaluate(showImage, `${IMAGES_HOST}/b.jpg`);
    await frame.evaluate(showImage, `${IMAGES_HOST}/c.jpg`);
    await expect(issueList(page)).toContainText(IMAGES_HOST);

    await expect(issueList(page).getByRole("listitem")).toHaveCount(1);
  });
});

test.describe("Wildcard hosts cover subdomains", function describeWildcardHosts(): void {
  test("Image from a subdomain of a granted wildcard host", async function showsWildcardImage({
    page,
  }): Promise<void> {
    const seenUrls = await routeImages(page, `${WILDCARD_COVERS_SUBDOMAIN}/**`);
    const frame = await openAppProbe(page, SHOW_WILDCARD_COVERS_LINES);

    expect(
      await frame.evaluate(showImage, `${WILDCARD_COVERS_SUBDOMAIN}/cover.jpg`),
    ).toBe(true);
    expect(seenUrls).toEqual([`${WILDCARD_COVERS_SUBDOMAIN}/cover.jpg`]);
  });

  test("Deeper subdomain", async function sendsDeeperConnection({
    page,
  }): Promise<void> {
    const deeperHost = "https://a.b.example.net";
    const seenUrls = await recordHost(page, `${deeperHost}/**`);
    const frame = await openAppProbe(
      page,
      buildPermissionLines("connect", "https://*.example.net"),
    );

    expect(await frame.evaluate(fetchFromFrame, `${deeperHost}/data`)).toBe(
      "sent",
    );
    expect(seenUrls).toEqual([`${deeperHost}/data`]);
  });

  test("The wildcard's own host name is not covered", async function blocksWildcardOwnHost({
    page,
  }): Promise<void> {
    const seenUrls = await recordHost(page, `${WILDCARD_COVERS_OWN_HOST}/**`);
    const frame = await openAppProbe(page, SHOW_WILDCARD_COVERS_LINES);

    expect(
      await frame.evaluate(showImage, `${WILDCARD_COVERS_OWN_HOST}/cover.jpg`),
    ).toBe(false);
    await expect(issueList(page)).toContainText(
      `Blocked image request to ${WILDCARD_COVERS_OWN_HOST}. Add it to permissions.show in mod_conf.yaml.`,
    );
    expect(seenUrls).toEqual([]);
  });

  test("Other scheme is not covered", async function blocksWildcardOtherScheme({
    page,
  }): Promise<void> {
    const httpSubdomain = "http://a.covers.example.net";
    const seenUrls = await recordHost(page, `${httpSubdomain}/**`);
    const frame = await openAppProbe(page, SHOW_WILDCARD_COVERS_LINES);

    expect(await frame.evaluate(showImage, `${httpSubdomain}/cover.jpg`)).toBe(
      false,
    );
    expect(seenUrls).toEqual([]);
  });

  test("Wildcard host declared but not granted", async function reportsDeniedWildcard({
    page,
  }): Promise<void> {
    await routeImages(page, `${WILDCARD_COVERS_SUBDOMAIN}/**`);
    const { frame } = await openForeignProbe(page, SHOW_WILDCARD_COVERS_LINES);

    await frame.evaluate(showImage, `${WILDCARD_COVERS_SUBDOMAIN}/cover.jpg`);

    await expect(issueList(page)).toContainText(
      `Blocked image request to ${WILDCARD_COVERS_SUBDOMAIN}: the mod declares it in permissions.show, but the permission was not granted.`,
    );
  });
});

test.describe("Stop a mod that navigates its frame", function describeNavigatingMod(): void {
  test("Mod navigates its frame", async function stopsNavigatingMod({
    page,
  }): Promise<void> {
    await page.route("https://example.org/**", answerBlankPage);
    const frame = await openAppProbe(page);

    await frame
      .evaluate(navigateFrame, "https://example.org/")
      .catch(ignoreError);

    await expect(visibleSandbox(page).locator("iframe")).toHaveCount(0);
    await expect(issueList(page)).toContainText(
      "The mod left its page and was stopped.",
    );
    await expect(issueList(page)).toContainText("error");
  });
});

async function answerBlankPage(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Elsewhere</title>",
  });
}

function ignoreError(): void {
  // The frame's document is replaced while the evaluation runs.
}

/** Records every browser dialog the page or its frames show. */
function recordDialogs(page: Page): Dialog[] {
  const dialogs: Dialog[] = [];
  page.on("dialog", Array.prototype.push.bind(dialogs));
  return dialogs;
}

function callConfirm(): boolean {
  return confirm("Delete?");
}

function callAlertThreeTimes(): void {
  alert("a");
  alert("a");
  alert("a");
}

function callPromptAndPrint(): string | null {
  const answer = prompt("Name?");
  print();
  return answer;
}

test.describe("Blocked browser dialogs are reported", function describeBlockedDialogs(): void {
  test("Confirm", async function reportsConfirm({ page }): Promise<void> {
    const dialogs = recordDialogs(page);
    const frame = await openAppProbe(page);

    const answer = await frame.evaluate(callConfirm);

    expect(answer).toBe(false);
    await expect(issueList(page)).toContainText(
      'confirm() is not available in mods and always returns false. Use a <dialog> element, or request "ui.confirm" for a confirmation shown by the app.',
    );
    await expect(issueList(page)).toContainText("warning");
    await expect(issueList(page)).toContainText(
      "/test-mods/probe/mod_conf.yaml",
    );
    expect(dialogs).toEqual([]);
  });

  test("Reported once", async function reportsAlertOnce({
    page,
  }): Promise<void> {
    const frame = await openAppProbe(page);

    await frame.evaluate(callAlertThreeTimes);

    await expect(issueList(page)).toContainText("alert()");
    await expect(issueList(page).getByRole("listitem")).toHaveCount(1);
  });

  test("Each function is named", async function namesEachFunction({
    page,
  }): Promise<void> {
    const dialogs = recordDialogs(page);
    const frame = await openAppProbe(page);

    const answer = await frame.evaluate(callPromptAndPrint);

    expect(answer).toBeNull();
    const items = issueList(page).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.filter({ hasText: "prompt()" })).toHaveCount(1);
    await expect(items.filter({ hasText: "print()" })).toHaveCount(1);
    expect(dialogs).toEqual([]);
  });
});

const OPEN_ANY_SITE_LINES = [
  "  permissions:",
  "    open:",
  '      - host: "*"',
  '        reason: "Opens mods"',
];

async function goFullscreen(page: Page, frame: Frame): Promise<void> {
  await frame.evaluate(addFullscreenButton);
  await page
    .frameLocator('iframe[title="probe"]')
    .getByRole("button", { name: "Fullscreen" })
    .click();
}

test.describe("Mods can go fullscreen", function describeFullscreen(): void {
  test("Fullscreen after a click", async function goesFullscreen({
    page,
  }): Promise<void> {
    const frame = await openAppProbe(page);

    await goFullscreen(page, frame);

    expect(await frame.evaluate(readFullscreenOutcome)).toBe("BODY");
    expect(await page.evaluate(isPageFullscreen)).toBe(true);
  });

  test("Opening another mod leaves fullscreen", async function leavesFullscreen({
    page,
  }): Promise<void> {
    const frame = await openAppProbe(page, OPEN_ANY_SITE_LINES);
    await goFullscreen(page, frame);
    expect(await frame.evaluate(readFullscreenOutcome)).toBe("BODY");

    const answer = await frame.evaluate(requestFromProbe, [
      "mods.open",
      { mod: "mod_viewer" },
    ]);

    expect(answer).toEqual({ result: null });
    await expect(stageBar(page)).toContainText("Mod Viewer");
    await expect.poll(readPageFullscreen.bind(undefined, page)).toBe(false);
  });
});

function readPageFullscreen(page: Page): Promise<boolean> {
  return page.evaluate(isPageFullscreen);
}

test.describe("Assets next to the mod", function describeAssets(): void {
  test("Asset of a mod from the app's origin", async function loadsAppAsset({
    page,
  }): Promise<void> {
    const seenUrls = await serveAppOriginMod(page, {
      ...buildProbeFiles("probe"),
      "probe/icon.svg": ICON_SVG,
    });
    await page.goto(APP_PROBE_LINK);
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    const appOrigin = new URL(page.url()).origin;

    const asset = await frame.evaluate(showAssetNextToMod, "./icon.svg");

    expect(asset).toEqual({
      url: `${appOrigin}/test-mods/probe/icon.svg`,
      loaded: true,
    });
    expect(seenUrls).toContain(`${appOrigin}/test-mods/probe/icon.svg`);
    await expect(stageBar(page)).toContainText("No issues.");
  });

  test("Asset of a mod from another origin", async function loadsForeignAsset({
    page,
  }): Promise<void> {
    const seenUrls = await serveForeignMod(page, {
      ...buildProbeFiles("probe"),
      "probe/icon.svg": ICON_SVG,
    });
    await page.goto(FOREIGN_PROBE_LINK);
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);

    const asset = await frame.evaluate(showAssetNextToMod, "./icon.svg");

    expect(asset).toEqual({
      url: `${FOREIGN_HOST}/probe/icon.svg`,
      loaded: true,
    });
    expect(seenUrls).toContain(`${FOREIGN_HOST}/probe/icon.svg`);
    await expect(stageBar(page)).toContainText("No issues.");
  });
});
