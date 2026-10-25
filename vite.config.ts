import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Alias } from "vite";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

/** Resolves a path of the repository. */
function resolveRepoPath(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

/** The app's version, from `package.json`, which the build gives to `src/main/app_version.ts`. */
function readAppVersion(): string {
  const packagePath = resolveRepoPath("./package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    version?: unknown;
  };
  const version = packageJson.version;
  if (typeof version !== "string") {
    throw new Error(
      `Cannot read the app's version: "version" in ${packagePath} is not a string.`,
    );
  }
  return version;
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
    plugins: [tailwindcss(), react()],
    resolve: { alias: buildAliases(mode) },
    define: { __APP_VERSION__: JSON.stringify(readAppVersion()) },
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
