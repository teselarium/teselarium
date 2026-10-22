import type { ModThemeSetting } from "../../mod/index.ts";
import { THEME_FRAME_STYLES } from "../theme/index.ts";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";

/** The theme styles for a mod that keeps the default theme, nothing for one that opted out. */
function buildThemeStyleLines(theme: ModThemeSetting): string[] {
  if (theme === "none") {
    const noLines: string[] = [];
    return noLines;
  }
  const styleLines = [`<style>${THEME_FRAME_STYLES}</style>`];
  return styleLines;
}

/**
 * Builds the `srcdoc` HTML of a mod's frame: the Content-Security-Policy
 * first, since a `<meta>` policy only applies to what follows it, then the
 * theme styles unless the mod's `theme` is `"none"`, then the frame loader.
 * The mod's code is not in the document: it arrives over the channel. The
 * policy holds only keywords and checked origins, and the styles are static
 * text, so nothing needs escaping.
 */
export function buildSandboxDocument(
  policy: string,
  theme: ModThemeSetting,
): string {
  const sandboxDocument = [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    ...buildThemeStyleLines(theme),
    `<script type="module">${SANDBOX_LOADER}</script>`,
    "</head><body></body></html>",
  ].join("\n");
  return sandboxDocument;
}
