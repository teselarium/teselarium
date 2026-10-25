import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL, FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  TEST_DEFAULTS,
} from "../../../test/sample_mods.ts";
import { fetchTestFile } from "../../../test/test_files.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { Tile } from "../../tile/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { Theme } from "../theme/index.ts";
import type { AppAction } from "./app_actions.ts";
import { prepareModLaunch } from "./mod_launch.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type { ModContext, ModLaunch, RunLink } from "./mod_launch.ts";
import type { ModCheckRequest } from "./mod_methods.ts";
import {
  connectModSession,
  pushThemeChanged,
  pushTilesChanged,
  stopModSession,
} from "./mod_session.ts";
import type { ModSession, ModSessionOptions } from "./mod_session.ts";
import type { ResponseError } from "./mod_messages.ts";
import type { SandboxTestReport } from "../sandbox/index.ts";

const TEST_CODE =
  'export default function register(t) { t.test("lists books", function listsBooks() {}); }';

type SessionHooks = Pick<
  ModSessionOptions,
  "onMounted" | "onErrorResponse" | "test" | "onTestReport"
>;

interface PlayedSession {
  session: ModSession;
  modPort: MessagePort;
  received: unknown[];
  onIssue: Mock<(issue: ModIssue) => void>;
  onOpenLink: Mock<(link: RunLink) => boolean>;
  onRequestAction: Mock<(action: AppAction) => Promise<boolean> | null>;
  launch: ModLaunch;
}

const openPorts: MessagePort[] = [];

afterEach(function closePorts(): void {
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

function launchSampleMod(): Promise<ModLaunch> {
  return prepareModLaunch(
    {
      link: {
        mod: SAMPLE_MOD_REFERENCE,
        collection: SAMPLE_COLLECTION_REFERENCE,
        params: {},
      },
      appOrigin: APP_ORIGIN,
      defaults: TEST_DEFAULTS,
    },
    { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
  );
}

/** Connects a session for the sample mod (granted `open` for `"*"`), and plays the mod side. */
async function playSession(
  theme: Theme = buildTheme("light"),
  hooks: SessionHooks = {},
): Promise<PlayedSession> {
  const sampleLaunch = await launchSampleMod();
  const openPermission = {
    category: "open" as const,
    host: "*",
    reason: "Opens mods",
  };
  const launch: ModLaunch = {
    ...sampleLaunch,
    mod: {
      ...sampleLaunch.mod,
      permissions: [...sampleLaunch.mod.permissions, openPermission],
    },
    context: {
      ...sampleLaunch.context,
      permissions: {
        granted: [...sampleLaunch.context.permissions.granted, openPermission],
        denied: [],
      },
    },
  };
  const fakeFrame = createFakeFrame();
  const onIssue = vi.fn<(issue: ModIssue) => void>();
  const onOpenLink = vi.fn<(link: RunLink) => boolean>();
  onOpenLink.mockReturnValue(true);
  const onRequestAction =
    vi.fn<(action: AppAction) => Promise<boolean> | null>();
  onRequestAction.mockResolvedValue(true);
  const session = connectModSession(fakeFrame.target, launch, {
    storage: createMemoryStorage(),
    appOrigin: APP_ORIGIN,
    defaults: TEST_DEFAULTS,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
    onIssue,
    onOpenLink,
    onRequestAction,
    onCheckMod:
      vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>(),
    theme,
    ...hooks,
  });
  const modPort = readModPort(fakeFrame);
  openPorts.push(modPort, session.port);
  const playedSession: PlayedSession = {
    session,
    modPort,
    received: collectMessages(modPort),
    onIssue,
    onOpenLink,
    onRequestAction,
    launch,
  };
  return playedSession;
}

/** Session options whose callbacks do nothing. */
function buildPlainOptions(): ModSessionOptions {
  const options: ModSessionOptions = {
    storage: createMemoryStorage(),
    appOrigin: APP_ORIGIN,
    defaults: TEST_DEFAULTS,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
    onIssue: vi.fn<(issue: ModIssue) => void>(),
    onOpenLink: vi.fn<(link: RunLink) => boolean>(),
    onRequestAction: vi.fn<(action: AppAction) => Promise<boolean> | null>(),
    onCheckMod:
      vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>(),
    theme: buildTheme("light"),
  };
  return options;
}

/** The mount context of a posted `sandbox.connect`. */
function readSentContext(message: unknown): ModContext {
  const connect = message as { params: { context: ModContext } };
  return connect.params.context;
}

function sendRequest(
  played: PlayedSession,
  id: number,
  method: string,
  params: object,
): void {
  played.modPort.postMessage({ jsonrpc: "2.0", id, method, params });
}

function sendNotification(
  played: PlayedSession,
  method: string,
  params: unknown,
): void {
  played.modPort.postMessage({ jsonrpc: "2.0", method, params });
}

/** Waits until the mod side received `count` messages, for requests that fetch files. */
async function waitForReceived(
  played: PlayedSession,
  count: number,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (played.received.length >= count) {
      return;
    }
    await waitForMessages();
  }
}

describe("connectModSession", function describeConnectModSession(): void {
  it("posts sandbox.connect with the code and the context", async function postsConnect(): Promise<void> {
    const fakeFrame = createFakeFrame();
    const launch = await launchSampleMod();

    const session = connectModSession(fakeFrame.target, launch, {
      storage: createMemoryStorage(),
      appOrigin: APP_ORIGIN,
      defaults: TEST_DEFAULTS,
      fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
      onIssue: vi.fn<(issue: ModIssue) => void>(),
      onOpenLink: vi.fn<(link: RunLink) => boolean>(),
      onRequestAction: vi.fn<(action: AppAction) => Promise<boolean> | null>(),
      onCheckMod:
        vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>(),
      theme: buildTheme("light"),
    });
    openPorts.push(session.port, readModPort(fakeFrame));

    expect(fakeFrame.posted).toHaveLength(1);
    expect(fakeFrame.posted[0].message).toEqual({
      jsonrpc: "2.0",
      method: "sandbox.connect",
      params: {
        code: launch.mod.code,
        context: { ...launch.context, theme: buildTheme("light") },
      },
    });
  });

  it("Dark mount context", async function sendsDarkTheme(): Promise<void> {
    const fakeFrame = createFakeFrame();
    const launch = await launchSampleMod();

    const session = connectModSession(fakeFrame.target, launch, {
      storage: createMemoryStorage(),
      appOrigin: APP_ORIGIN,
      defaults: TEST_DEFAULTS,
      fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
      onIssue: vi.fn<(issue: ModIssue) => void>(),
      onOpenLink: vi.fn<(link: RunLink) => boolean>(),
      onRequestAction: vi.fn<(action: AppAction) => Promise<boolean> | null>(),
      onCheckMod:
        vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>(),
      theme: buildTheme("dark"),
    });
    openPorts.push(session.port, readModPort(fakeFrame));

    const context = readSentContext(fakeFrame.posted[0].message);
    expect(context.theme.colorScheme).toBe("dark");
    expect(context.theme.tokens["--ot-background"]).toBe("#0f141d");
  });

  it("Structured clone of the theme", async function clonesTheme(): Promise<void> {
    const fakeFrame = createFakeFrame();
    const launch = await launchSampleMod();

    const session = connectModSession(fakeFrame.target, launch, {
      storage: createMemoryStorage(),
      appOrigin: APP_ORIGIN,
      defaults: TEST_DEFAULTS,
      fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
      onIssue: vi.fn<(issue: ModIssue) => void>(),
      onOpenLink: vi.fn<(link: RunLink) => boolean>(),
      onRequestAction: vi.fn<(action: AppAction) => Promise<boolean> | null>(),
      onCheckMod:
        vi.fn<(request: ModCheckRequest) => Promise<ModCheckReport> | null>(),
      theme: buildTheme("dark"),
    });
    openPorts.push(session.port, readModPort(fakeFrame));

    const context = readSentContext(fakeFrame.posted[0].message);
    expect(structuredClone(context.theme)).toEqual(context.theme);
  });

  it("Store and read a value", async function storesValue(): Promise<void> {
    const played = await playSession();
    const value = {
      source: `${FIXTURES_BASE_URL}tiles/books/kallocain.md`,
    };

    sendRequest(played, 1, "storage.set", { key: "selected", value });
    sendRequest(played, 2, "storage.get", { key: "selected" });
    await waitForReceived(played, 2);

    expect(played.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: null },
      { jsonrpc: "2.0", id: 2, result: value },
    ]);
  });

  it("Response matches the request id", async function answersOnce(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 7, "storage.get", { key: "selected" });
    await waitForReceived(played, 1);
    await waitForMessages();

    expect(played.received).toEqual([{ jsonrpc: "2.0", id: 7, result: null }]);
  });

  it("dispatches mods.open to the session's onOpenLink", async function opensLink(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 3, "mods.open", {
      mod: "mod_viewer",
      params: { target: SAMPLE_MOD_SOURCE },
    });
    await waitForReceived(played, 1);

    expect(played.onOpenLink).toHaveBeenCalledExactlyOnceWith({
      mod: "mod_viewer",
      collection: null,
      params: { target: SAMPLE_MOD_SOURCE },
    });
    expect(played.received).toEqual([{ jsonrpc: "2.0", id: 3, result: null }]);
  });

  it("dispatches ui.confirm to the session's onRequestAction", async function asksUser(): Promise<void> {
    const played = await playSession();
    played.onRequestAction.mockResolvedValue(false);

    sendRequest(played, 4, "ui.confirm", { message: "Delete this list?" });
    await waitForReceived(played, 1);

    expect(played.onRequestAction).toHaveBeenCalledExactlyOnceWith({
      kind: "confirm",
      message: "Delete this list?",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
    });
    expect(played.received).toEqual([{ jsonrpc: "2.0", id: 4, result: false }]);
  });

  it("answers links.open and files.save with the user's answer", async function answersActions(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 5, "links.open", { url: "https://example.org/" });
    sendRequest(played, 6, "files.save", { name: "a.txt", content: "x" });
    await waitForReceived(played, 2);

    expect(played.received).toEqual([
      { jsonrpc: "2.0", id: 5, result: true },
      { jsonrpc: "2.0", id: 6, result: true },
    ]);
  });

  it("answers -32002 when the sandbox is not the visible one", async function refusesHidden(): Promise<void> {
    const played = await playSession();
    played.onRequestAction.mockReturnValue(null);

    sendRequest(played, 7, "ui.confirm", { message: "Delete this list?" });
    await waitForReceived(played, 1);

    expect(played.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 7,
        error: {
          code: -32002,
          message: "ui.confirm: only the visible mod can ask the user",
        },
      },
    ]);
  });

  it("Unknown method", async function answersUnknownMethod(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 8, "tiles.delete", {});
    await waitForReceived(played, 1);

    expect(played.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 8,
        error: { code: -32601, message: 'Unknown method "tiles.delete"' },
      },
    ]);
  });

  it("treats inherited names as unknown methods", async function ignoresInherited(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 9, "toString", {});
    await waitForReceived(played, 1);

    expect(played.received).toMatchObject([{ id: 9, error: { code: -32601 } }]);
  });

  it("Not a JSON-RPC request", async function answersInvalidRequest(): Promise<void> {
    const played = await playSession();

    played.modPort.postMessage({ id: 4, method: 12 });
    await waitForReceived(played, 1);

    expect(played.received).toMatchObject([
      { jsonrpc: "2.0", id: 4, error: { code: -32600 } },
    ]);
  });

  it("sends a handler's ModMethodError as the error response", async function answersMethodError(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 5, "storage.get", { key: 3 });
    await waitForReceived(played, 1);

    expect(played.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 5,
        error: {
          code: -32602,
          message: 'storage.get: "key" must be a non-empty string',
        },
      },
    ]);
  });

  it("Reloaded tiles are pushed", async function pushesTilesChanged(): Promise<void> {
    const played = await playSession();
    const tiles: Tile[] = played.launch.context.tiles.slice(0, 2);

    pushTilesChanged(played.session, tiles, []);
    await waitForReceived(played, 1);

    expect(played.received).toEqual([
      {
        jsonrpc: "2.0",
        method: "tiles.changed",
        params: { tiles, issues: [] },
      },
    ]);
    expect(played.received[0]).not.toHaveProperty("id");
  });

  it("pushes theme.changed with the theme", async function pushesThemeChanged(): Promise<void> {
    const played = await playSession();
    const theme = buildTheme("dark");

    pushThemeChanged(played.session, theme);
    await waitForReceived(played, 1);
    await waitForMessages();

    expect(played.received).toEqual([
      { jsonrpc: "2.0", method: "theme.changed", params: theme },
    ]);
  });

  it("Repeated block is reported once", async function reportsBlockOnce(): Promise<void> {
    const played = await playSession();
    const blocked = { directive: "img-src" };

    sendNotification(played, "sandbox.blocked", {
      ...blocked,
      blockedUrl: "https://images.example.net/a.jpg",
    });
    sendNotification(played, "sandbox.blocked", {
      ...blocked,
      blockedUrl: "https://images.example.net/b.jpg",
    });
    sendNotification(played, "sandbox.blocked", {
      ...blocked,
      blockedUrl: "https://images.example.net/c.jpg",
    });
    await waitForMessages();

    expect(played.onIssue).toHaveBeenCalledExactlyOnceWith({
      level: "warning",
      source: SAMPLE_MOD_SOURCE,
      message:
        "Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml.",
    });
    expect(played.received).toEqual([]);
  });

  it("ignores sandbox.blocked with wrong params", async function ignoresWrongBlock(): Promise<void> {
    const played = await playSession();

    sendNotification(played, "sandbox.blocked", { blockedUrl: 3 });
    sendNotification(played, "sandbox.blocked", "img-src");
    await waitForMessages();

    expect(played.onIssue).not.toHaveBeenCalled();
  });

  it("reports each blocked dialog function once", async function reportsDialogsOnce(): Promise<void> {
    const played = await playSession();

    for (const name of ["alert", "alert", "confirm", "alert", "confirm"]) {
      sendNotification(played, "sandbox.dialogBlocked", { name });
    }
    await waitForMessages();

    expect(played.onIssue).toHaveBeenCalledTimes(2);
    expect(played.onIssue).toHaveBeenNthCalledWith(1, {
      level: "warning",
      source: SAMPLE_MOD_SOURCE,
      message:
        "alert() is not available in mods. Show the message in the page or in a <dialog> element.",
    });
    expect(played.onIssue.mock.calls[1][0].message).toMatch(/^confirm\(\) /);
    expect(played.received).toEqual([]);
  });

  it("ignores sandbox.dialogBlocked with an unknown name", async function ignoresUnknownDialog(): Promise<void> {
    const played = await playSession();

    sendNotification(played, "sandbox.dialogBlocked", { name: "open" });
    sendNotification(played, "sandbox.dialogBlocked", { name: 3 });
    sendNotification(played, "sandbox.dialogBlocked", "alert");
    await waitForMessages();

    expect(played.onIssue).not.toHaveBeenCalled();
  });

  it("turns sandbox.mountFailed into an error issue", async function reportsMountFailure(): Promise<void> {
    const played = await playSession();

    sendNotification(played, "sandbox.mountFailed", { message: "map failed" });
    await waitForMessages();

    expect(played.onIssue).toHaveBeenCalledExactlyOnceWith({
      level: "error",
      source: SAMPLE_MOD_SOURCE,
      message: "The mod could not be mounted: map failed",
    });
  });
});

describe("session hooks", function describeSessionHooks(): void {
  it("calls onMounted for sandbox.mounted", async function callsOnMounted(): Promise<void> {
    const onMounted = vi.fn<() => void>();
    const played = await playSession(buildTheme("light"), { onMounted });

    sendNotification(played, "sandbox.mounted", {});
    await waitForMessages();

    expect(onMounted).toHaveBeenCalledOnce();
    expect(played.onIssue).not.toHaveBeenCalled();
    expect(played.received).toEqual([]);
  });

  it("calls onMounted for sandbox.mountFailed after the issue", async function callsOnMountedAfterFailure(): Promise<void> {
    const onMounted = vi.fn<() => void>();
    const played = await playSession(buildTheme("light"), { onMounted });

    sendNotification(played, "sandbox.mountFailed", { message: "map failed" });
    await waitForMessages();

    expect(onMounted).toHaveBeenCalledOnce();
    expect(played.onIssue).toHaveBeenCalledOnce();
    expect(played.onIssue.mock.invocationCallOrder[0]).toBeLessThan(
      onMounted.mock.invocationCallOrder[0],
    );
  });

  it("calls onErrorResponse for an unknown method", async function reportsUnknownMethod(): Promise<void> {
    const onErrorResponse =
      vi.fn<(method: string | null, error: ResponseError) => void>();
    const played = await playSession(buildTheme("light"), { onErrorResponse });

    sendRequest(played, 8, "tiles.delete", {});
    await waitForReceived(played, 1);

    expect(onErrorResponse).toHaveBeenCalledExactlyOnceWith("tiles.delete", {
      code: -32601,
      message: 'Unknown method "tiles.delete"',
    });
  });

  it("calls onErrorResponse for bad params", async function reportsBadParams(): Promise<void> {
    const onErrorResponse =
      vi.fn<(method: string | null, error: ResponseError) => void>();
    const played = await playSession(buildTheme("light"), { onErrorResponse });

    sendRequest(played, 5, "storage.get", { key: 3 });
    await waitForReceived(played, 1);

    expect(onErrorResponse).toHaveBeenCalledExactlyOnceWith("storage.get", {
      code: -32602,
      message: 'storage.get: "key" must be a non-empty string',
    });
  });

  it("calls onErrorResponse with null for a message that is not a request", async function reportsInvalidRequest(): Promise<void> {
    const onErrorResponse =
      vi.fn<(method: string | null, error: ResponseError) => void>();
    const played = await playSession(buildTheme("light"), { onErrorResponse });

    played.modPort.postMessage({ id: 4, method: 12 });
    await waitForReceived(played, 1);

    expect(onErrorResponse).toHaveBeenCalledExactlyOnceWith(null, {
      code: -32600,
      message: "Not a valid JSON-RPC 2.0 request",
    });
  });

  it("does not call onErrorResponse for a result", async function skipsResults(): Promise<void> {
    const onErrorResponse =
      vi.fn<(method: string | null, error: ResponseError) => void>();
    const played = await playSession(buildTheme("light"), { onErrorResponse });

    sendRequest(played, 1, "storage.get", { key: "selected" });
    await waitForReceived(played, 1);

    expect(onErrorResponse).not.toHaveBeenCalled();
  });

  it("a session without the hooks behaves as before", async function ignoresMountedWithoutHook(): Promise<void> {
    const played = await playSession();

    sendNotification(played, "sandbox.mounted", {});
    sendRequest(played, 8, "tiles.delete", {});
    await waitForReceived(played, 1);

    expect(played.onIssue).not.toHaveBeenCalled();
    expect(played.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 8,
        error: { code: -32601, message: 'Unknown method "tiles.delete"' },
      },
    ]);
  });
});

describe("test frames", function describeTestFrames(): void {
  it("posts no test params without the test option", async function postsNoTest(): Promise<void> {
    const fakeFrame = createFakeFrame();
    const launch = await launchSampleMod();

    const session = connectModSession(fakeFrame.target, launch, {
      ...buildPlainOptions(),
    });
    openPorts.push(session.port, readModPort(fakeFrame));

    const connect = fakeFrame.posted[0].message as { params: object };
    expect(connect.params).not.toHaveProperty("test");
  });

  it("posts the test params with the test option", async function postsTest(): Promise<void> {
    const fakeFrame = createFakeFrame();
    const launch = await launchSampleMod();

    const session = connectModSession(fakeFrame.target, launch, {
      ...buildPlainOptions(),
      test: { code: TEST_CODE, caseName: "lists books" },
    });
    openPorts.push(session.port, readModPort(fakeFrame));

    expect(fakeFrame.posted[0].message).toEqual({
      jsonrpc: "2.0",
      method: "sandbox.connect",
      params: {
        code: launch.mod.code,
        context: { ...launch.context, theme: buildTheme("light") },
        test: { code: TEST_CODE, caseName: "lists books" },
      },
    });
  });

  it("calls onTestReport with each test notification", async function reportsTests(): Promise<void> {
    const onTestReport = vi.fn<(report: SandboxTestReport) => void>();
    const played = await playSession(buildTheme("light"), {
      test: { code: TEST_CODE, caseName: null },
      onTestReport,
    });

    sendNotification(played, "sandbox.testsListed", { names: ["lists books"] });
    sendNotification(played, "sandbox.testsFailed", { message: "no test" });
    sendNotification(played, "sandbox.answerQueued", {
      method: "ui.confirm",
      value: true,
    });
    sendNotification(played, "sandbox.caseFinished", {
      status: "fail",
      message: "no books",
    });
    await waitForMessages();

    expect(onTestReport.mock.calls).toEqual([
      [{ kind: "listed", names: ["lists books"] }],
      [{ kind: "listFailed", message: "no test" }],
      [{ kind: "answerQueued", method: "ui.confirm", value: true }],
      [{ kind: "caseFinished", status: "fail", message: "no books" }],
    ]);
    expect(played.onIssue).not.toHaveBeenCalled();
    expect(played.received).toEqual([]);
  });

  it("ignores a test notification of the wrong shape", async function ignoresWrongShape(): Promise<void> {
    const onTestReport = vi.fn<(report: SandboxTestReport) => void>();
    const played = await playSession(buildTheme("light"), { onTestReport });

    sendNotification(played, "sandbox.testsListed", { names: "lists books" });
    sendNotification(played, "sandbox.answerQueued", {
      method: "ui.confirm",
      value: "yes",
    });
    await waitForMessages();

    expect(onTestReport).not.toHaveBeenCalled();
    expect(played.received).toEqual([]);
  });

  it("a session without onTestReport ignores the test notifications", async function ignoresWithoutHook(): Promise<void> {
    const played = await playSession();

    sendNotification(played, "sandbox.caseFinished", {
      status: "pass",
      message: null,
    });
    sendNotification(played, "sandbox.answerQueued", {
      method: "ui.confirm",
      value: true,
    });
    sendRequest(played, 3, "ui.confirm", { message: "Delete?" });
    await waitForReceived(played, 1);

    expect(played.onIssue).not.toHaveBeenCalled();
    expect(played.onRequestAction).toHaveBeenCalledOnce();
    expect(played.received).toEqual([{ jsonrpc: "2.0", id: 3, result: true }]);
  });
});

describe("stopModSession", function describeStopModSession(): void {
  it("answers nothing and pushes nothing after a stop", async function stopsSession(): Promise<void> {
    const played = await playSession();

    sendRequest(played, 1, "mods.inspect", {
      mod: SAMPLE_MOD_REFERENCE,
    });
    stopModSession(played.session);
    sendRequest(played, 2, "storage.get", { key: "selected" });
    pushTilesChanged(played.session, [], []);
    pushThemeChanged(played.session, buildTheme("dark"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await waitForMessages();
    }

    expect(played.session.stopped).toBe(true);
    expect(played.received).toEqual([]);
  });

  it("reports no issue after a stop", async function stopsIssues(): Promise<void> {
    const played = await playSession();

    stopModSession(played.session);
    sendNotification(played, "sandbox.mountFailed", { message: "late" });
    await waitForMessages();

    expect(played.onIssue).not.toHaveBeenCalled();
  });
});
