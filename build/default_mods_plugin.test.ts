import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, resolveConfig } from "vite";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { bundleDefaultMod } from "./default_mod_build.ts";
import type { ServedModFile } from "./default_mod_build.ts";
import { defaultModsPlugin } from "./default_mods_plugin.ts";

/** A Vite root whose `default_mods/` is the bundle function's fixtures. */
const FIXTURES_ROOT = join(
  import.meta.dirname,
  "..",
  "src",
  "test",
  "fixtures",
);

/** A dev server of the plugin, behind an HTTP server on a free port. */
interface PluginDevServer {
  viteServer: ViteDevServer;
  httpServer: HttpServer;
  baseUrl: string;
}

/** Paths below `/default_mods/` that the fixtures do not serve: source, README, missing files and root files. */
const NOT_SERVED_PATHS = [
  "split_mod/README.md",
  "split_mod/src/main.ts",
  "split_mod/missing.js",
  "missing_mod/main.js",
  "README.md",
  "outside_module.ts",
];

const openServers: PluginDevServer[] = [];
const temporaryFolders: string[] = [];

function listenOnFreePort(httpServer: HttpServer): Promise<void> {
  const listening = new Promise<void>(function waitForListening(resolve): void {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  return listening;
}

async function startPluginDevServer(root: string): Promise<PluginDevServer> {
  const viteServer = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true },
    plugins: [defaultModsPlugin()],
  });
  const httpServer = createHttpServer(viteServer.middlewares);
  await listenOnFreePort(httpServer);
  const address = httpServer.address() as AddressInfo;
  const devServer: PluginDevServer = {
    viteServer,
    httpServer,
    baseUrl: `http://127.0.0.1:${address.port}/`,
  };
  openServers.push(devServer);
  return devServer;
}

function closeHttpServer(httpServer: HttpServer): Promise<void> {
  const closing = new Promise<void>(function waitForClose(resolve): void {
    httpServer.close(function finishClose(): void {
      resolve();
    });
  });
  return closing;
}

function createTemporaryRoot(): string {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "default-mods-plugin-"));
  temporaryFolders.push(temporaryRoot);
  return temporaryRoot;
}

function writeRootFile(root: string, path: string, text: string): void {
  const filePath = join(root, path);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, text);
}

function findServedFile(
  servedFiles: ServedModFile[],
  path: string,
): ServedModFile {
  for (const servedFile of servedFiles) {
    if (servedFile.path === path) {
      return servedFile;
    }
  }
  throw new Error(`The bundle of the fixture mod has no ${path}.`);
}

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  const responseBytes = new Uint8Array(await response.arrayBuffer());
  return responseBytes;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  const responseText = await response.text();
  return responseText;
}

/** Edits the source of the fixture `edited_mod`, then fetches a URL as text. */
async function editThenFetchText(root: string, url: string): Promise<string> {
  writeRootFile(
    root,
    "default_mods/edited_mod/src/main.ts",
    'export const LABEL: string = "after_edit";\n',
  );
  const responseText = await fetchText(url);
  return responseText;
}

afterEach(async function closeServers(): Promise<void> {
  for (const devServer of openServers.splice(0)) {
    await closeHttpServer(devServer.httpServer);
    await devServer.viteServer.close();
  }
  for (const temporaryFolder of temporaryFolders.splice(0)) {
    rmSync(temporaryFolder, { recursive: true, force: true });
  }
});

describe("defaultModsPlugin in dev", function describeDevServer(): void {
  it("answers a bundled file with the bytes of the build", async function answersBundledFile(): Promise<void> {
    const devServer = await startPluginDevServer(FIXTURES_ROOT);
    const builtFiles = await bundleDefaultMod(
      join(FIXTURES_ROOT, "default_mods", "split_mod"),
    );

    const response = await fetch(
      `${devServer.baseUrl}default_mods/split_mod/main.js`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript");
    expect(await readResponseBytes(response)).toEqual(
      findServedFile(builtFiles, "main.js").content,
    );
  });

  it("answers a copied file", async function answersCopiedFile(): Promise<void> {
    const devServer = await startPluginDevServer(FIXTURES_ROOT);

    const response = await fetch(
      `${devServer.baseUrl}default_mods/split_mod/data/items.json`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: ["one", "two"] });
  });

  it("answers 404 for files that are not served", async function answersNotFound(): Promise<void> {
    const devServer = await startPluginDevServer(FIXTURES_ROOT);

    const statuses: Record<string, number> = {};
    for (const path of NOT_SERVED_PATHS) {
      const response = await fetch(`${devServer.baseUrl}default_mods/${path}`);
      statuses[path] = response.status;
    }

    const expectedStatuses: Record<string, number> = {};
    for (const path of NOT_SERVED_PATHS) {
      expectedStatuses[path] = 404;
    }
    expect(statuses).toEqual(expectedStatuses);
  });

  it("answers 500 with the message when the source cannot be bundled", async function answersBundleError(): Promise<void> {
    const devServer = await startPluginDevServer(FIXTURES_ROOT);

    const response = await fetch(
      `${devServer.baseUrl}default_mods/syntax_error/main.js`,
    );

    expect(response.status).toBe(500);
    const responseText = await response.text();
    expect(responseText).toContain(
      "src/test/fixtures/default_mods/syntax_error/",
    );
    expect(responseText).toContain("src/main.ts");
  });

  it("answers 500 with the message on a conflicting main.js", async function answersConflict(): Promise<void> {
    const devServer = await startPluginDevServer(FIXTURES_ROOT);

    const response = await fetch(
      `${devServer.baseUrl}default_mods/main_conflict/main.js`,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toMatch(/src\/main\.ts.*main\.js/);
  });

  it("serves the changed source after an edit", async function servesEditedSource(): Promise<void> {
    const root = createTemporaryRoot();
    writeRootFile(
      root,
      "default_mods/edited_mod/src/main.ts",
      'export const LABEL: string = "before_edit";\n',
    );
    const devServer = await startPluginDevServer(root);
    const mainUrl = `${devServer.baseUrl}default_mods/edited_mod/main.js`;
    expect(await fetchText(mainUrl)).toContain("before_edit");

    // Written again on each try, since the watcher misses edits made before its first scan ends.
    await expect
      .poll(editThenFetchText.bind(undefined, root, mainUrl), {
        timeout: 5000,
      })
      .toContain("after_edit");
  });
});

describe("defaultModsPlugin start", function describePluginStart(): void {
  it("fails when public/default_mods/ exists", async function failsOnOldFolder(): Promise<void> {
    const root = createTemporaryRoot();
    writeRootFile(root, "public/default_mods/mod_viewer/mod_conf.yaml", "");

    const resolving = resolveConfig(
      {
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [defaultModsPlugin()],
      },
      "build",
    );

    await expect(resolving).rejects.toThrow("public/default_mods/");
    await expect(resolving).rejects.toThrow(
      "default mods now live in default_mods/ at the repository's root",
    );
  });
});
