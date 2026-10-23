import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  FOUR_BOOKS_SOURCE,
  OTHER_APP_ORIGIN,
  SAMPLE_MOD_SOURCE,
  serveFourBooks,
  serveTestMod,
  TEST_DEFAULTS,
} from "../../../test/sample_mods.ts";
import { fetchTestFile, testTexts } from "../../../test/test_files.ts";
import { resolveDefaultModSettings } from "../engine/index.ts";
import type { AppAction, RunLink } from "../engine/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { Theme } from "../theme/index.ts";
import type { StageSandbox } from "./stage_state.ts";
import {
  attachSandboxFrame,
  launchSandbox,
  readSandboxIssues,
  reloadSandboxTiles,
  stopSandbox,
} from "./stage_sandboxes.ts";
import type { SandboxRuntime, SandboxServices } from "./stage_sandboxes.ts";

const OPENER_MOD_SOURCE = `${APP_BASE_URL}test-mods/opener/mod_conf.yaml`;

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
  onChange: Mock<() => void>;
  onOpenLink: Mock<(openerId: string, link: RunLink) => boolean>;
  onRequestAction: Mock<
    (sandboxId: string, action: AppAction) => Promise<boolean> | null
  >;
}

function readLightTheme(): Theme {
  return buildTheme("light");
}

function buildServices(appOrigin: string = APP_ORIGIN): SpiedServices {
  const onChange = vi.fn<() => void>();
  const onOpenLink = vi.fn<(openerId: string, link: RunLink) => boolean>();
  onOpenLink.mockReturnValue(true);
  const onRequestAction =
    vi.fn<(sandboxId: string, action: AppAction) => Promise<boolean> | null>();
  onRequestAction.mockResolvedValue(true);
  const services: SandboxServices = {
    defaults: TEST_DEFAULTS,
    appOrigin,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
    storage: createMemoryStorage(),
    onChange,
    onOpenLink,
    onRequestAction,
    readTheme: readLightTheme,
  };
  const spiedServices: SpiedServices = {
    services,
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
    const spied = buildServices(OTHER_APP_ORIGIN);

    const runtime = launchSandbox(
      buildSandbox("./samples/mods/book_list", null),
      spied.services,
    );

    expect(runtime.status).toBe("loading");
    expect(spied.onChange).not.toHaveBeenCalled();
    await runtime.settled;
    expect(runtime.status).toBe("running");
    expect(runtime.launch?.mod.source).toBe(SAMPLE_MOD_SOURCE);
    expect(readSandboxIssues(runtime)).toHaveLength(1);
    expect(readSandboxIssues(runtime)[0].message).toContain(
      "Permission not granted",
    );
    expect(spied.onChange).toHaveBeenCalledOnce();
  });

  it("lists the collection issues before the permission issues", async function ordersIssues(): Promise<void> {
    serveFourBooks();
    const spied = buildServices(OTHER_APP_ORIGIN);

    const runtime = launchSandbox(
      buildSandbox("./samples/mods/book_list", FOUR_BOOKS_SOURCE),
      spied.services,
    );
    await runtime.settled;

    const issues = readSandboxIssues(runtime);
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toContain("is not of tile type");
    expect(issues[1].message).toContain("Permission not granted");
  });

  it("Missing mod file", async function failsMissingMod(): Promise<void> {
    const spied = buildServices();

    const runtime = launchSandbox(
      buildSandbox("./samples/mods/missing", null),
      spied.services,
    );
    await runtime.settled;

    expect(runtime.status).toBe("failed");
    expect(runtime.launch).toBeNull();
    expect(runtime.errorMessage).toContain(
      "https://example.org/samples/mods/missing/mod_conf.yaml",
    );
    expect(runtime.errorMessage).toContain("404");
    expect(spied.onChange).toHaveBeenCalledOnce();
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
  });

  it("ignores a launch that settles after the runtime was stopped", async function ignoresLateLaunch(): Promise<void> {
    const spied = buildServices();

    const runtime = launchSandbox(
      buildSandbox("./samples/mods/book_list", null),
      spied.services,
    );
    stopSandbox(runtime, null);
    await runtime.settled;

    expect(runtime.status).toBe("stopped");
    expect(runtime.launch).toBeNull();
    expect(spied.onChange).not.toHaveBeenCalled();
  });
});

describe("attachSandboxFrame", function describeAttachSandboxFrame(): void {
  it("connects a session and adds its issues to the runtime", async function connectsSession(): Promise<void> {
    const spied = buildServices();
    const { runtime, modPort } = await startSandbox(
      buildSandbox("./samples/mods/book_list", null),
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
    expect(readSandboxIssues(runtime)).toEqual([
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
      buildSandbox("./samples/mods/book_list", null),
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
      buildSandbox("./samples/mods/book_list", null),
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
      buildSandbox("./samples/mods/book_list", null),
      spied,
    );

    stopSandbox(runtime, {
      level: "error",
      source: SAMPLE_MOD_SOURCE,
      message: "The mod left its page and was stopped.",
    });

    expect(runtime.status).toBe("stopped");
    expect(runtime.session?.stopped).toBe(true);
    expect(readSandboxIssues(runtime)).toEqual([
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
      buildSandbox("./samples/mods/book_list", null),
      spied,
    );

    stopSandbox(runtime, null);

    expect(runtime.status).toBe("stopped");
    expect(readSandboxIssues(runtime)).toEqual([]);
  });
});

describe("reloadSandboxTiles", function describeReloadSandboxTiles(): void {
  it("pushes tiles.changed and replaces the collection issues", async function reloadsTiles(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime, received } = await startSandbox(
      buildSandbox("./samples/mods/book_list", FOUR_BOOKS_SOURCE),
      spied,
    );
    expect(readSandboxIssues(runtime)).toHaveLength(1);
    testTexts.set(
      FOUR_BOOKS_SOURCE,
      'collection:\n  name: "Two books"\n  tiles:\n    - path: "./books/kallocain.md"\n    - path: "./books/fictions.md"',
    );

    await reloadSandboxTiles(runtime, spied.services);
    await waitForMessages();

    expect(readSandboxIssues(runtime)).toEqual([]);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      jsonrpc: "2.0",
      method: "tiles.changed",
      params: { issues: [] },
    });
    const params = (received[0] as { params: { tiles: unknown[] } }).params;
    expect(params.tiles).toHaveLength(2);
  });

  it("lists a collection that cannot be reloaded as an error", async function reportsReloadFailure(): Promise<void> {
    serveFourBooks();
    const spied = buildServices();
    const { runtime } = await startSandbox(
      buildSandbox("./samples/mods/book_list", FOUR_BOOKS_SOURCE),
      spied,
    );
    testTexts.delete(FOUR_BOOKS_SOURCE);

    await reloadSandboxTiles(runtime, spied.services);

    expect(readSandboxIssues(runtime)).toEqual([
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
      buildSandbox("./samples/mods/book_list", null),
      spied,
    );
    spied.services.fetchOptions = { baseUrl: APP_BASE_URL, fetch: fetchSpy };

    await reloadSandboxTiles(runtime, spied.services);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.launch?.collectionSource).toBeNull();
  });
});
