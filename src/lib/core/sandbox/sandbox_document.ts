import SANDBOX_LOADER from "./sandbox_loader.js?raw";

/**
 * Builds the `srcdoc` HTML of a mod's frame: the Content-Security-Policy
 * first, since a `<meta>` policy only applies to what follows it, then the
 * frame loader. The mod's code is not in the document: it arrives over the
 * channel. The policy holds only keywords and checked origins, so nothing
 * needs escaping.
 */
export function buildSandboxDocument(policy: string): string {
  const sandboxDocument = [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    `<script type="module">${SANDBOX_LOADER}</script>`,
    "</head><body></body></html>",
  ].join("\n");
  return sandboxDocument;
}
