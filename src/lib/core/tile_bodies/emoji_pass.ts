import type { Root } from "mdast";
import remarkGemoji from "remark-gemoji";
import { unified } from "unified";

/** Turns GitHub's emoji shortcodes into their emoji. */
const SHORTCODE_REPLACER = unified().use(remarkGemoji).freeze();

/**
 * The emoji pass, on the markdown tree after the dollar and alerts passes:
 * each `:name:` of text whose name is one of GitHub's becomes its emoji, and
 * other names stay text. Code and math are not text, so they keep their
 * shortcodes. Changes the tree in place.
 */
export function replaceShortcodes(tree: Root): void {
  SHORTCODE_REPLACER.runSync(tree);
}
