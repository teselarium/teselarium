import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Alias, Plugin, Rollup } from "vite";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";
import { defaultModsPlugin } from "./build/default_mods_plugin.ts";

/** Resolves a path of the repository. */
function resolveRepoPath(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

/** The `version` of a `package.json`, which the build gives to the code that names it. */
function readPackageVersion(packagePath: string, packageName: string): string {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    version?: unknown;
  };
  const version = packageJson.version;
  if (typeof version !== "string") {
    throw new Error(
      `Cannot read the version of ${packageName}: "version" in ${packagePath} is not a string.`,
    );
  }
  return version;
}

/** The app's version, from `package.json`, which the build gives to `src/main/app_version.ts`. */
function readAppVersion(): string {
  const version = readPackageVersion(
    resolveRepoPath("./package.json"),
    "the app",
  );
  return version;
}

/** The shipped mermaid's version, which the build gives to `src/lib/core/engine/libs_methods.ts`. */
function readMermaidVersion(): string {
  const version = readPackageVersion(
    resolveRepoPath("./node_modules/mermaid/package.json"),
    "mermaid",
  );
  return version;
}

/** Vite's own limit, in kB, for every chunk but the shipped libraries. */
const CHUNK_SIZE_WARNING_LIMIT = 500;

/**
 * The limit, in kB, for the chunks of the libraries mods load
 * (`libs.load`): mermaid's single-file build is about 5,500 kB. Vite has one
 * limit for every chunk, so it gets this one and `warnLargeChunks` keeps
 * `CHUNK_SIZE_WARNING_LIMIT` for the others.
 */
const LIBRARY_CHUNK_SIZE_WARNING_LIMIT = 6000;

/** The modules whose chunks are libraries mods load. */
const LIBRARY_MODULE_PATTERN = /\/mermaid\/dist\/mermaid\.min\.js\?raw$/;

function isLibraryChunk(chunk: Rollup.OutputChunk): boolean {
  for (const moduleId of chunk.moduleIds) {
    if (LIBRARY_MODULE_PATTERN.test(moduleId)) {
      return true;
    }
  }
  return false;
}

function warnLargeChunk(
  this: Rollup.PluginContext,
  _options: Rollup.NormalizedOutputOptions,
  bundle: Rollup.OutputBundle,
): void {
  for (const output of Object.values(bundle)) {
    if (output.type !== "chunk" || isLibraryChunk(output)) {
      continue;
    }
    const sizeInKb = Buffer.byteLength(output.code) / 1000;
    if (sizeInKb > CHUNK_SIZE_WARNING_LIMIT) {
      this.warn(
        `The chunk ${output.fileName} is ${sizeInKb.toFixed(2)} kB after minification, larger than ${CHUNK_SIZE_WARNING_LIMIT} kB. Only the chunks of the libraries mods load may be larger.`,
      );
    }
  }
}

/** Warns about chunks larger than `CHUNK_SIZE_WARNING_LIMIT`, except the libraries mods load. */
function warnLargeChunks(): Plugin {
  const plugin: Plugin = {
    name: "opentesela:warn-large-chunks",
    apply: "build",
    generateBundle: warnLargeChunk,
  };
  return plugin;
}

/**
 * The e2e builds of instantiations the vanilla app cannot show (e2e/app_servers.ts):
 * `src/main.tsx` imports a test file in place of the vanilla one, so the
 * app's code has no test flag.
 */
const E2E_INSTANTIATIONS: Record<string, Alias[]> = {
  // Home is the mod explorer, and Guides has an image icon.
  "e2e-home-mod": [
    {
      find: /^\.\/main\/sections\/vanilla_sections\.ts$/,
      replacement: resolveRepoPath(
        "./src/test/registries/home_mod_sections.ts",
      ),
    },
  ],
  // The mod explorer is a switched-off default mod.
  "e2e-explorer-off": [
    {
      find: /^\.\/main\/default_mods\.ts$/,
      replacement: resolveRepoPath(
        "./src/test/registries/explorer_off_mods.ts",
      ),
    },
  ],
};

function buildAliases(mode: string): Alias[] {
  // Only vendored code is imported through `@/` (docs/code_conventions.md).
  const aliases: Alias[] = [
    { find: "@", replacement: resolveRepoPath("./src") },
    ...(E2E_INSTANTIATIONS[mode] ?? []),
  ];
  return aliases;
}

// https://vite.dev/config/
export default defineConfig(function buildConfig({ mode }): ViteUserConfig {
  const config: ViteUserConfig = {
    plugins: [tailwindcss(), react(), warnLargeChunks(), defaultModsPlugin()],
    resolve: { alias: buildAliases(mode) },
    define: {
      __APP_VERSION__: JSON.stringify(readAppVersion()),
      __MERMAID_VERSION__: JSON.stringify(readMermaidVersion()),
    },
    build: { chunkSizeWarningLimit: LIBRARY_CHUNK_SIZE_WARNING_LIMIT },
    // The app routes with the hash, so dev and preview answer missing files with 404 like static hosts.
    appType: "mpa",
    server: { host: "127.0.0.1" },
    preview: { host: "127.0.0.1" },
    test: {
      // The theme imports its base stylesheet as text, which Vitest empties unless CSS is processed.
      css: { include: [/base_stylesheet\.css/] },
      projects: [
        {
          extends: true,
          test: {
            name: "build",
            include: ["build/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          extends: true,
          test: {
            name: "lib",
            include: ["src/lib/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          extends: true,
          test: {
            name: "app",
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: ["src/lib/**"],
            environment: "jsdom",
            setupFiles: ["src/test/setup.ts"],
          },
        },
      ],
    },
  };
  return config;
});
