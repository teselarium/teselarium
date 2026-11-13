import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { createMemorySiteDecisions } from "../../../test/memory_site_decisions.ts";
import type { MemorySiteDecisions } from "../../../test/memory_site_decisions.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL, FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  buildProbeDecision,
  buildSampleCoversDecision,
  COVER_BOOK_COLLECTION_SOURCE,
  COVER_BOOK_IMAGE_URL,
  FOUR_BOOKS_SOURCE,
  MISSING_MOD_REFERENCE,
  MISSING_MOD_SOURCE,
  NO_API_BOOK_MOD_SOURCE,
  NO_COUNTRY_TILE_SOURCE,
  OTHER_API_RANGE,
  OTHER_APP_ORIGIN,
  PROBE_CONNECT_PERMISSION,
  PROBE_MOD_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  serveCoverBook,
  serveFourBooks,
  serveNoApiBookMod,
  serveProbeMod,
  serveTestMod,
  serveUntypedMod,
  TEST_DEFAULTS,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  buildTypeText,
  fetchTestFile,
  testTexts,
} from "../../../test/test_files.ts";
import {
  describeMissingApiRange,
  MOD_API_VERSION,
  resolveDefaultModSettings,
} from "../engine/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type {
  AppAction,
  FrameLayout,
  ModCheckReport,
  ModCheckRequest,
  RunLink,
} from "../engine/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { Theme } from "../theme/index.ts";
import type { StageSandbox } from "./stage_state.ts";
import {
  answerSandboxApiMismatch,
  answerSandboxSiteConsent,
  attachSandboxFrame,
  launchSandbox,
  markSandboxMessagesRead,
  readSandboxMessages,
  reloadSandboxTiles,
  stopSandbox,
} from "./stage_sandboxes.ts";
import type { SandboxMessage } from "./stage_messages.ts";
import type { SandboxRuntime, SandboxServices } from "./stage_sandboxes.ts";

const OPENER_MOD_SOURCE = `${APP_BASE_URL}test-mods/opener/mod_conf.yaml`;

const LINKED_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/linked.yaml`;
const LINKED_TILE_SOURCE = `${FIXTURES_BASE_URL}tiles/linked/one.md`;
const MISSING_LINKED_TILE_SOURCE = `${FIXTURES_BASE_URL}tiles/linked/missing.md`;
const ROUTER_LOGO_URL = "http://192.168.1.1/logo.png";

/** Serves a collection whose one tile has the given metadata lines, and optionally a missing tile. */
function serveLinkedTile(
  metadataLines: string[],
  withMissingTile = false,
): void {
  const tileLines = ['    - path: "./linked/one.md"'];
  if (withMissingTile) {
    tileLines.push('    - path: "./linked/missing.md"');
  }
  testTexts.set(
    LINKED_COLLECTION_SOURCE,
    ["collection:", '  name: "Linked"', "  tiles:", ...tileLines].join("\n"),
  );
  testTexts.set(LINKED_TILE_SOURCE, buildTypeText(metadataLines));
}

function buildRouterIssue(): ModIssue {
  const issue: ModIssue = {
    level: "warning",
    source: LINKED_TILE_SOURCE,
    message: `Not loading ${ROUTER_LOGO_URL}: tiles from other sites cannot link addresses on your computer or network.`,
  };
  return issue;
}

/** The sandbox's errors and warnings in the order of its messages, as issues. */
function readIssues(runtime: SandboxRuntime): ModIssue[] {
  const issues: ModIssue[] = [];
  for (const message of readSandboxMessages(runtime)) {
    if (message.level !== "info") {
      issues.push({
        level: message.level,
        source: message.source,
        message: message.text,
      });
    }
  }
  return issues;
}

function isError(message: SandboxMessage): boolean {
  return message.level === "error";
}

function isWarning(message: SandboxMessage): boolean {
  return message.level === "warning";
}

function readLevels(items: readonly { level: string }[]): string[] {
  const levels: string[] = [];
  for (const item of items) {
    levels.push(item.level);
  }
  return levels;
}

function isFromMod(message: SandboxMessage): boolean {
  return message.producer === "mod";
}

/** Posts a `ui.notify` request from the mod. */
function sendNotify(modPort: MessagePort, id: number, params: object): void {
  modPort.postMessage({ jsonrpc: "2.0", id, method: "ui.notify", params });
}

function isInfo(message: SandboxMessage): boolean {
  return message.level === "info";
}

function readNotifications(runtime: SandboxRuntime): SandboxMessage[] {
  return readSandboxMessages(runtime).filter(isInfo);
}

const MISSING_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/missing.yaml`;

const openPorts: MessagePort[] = [];

afterEach(function cleanUp(): void {
  testTexts.clear();
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

interface SpiedServices {
  services: SandboxServices;
  siteDecisions: MemorySiteDecisions;
  onChange: Mock<() => void>;
  onOpenLink: Mock<(openerId: string, link: RunLink) => boolean>;
  onRequestAction: Mock<
    (sandboxId: string, action: AppAction) => Promise<boolean> | null
  >;
}

function readLightTheme(): Theme {
  return buildTheme("light");
}

function readContainedLayout(): FrameLayout {
  return "contained";
}

function buildServices(
  appOrigin: string = APP_ORIGIN,
  siteDecisions: MemorySiteDecisions = createMemorySiteDecisions(),
): SpiedServices {
  const onChange = vi.fn<() => void>();
  const onOpenLink = vi.fn<(openerId: string, link: RunLink) => boolean>();
  onOpenLink.mockReturnValue(true);
  const onRequestAction =
    vi.fn<(sandboxId: string, action: AppAction) => Promise<boolean> | null>();
  onRequestAction.mockResolvedValue(true);
  const onCheckMod =
    vi.fn<
      (
        requesterId: string,
        request: ModCheckRequest,
      ) => Promise<ModCheckReport> | null
    >();
  onCheckMod.mockReturnValue(null);
  const services: SandboxServices = {
    defaults: TEST_DEFAULTS,
    appOrigin,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
    storage: createMemoryStorage(),
    onChange,
    onOpenLink,
    onRequestAction,
    onCheckMod,
    readTheme: readLightTheme,
    readLayout: readContainedLayout,
    loadsTileLinkedMedia: true,
    readSiteDecisions: siteDecisions.read,
    rememberSiteDecisions: siteDecisions.remember,
  };
  const spiedServices: SpiedServices = {
    services,
    siteDecisions,
    onChange,
    onOpenLink,
    onRequestAction,
  };
  return spiedServices;
}

function buildSandbox(mod: string, collection: string | null): StageSandbox {
  const sandbox: StageSandbox = {
    id: "sandbox-1",
    hash: "#/run",
    link: { mod, collection, params: {} },
    openerId: null,
    section: null,
    isHomeMod: false,
  };
  return sandbox;
}

/** Launches a sandbox, waits for its launch and attaches a fake frame. */
async function startSandbox(
  sandbox: StageSandbox,
  spied: SpiedServices,
): Promise<{
  runtime: SandboxRuntime;
  modPort: MessagePort;
  received: unknown[];
}> {
  const runtime = launchSandbox(sandbox, spied.services);
  await runtime.settled;
  const fakeFrame = createFakeFrame();
  attachSandboxFrame(runtime, fakeFrame.target, spied.services);
  const modPort = readModPort(fakeFrame);
  openPorts.push(modPort);
  if (runtime.session !== null) {
    openPorts.push(runtime.session.port);
  }
  const started = { runtime, modPort, received: collectMessages(modPort) };
  return started;
}

describe("launchSandbox", function describeLaunchSandbox(): void {
  it("is loading, then running with the launch's issues", async function launches(): Promise<void> {
    const spied = buildServices(
      OTHER_APP_ORIGIN,
      createMemorySiteDecisions([buildSampleCoversDecision(false)]),
    );

    const runtime = launchSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied.services,
    );

    expect(runtime.status).toBe("loading");
    expect(spied.onChange).not.toHaveBeenCalled();
    await runtime.settled;
    expect(runtime.status).toBe("running");
    expect(runtime.launch?.mod.source).toBe(SAMPLE_MOD_SOURCE);
    expect(readIssues(runtime)).toHaveLength(1);
    expect(readIssues(runtime)[0].message).toContain("Permission not granted");
    expect(spied.onChange).toHaveBeenCalledOnce();
  });

  it("lists the collection issues before the permission issues", async function ordersIssues(): Promise<void> {
    serveFourBooks();
    const spied = buildServices(
      OTHER_APP_ORIGIN,
      createMemorySiteDecisions([buildSampleCoversDecision(false)]),
    );

    const runtime = launchSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied.services,
    );
    await runtime.settled;

    const issues = readIssues(runtime);
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toContain("is not of tile type");
    expect(issues[1].message).toContain("Permission not granted");
    const messages = readSandboxMessages(runtime);
    expect(messages[0]).toMatchObject({ level: "warning", producer: "app" });
    expect(messages[1]).toMatchObject({ producer: "app" });
    expect(messages[1].id).toBeGreaterThan(messages[0].id);
  });

  it("Sample collection", async function notifiesLoadedCollection(): Promise<void> {
    const spied = buildServices();

    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, SAMPLE_COLLECTION_REFERENCE),
      spied,
    );

    const notifications = readNotifications(runtime);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      producer: "app",
      source: SAMPLE_COLLECTION_SOURCE,
      text: "Loaded the collection: the mod received 3 tiles.",
    });
    expect(runtime.launch?.context.issues).toEqual([]);
    expect(runtime.collectionLocation).toBe(SAMPLE_COLLECTION_SOURCE);
  });

  it("No collection", async function notifiesNothingWithoutCollection(): Promise<void> {
    const spied = buildServices();

    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );

    expect(readNotifications(runtime)).toEqual([]);
    expect(runtime.collectionLocation).toBeNull();
  });

  it("sends no info in the mount context's issues", async function keepsInfoFromMount(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const runtime = launchSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied.services,
    );
    await runtime.settled;
    const fakeFrame = createFakeFrame();

    attachSandboxFrame(runtime, fakeFrame.target, spied.services);
    openPorts.push(readModPort(fakeFrame));
    if (runtime.session !== null) {
      openPorts.push(runtime.session.port);
    }

    const connect = fakeFrame.posted[0].message as {
      params: { context: { issues: { level: string }[] } };
    };
    expect(connect.params.context.issues).toHaveLength(1);
    expect(readLevels(connect.params.context.issues)).not.toContain("info");
    expect(readNotifications(runtime)).toHaveLength(1);
  });

  it("Missing range comes first", async function listsMissingRangeFirst(): Promise<void> {
    serveFourBooks();
    serveNoApiBookMod();
    const spied = buildServices();

    const { runtime } = await startSandbox(
      buildSandbox(NO_API_BOOK_MOD_SOURCE, FOUR_BOOKS_SOURCE),
      spied,
    );

    const issues = readIssues(runtime);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual({
      level: "warning",
      source: NO_API_BOOK_MOD_SOURCE,
      message: describeMissingApiRange(),
    });
    expect(issues[1].source).toBe(NO_COUNTRY_TILE_SOURCE);
  });

  it("keeps the missing-range warning after reloading the tiles", async function keepsMissingRange(): Promise<void> {
    serveFourBooks();
    serveNoApiBookMod();
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(NO_API_BOOK_MOD_SOURCE, FOUR_BOOKS_SOURCE),
      spied,
    );

    await reloadSandboxTiles(runtime, spied.services);

    const issues = readIssues(runtime);
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toBe(describeMissingApiRange());
    expect(issues[1].source).toBe(NO_COUNTRY_TILE_SOURCE);
  });

  it("Missing mod file", async function failsMissingMod(): Promise<void> {
    const spied = buildServices();

    const runtime = launchSandbox(
      buildSandbox(MISSING_MOD_REFERENCE, null),
      spied.services,
    );
    await runtime.settled;

    expect(runtime.status).toBe("failed");
    expect(runtime.launch).toBeNull();
    expect(runtime.modReference).toBe(MISSING_MOD_SOURCE);
    expect(runtime.errorMessage).toContain(MISSING_MOD_SOURCE);
    expect(runtime.errorMessage).toContain("404");
    expect(spied.onChange).toHaveBeenCalledOnce();
    expect(runtime.loadedMod).toBeNull();
    const messages = readSandboxMessages(runtime);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      level: "error",
      producer: "app",
      source: MISSING_MOD_SOURCE,
      text: runtime.errorMessage,
    });
    expect(messages[0].text).toContain("404");
  });

  it("Missing collection", async function failsMissingCollection(): Promise<void> {
    const spied = buildServices();

    const runtime = launchSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, MISSING_COLLECTION_SOURCE),
      spied.services,
    );
    await runtime.settled;

    expect(runtime.status).toBe("failed");
    expect(runtime.loadedMod?.title).toBe("Book List");
    expect(runtime.collectionLocation).toBe(MISSING_COLLECTION_SOURCE);
    expect(readSandboxMessages(runtime)).toEqual([
      {
        id: 1,
        level: "error",
        producer: "app",
        source: MISSING_COLLECTION_SOURCE,
        text: runtime.errorMessage,
      },
    ]);
  });

  it("Link to a switched-off viewer", async function failsSwitchedOff(): Promise<void> {
    const spied = buildServices();
    const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
    spied.services.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };
    spied.services.defaults = resolveDefaultModSettings(
      {
        folder: "./default_mods/",
        switchedOff: ["mod_viewer"],
      },
      APP_BASE_URL,
    );

    const runtime = launchSandbox(
      buildSandbox("./default_mods/mod_viewer/", null),
      spied.services,
    );
    await runtime.settled;

    expect(runtime.status).toBe("failed");
    expect(runtime.errorMessage).toBe(
      'The default mod "mod_viewer" is switched off.',
    );
    expect(runtime.launch).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.loadedMod).toBeNull();
    expect(readSandboxMessages(runtime)).toEqual([
      {
        id: 1,
        level: "error",
        producer: "app",
        source: `${APP_BASE_URL}default_mods/mod_viewer/mod_conf.yaml`,
        text: 'The default mod "mod_viewer" is switched off.',
      },
    ]);
  });

  it("ignores a launch that settles after the runtime was stopped", async function ignoresLateLaunch(): Promise<void> {
    const spied = buildServices();

    const runtime = launchSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied.services,
    );
    stopSandbox(runtime, null);
    await runtime.settled;

    expect(runtime.status).toBe("stopped");
    expect(runtime.launch).toBeNull();
    expect(spied.onChange).not.toHaveBeenCalled();
  });
});

const COVERS_KEY = "show https://upload.wikimedia.org";

/** Launches a sandbox and waits until it settled or asks. */
async function settleSandbox(
  sandbox: StageSandbox,
  spied: SpiedServices,
): Promise<SandboxRuntime> {
  const runtime = launchSandbox(sandbox, spied.services);
  await runtime.settled;
  return runtime;
}

describe("Site consent question", function describeSiteConsentQuestion(): void {
  it("asks nothing for a mod from the app's origin", async function startsAppOriginMod(): Promise<void> {
    const runtime = await settleSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      buildServices(),
    );

    expect(runtime.status).toBe("running");
    expect(runtime.question).toBeNull();
  });

  it("asks nothing for a foreign mod without permissions", async function startsModWithoutPermissions(): Promise<void> {
    serveUntypedMod();

    const runtime = await settleSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, null),
      buildServices(OTHER_APP_ORIGIN),
    );

    expect(runtime.status).toBe("running");
    expect(runtime.question).toBeNull();
  });

  it("asks nothing for a foreign mod whose every permission is decided", async function startsDecidedMod(): Promise<void> {
    serveProbeMod(true);
    const siteDecisions = createMemorySiteDecisions([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ]);

    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      buildServices(APP_ORIGIN, siteDecisions),
    );

    expect(runtime.status).toBe("running");
    expect(runtime.launch?.context.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [PROBE_CONNECT_PERMISSION],
    });
  });

  it("asks about the undecided lines before the launch exists", async function asksForeignMod(): Promise<void> {
    serveProbeMod(true);
    const siteDecisions = createMemorySiteDecisions([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    ]);
    const spied = buildServices(APP_ORIGIN, siteDecisions);

    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    expect(runtime.status).toBe("asking");
    expect(runtime.question).toBe("sites");
    expect(runtime.consentLines).toEqual([PROBE_CONNECT_PERMISSION]);
    expect(runtime.launch).toBeNull();
    expect(runtime.pending?.mod.source).toBe(PROBE_MOD_SOURCE);
    expect(spied.onChange).toHaveBeenCalledOnce();
  });

  it("Another API first", async function asksApiFirst(): Promise<void> {
    serveProbeMod(false, OTHER_API_RANGE);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    expect(runtime.question).toBe("api");
    answerSandboxApiMismatch(runtime, spied.services, true);

    expect(runtime.status).toBe("asking");
    expect(runtime.question).toBe("sites");
    expect(runtime.consentLines).toEqual([SAMPLE_COVERS_PERMISSION]);
  });

  it("Cancelled for another API", async function cancelsBeforeSites(): Promise<void> {
    serveProbeMod(false, OTHER_API_RANGE);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxApiMismatch(runtime, spied.services, false);
    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [COVERS_KEY],
      remember: true,
    });

    expect(runtime.status).toBe("failed");
    expect(runtime.question).toBeNull();
    expect(runtime.launch).toBeNull();
    expect(spied.siteDecisions.decisions).toEqual([]);
    expect(runtime.loadedMod?.title).toBe("Probe");
    const messages = readSandboxMessages(runtime);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      level: "error",
      producer: "app",
      source: PROBE_MOD_SOURCE,
    });
    expect(messages[0].text).toContain(OTHER_API_RANGE);
    expect(messages[0].text).toContain(MOD_API_VERSION);
  });

  it("Allow with one line unchecked", async function allowsCheckedLines(): Promise<void> {
    serveProbeMod(true);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [COVERS_KEY],
      remember: false,
    });

    expect(runtime.status).toBe("running");
    expect(runtime.question).toBeNull();
    expect(runtime.launch?.context.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [PROBE_CONNECT_PERMISSION],
    });
    expect(runtime.launch?.policy).toContain("https://upload.wikimedia.org");
    expect(runtime.launch?.policy).not.toContain("https://api.example.net");
    expect(readIssues(runtime)).toHaveLength(1);
    expect(readIssues(runtime)[0].message).toContain(
      "exchange data with https://api.example.net",
    );
    expect(spied.siteDecisions.decisions).toEqual([]);
  });

  it("Show without them, remembered", async function refusesAndRemembers(): Promise<void> {
    serveProbeMod(true);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [],
      remember: true,
    });

    expect(runtime.status).toBe("running");
    expect(runtime.launch?.context.permissions.granted).toEqual([]);
    expect(spied.siteDecisions.decisions).toEqual([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, false),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ]);
  });

  it("Allowed and remembered", async function notifiesAllowed(): Promise<void> {
    serveProbeMod();
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [COVERS_KEY],
      remember: true,
    });

    const notifications = readNotifications(runtime);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      producer: "app",
      source: PROBE_MOD_SOURCE,
      text: "Allowed the mod to show content from https://upload.wikimedia.org. The answer is remembered.",
    });
  });

  it("notifies the answer after the launch's issues", async function ordersConsentNotification(): Promise<void> {
    serveProbeMod(true);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [COVERS_KEY],
      remember: false,
    });

    const messages = readSandboxMessages(runtime);
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toContain("Permission not granted");
    expect(messages[1].text).toBe(
      "Allowed the mod to show content from https://upload.wikimedia.org. Refused to let the mod exchange data with https://api.example.net. The answer is not remembered.",
    );
  });

  it("Remembered allow", async function remembersAllow(): Promise<void> {
    serveProbeMod();
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );
    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [COVERS_KEY],
      remember: true,
    });

    const reopened = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    expect(reopened.status).toBe("running");
    expect(reopened.launch?.context.permissions.granted).toEqual([
      SAMPLE_COVERS_PERMISSION,
    ]);
  });

  it("Escape refuses every line and remembers nothing", async function refusesOnEscape(): Promise<void> {
    serveProbeMod();
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, null);

    expect(runtime.status).toBe("running");
    expect(runtime.launch?.context.permissions).toEqual({
      granted: [],
      denied: [SAMPLE_COVERS_PERMISSION],
    });
    expect(spied.siteDecisions.decisions).toEqual([]);
  });

  it("Escape", async function notifiesEscape(): Promise<void> {
    serveProbeMod(true);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, null);

    const notifications = readNotifications(runtime);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].text).toBe(
      "Refused to let the mod show content from https://upload.wikimedia.org, exchange data with https://api.example.net. The answer is not remembered.",
    );
  });

  it("ignores an answer to a question the runtime does not ask", async function ignoresOtherQuestion(): Promise<void> {
    serveProbeMod(false, OTHER_API_RANGE);
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    answerSandboxSiteConsent(runtime, spied.services, null);

    expect(runtime.status).toBe("asking");
    expect(runtime.question).toBe("api");
  });

  it("starts nothing for a runtime stopped while asking", async function ignoresStoppedRuntime(): Promise<void> {
    serveProbeMod();
    const spied = buildServices();
    const runtime = await settleSandbox(
      buildSandbox(PROBE_MOD_SOURCE, null),
      spied,
    );

    stopSandbox(runtime, null);
    answerSandboxSiteConsent(runtime, spied.services, {
      allowed: [COVERS_KEY],
      remember: true,
    });

    expect(runtime.status).toBe("stopped");
    expect(runtime.launch).toBeNull();
    expect(spied.siteDecisions.decisions).toEqual([]);
  });
});

describe("attachSandboxFrame", function describeAttachSandboxFrame(): void {
  it("connects a session and adds its issues to the runtime", async function connectsSession(): Promise<void> {
    const spied = buildServices();
    const { runtime, modPort } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );
    spied.onChange.mockClear();

    modPort.postMessage({
      jsonrpc: "2.0",
      method: "sandbox.mountFailed",
      params: { message: "map failed" },
    });
    await waitForMessages();

    expect(runtime.session).not.toBeNull();
    expect(readIssues(runtime)).toEqual([
      {
        level: "error",
        source: SAMPLE_MOD_SOURCE,
        message: "The mod could not be mounted: map failed",
      },
    ]);
    expect(spied.onChange).toHaveBeenCalledOnce();
  });

  it("passes ui.confirm to onRequestAction with the runtime's id", async function asksWithId(): Promise<void> {
    const spied = buildServices();
    const { modPort, received } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );

    modPort.postMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "ui.confirm",
      params: { message: "Delete?" },
    });
    await waitForMessages();

    expect(spied.onRequestAction).toHaveBeenCalledExactlyOnceWith("sandbox-1", {
      kind: "confirm",
      message: "Delete?",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
    });
    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: true }]);
  });

  it("Default source", async function notifiesWithModSource(): Promise<void> {
    const spied = buildServices();
    const { runtime, modPort, received } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );
    spied.onChange.mockClear();

    sendNotify(modPort, 1, { message: "Saved" });
    await waitForMessages();

    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: null }]);
    expect(readSandboxMessages(runtime).at(-1)).toMatchObject({
      level: "info",
      producer: "mod",
      source: SAMPLE_MOD_SOURCE,
      text: "Saved",
    });
    expect(spied.onChange).toHaveBeenCalledOnce();
    expect(spied.onRequestAction).not.toHaveBeenCalled();
  });

  it("Mod sends too many", async function capsModMessages(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime, modPort } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied,
    );

    for (let id = 1; id <= 105; id += 1) {
      sendNotify(modPort, id, { message: `Note ${id}` });
    }
    await waitForMessages();

    const fromMod = readSandboxMessages(runtime).filter(isFromMod);
    expect(fromMod).toHaveLength(100);
    expect(fromMod[0].text).toBe("Note 6");
    expect(runtime.droppedModMessages).toEqual({
      error: 0,
      warning: 0,
      info: 5,
    });
    expect(readIssues(runtime)).toHaveLength(1);
    expect(readNotifications(runtime)[0].producer).toBe("app");
  });

  it("passes mods.open to onOpenLink with the runtime's id", async function opensWithId(): Promise<void> {
    serveTestMod(OPENER_MOD_SOURCE, [
      '  name: "opener"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      "  permissions:",
      "    open:",
      '      - host: "*"',
      '        reason: "Opens mods"',
    ]);
    const spied = buildServices();
    const { modPort, received } = await startSandbox(
      buildSandbox(OPENER_MOD_SOURCE, null),
      spied,
    );

    modPort.postMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "mods.open",
      params: { mod: "mod_viewer" },
    });
    await waitForMessages();

    expect(spied.onOpenLink).toHaveBeenCalledExactlyOnceWith("sandbox-1", {
      mod: "mod_viewer",
      collection: null,
      params: {},
    });
    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: null }]);
  });

  it("connects only once", async function connectsOnce(): Promise<void> {
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );
    const session = runtime.session;
    const secondFrame = createFakeFrame();

    attachSandboxFrame(runtime, secondFrame.target, spied.services);

    expect(runtime.session).toBe(session);
    expect(secondFrame.posted).toEqual([]);
  });
});

describe("stopSandbox", function describeStopSandbox(): void {
  it("Mod navigates its frame", async function stopsWithIssue(): Promise<void> {
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );

    stopSandbox(runtime, {
      level: "error",
      source: SAMPLE_MOD_SOURCE,
      message: "The mod left its page and was stopped.",
    });

    expect(runtime.status).toBe("stopped");
    expect(runtime.session?.stopped).toBe(true);
    expect(readIssues(runtime)).toEqual([
      {
        level: "error",
        source: SAMPLE_MOD_SOURCE,
        message: "The mod left its page and was stopped.",
      },
    ]);
  });

  it("stops without an issue", async function stopsQuietly(): Promise<void> {
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );

    stopSandbox(runtime, null);

    expect(runtime.status).toBe("stopped");
    expect(readIssues(runtime)).toEqual([]);
  });
});

describe("reloadSandboxTiles", function describeReloadSandboxTiles(): void {
  it("pushes tiles.changed and replaces the collection issues", async function reloadsTiles(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime, received } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied,
    );
    expect(readIssues(runtime)).toHaveLength(1);
    testTexts.set(
      FOUR_BOOKS_SOURCE,
      'collection:\n  name: "Two books"\n  tiles:\n    - path: "./books/kallocain.md"\n    - path: "./books/fictions.md"',
    );

    await reloadSandboxTiles(runtime, spied.services);
    await waitForMessages();

    expect(readIssues(runtime)).toEqual([]);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      jsonrpc: "2.0",
      method: "tiles.changed",
      params: { issues: [] },
    });
    const params = (received[0] as { params: { tiles: unknown[] } }).params;
    expect(params.tiles).toHaveLength(2);
  });

  it("Reload done", async function notifiesReload(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime, received } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied,
    );
    testTexts.set(
      FOUR_BOOKS_SOURCE,
      'collection:\n  name: "Two books"\n  tiles:\n    - path: "./books/kallocain.md"\n    - path: "./books/fictions.md"',
    );

    await reloadSandboxTiles(runtime, spied.services);
    await waitForMessages();

    const notifications = readNotifications(runtime);
    expect(notifications).toHaveLength(2);
    expect(notifications[1]).toMatchObject({
      producer: "app",
      source: FOUR_BOOKS_SOURCE,
      text: "Reloaded the tiles: the mod received 2 tiles, with 0 collection issues.",
    });
    const changed = received[0] as { params: { issues: { level: string }[] } };
    expect(readLevels(changed.params.issues)).not.toContain("info");
  });

  it("Reload failed", async function notifiesNothingOnFailure(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied,
    );
    testTexts.delete(FOUR_BOOKS_SOURCE);

    await reloadSandboxTiles(runtime, spied.services);

    expect(readNotifications(runtime)).toHaveLength(1);
    const errors = readSandboxMessages(runtime).filter(isError);
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe(FOUR_BOOKS_SOURCE);
  });

  it("Reloaded issues are unread", async function marksReloadedUnread(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied,
    );
    markSandboxMessagesRead(runtime, "warning");
    const readIds = [...runtime.readMessageIds];
    expect(readIds).toHaveLength(1);

    await reloadSandboxTiles(runtime, spied.services);

    const reloadedWarnings = readSandboxMessages(runtime).filter(isWarning);
    expect(reloadedWarnings).toHaveLength(1);
    expect(reloadedWarnings[0].text).toContain("is not of tile type");
    expect(readIds).not.toContain(reloadedWarnings[0].id);
    expect(runtime.readMessageIds.has(reloadedWarnings[0].id)).toBe(false);
    for (const readId of readIds) {
      expect(reloadedWarnings[0].id).toBeGreaterThan(readId);
    }
  });

  it("Reloaded tiles have their relative paths resolved", async function resolvesReloadedTiles(): Promise<void> {
    serveCoverBook();
    const spied = buildServices();
    const { runtime, received } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, COVER_BOOK_COLLECTION_SOURCE),
      spied,
    );

    await reloadSandboxTiles(runtime, spied.services);
    await waitForMessages();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      method: "tiles.changed",
      params: { tiles: [{ metadata: { image: COVER_BOOK_IMAGE_URL } }] },
    });
  });

  it("lists a collection that cannot be reloaded as an error", async function reportsReloadFailure(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, FOUR_BOOKS_SOURCE),
      spied,
    );
    testTexts.delete(FOUR_BOOKS_SOURCE);

    await reloadSandboxTiles(runtime, spied.services);

    expect(readIssues(runtime)).toEqual([
      {
        level: "error",
        source: FOUR_BOOKS_SOURCE,
        message: `Cannot load file "${FOUR_BOOKS_SOURCE}": HTTP 404 Not Found`,
      },
    ]);
  });

  it("does nothing without a collection", async function skipsWithoutCollection(): Promise<void> {
    const spied = buildServices();
    const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
    const { runtime } = await startSandbox(
      buildSandbox(SAMPLE_MOD_REFERENCE, null),
      spied,
    );
    spied.services.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };

    await reloadSandboxTiles(runtime, spied.services);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.launch?.collectionSource).toBeNull();
  });
});

describe("Tile link issues", function describeTileLinkIssues(): void {
  it("lists the tile link issues after the collection issues", async function ordersTileLinkIssues(): Promise<void> {
    serveUntypedMod(null);
    serveLinkedTile([`logo: "${ROUTER_LOGO_URL}"`], true);
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );
    const stopIssue: ModIssue = {
      level: "warning",
      source: UNTYPED_MOD_SOURCE,
      message: "The mod left its page and was stopped.",
    };
    stopSandbox(runtime, stopIssue);

    const sources: string[] = [];
    for (const issue of readIssues(runtime)) {
      sources.push(issue.source);
    }
    expect(sources).toEqual([
      UNTYPED_MOD_SOURCE,
      MISSING_LINKED_TILE_SOURCE,
      LINKED_TILE_SOURCE,
      UNTYPED_MOD_SOURCE,
    ]);
    expect(readIssues(runtime)[2]).toEqual(buildRouterIssue());
    expect(readIssues(runtime)[3]).toEqual(stopIssue);
  });

  it("New link after reloading the tiles", async function reportsNewLink(): Promise<void> {
    serveUntypedMod();
    serveLinkedTile(['image: "https://media.example.net/old.jpg"']);
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );
    const policy = runtime.launch?.policy;
    serveLinkedTile([
      'image: "https://media.example.net/old.jpg"',
      'thumbnail: "https://media.example.net/new.jpg"',
      `logo: "${ROUTER_LOGO_URL}"`,
    ]);

    await reloadSandboxTiles(runtime, spied.services);

    expect(readIssues(runtime)).toEqual([
      {
        level: "warning",
        source: LINKED_COLLECTION_SOURCE,
        message:
          "The reloaded tiles link 1 file that this mod does not allow yet. Open the mod again to show it.",
      },
      buildRouterIssue(),
    ]);
    expect(runtime.launch?.policy).toBe(policy);
    expect(runtime.launch?.tileLinks?.sources).toEqual([
      "https://media.example.net/old.jpg",
    ]);
  });

  it("compares a second reload against the launch", async function comparesAgainstLaunch(): Promise<void> {
    serveUntypedMod();
    serveLinkedTile(['image: "https://media.example.net/old.jpg"']);
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );
    serveLinkedTile([
      'image: "https://media.example.net/a.jpg"',
      'thumbnail: "https://media.example.net/b.jpg"',
    ]);

    await reloadSandboxTiles(runtime, spied.services);
    await reloadSandboxTiles(runtime, spied.services);

    expect(readIssues(runtime)).toEqual([
      {
        level: "warning",
        source: LINKED_COLLECTION_SOURCE,
        message:
          "The reloaded tiles link 2 files that this mod does not allow yet. Open the mod again to show them.",
      },
    ]);
  });

  it("Nothing new", async function reportsNothingNew(): Promise<void> {
    serveUntypedMod();
    serveLinkedTile(['image: "https://media.example.net/old.jpg"']);
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );

    await reloadSandboxTiles(runtime, spied.services);

    expect(readIssues(runtime)).toEqual([]);
  });

  it("Left-out link removed", async function removesLeftOutLink(): Promise<void> {
    serveUntypedMod();
    serveLinkedTile([`logo: "${ROUTER_LOGO_URL}"`]);
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );
    expect(readIssues(runtime)).toEqual([buildRouterIssue()]);
    serveLinkedTile(['title: "No logo"']);

    await reloadSandboxTiles(runtime, spied.services);

    expect(readIssues(runtime)).toEqual([]);
  });

  it("keeps the tile link issues when the reload fails", async function keepsIssuesOnFailure(): Promise<void> {
    serveUntypedMod();
    serveLinkedTile([`logo: "${ROUTER_LOGO_URL}"`]);
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );
    testTexts.delete(LINKED_COLLECTION_SOURCE);

    await reloadSandboxTiles(runtime, spied.services);

    expect(readIssues(runtime)).toEqual([
      {
        level: "error",
        source: LINKED_COLLECTION_SOURCE,
        message: `Cannot load file "${LINKED_COLLECTION_SOURCE}": HTTP 404 Not Found`,
      },
      buildRouterIssue(),
    ]);
  });

  it("reports nothing with the setting off", async function reportsNothingWhenOff(): Promise<void> {
    serveUntypedMod();
    serveLinkedTile([`logo: "${ROUTER_LOGO_URL}"`]);
    const spied = buildServices();
    spied.services.loadsTileLinkedMedia = false;
    const { runtime } = await startSandbox(
      buildSandbox(UNTYPED_MOD_SOURCE, LINKED_COLLECTION_SOURCE),
      spied,
    );
    expect(readIssues(runtime)).toEqual([]);
    serveLinkedTile(['image: "https://media.example.net/new.jpg"']);

    await reloadSandboxTiles(runtime, spied.services);

    expect(runtime.launch?.tileLinks).toBeNull();
    expect(readIssues(runtime)).toEqual([]);
  });
});
