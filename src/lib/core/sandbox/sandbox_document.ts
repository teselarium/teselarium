import type { ModThemeSetting } from "../../mod/index.ts";
import { THEME_FRAME_STYLES } from "../theme/index.ts";
import SANDBOX_ASSERTIONS from "./sandbox_assertions.js?raw";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";
import SANDBOX_TEST_RUNNER from "./sandbox_test_runner.js?raw";

/** What a frame document holds besides the frame loader. */
export interface SandboxDocumentOptions {
  /** Whether the frame runs a check's tests: the assertions and the test runner follow the loader. */
  testRunner?: boolean;
}

/** The theme styles for a mod that keeps the default theme, nothing for one that opted out. */
function buildThemeStyleLines(theme: ModThemeSetting): string[] {
  if (theme === "none") {
    const noLines: string[] = [];
    return noLines;
  }
  const styleLines = [`<style>${THEME_FRAME_STYLES}</style>`];
  return styleLines;
}

/** The frame loader, followed by the assertions and the test runner in the frames of a check's tests. */
function buildFrameScript(options: SandboxDocumentOptions): string {
  if (options.testRunner !== true) {
    return SANDBOX_LOADER;
  }
  const frameScript = [
    SANDBOX_LOADER,
    SANDBOX_ASSERTIONS,
    SANDBOX_TEST_RUNNER,
  ].join("\n");
  return frameScript;
}

/**
 * Builds the `srcdoc` HTML of a mod's frame: the Content-Security-Policy
 * first, since a `<meta>` policy only applies to what follows it, then the
 * theme styles unless the mod's `theme` is `"none"`, then the frame loader,
 * with the assertions and the test runner in the same module script when
 * `options.testRunner` is `true`. The mod's code is not in the document: it
 * arrives over the channel. The policy holds only keywords and checked
 * origins, and the styles are static text, so nothing needs escaping.
 */
export function buildSandboxDocument(
  policy: string,
  theme: ModThemeSetting,
  options: SandboxDocumentOptions = {},
): string {
  const sandboxDocument = [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    ...buildThemeStyleLines(theme),
    `<script type="module">${buildFrameScript(options)}</script>`,
    "</head><body></body></html>",
  ].join("\n");
  return sandboxDocument;
}
