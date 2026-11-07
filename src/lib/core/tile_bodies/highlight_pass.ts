import type { Root } from "hast";
import rehypeHighlight from "rehype-highlight";
import { unified } from "unified";
import { UNHIGHLIGHTED_LABELS } from "./body_extras.ts";

/**
 * Highlights code with highlight.js's common languages, without guessing:
 * only code labeled with one of them is split into `hljs-` spans. Math and
 * mermaid blocks are not even given the `hljs` class, which the highlighter
 * adds to any other labeled code it tries.
 */
const CODE_HIGHLIGHTER = unified()
  .use(rehypeHighlight, { detect: false, plainText: UNHIGHLIGHTED_LABELS })
  .freeze();

/**
 * The highlighting pass, before sanitizing: the code of each `<pre>` whose
 * `language-<name>` class names one of highlight.js's common languages gets
 * the class `hljs` and its tokens in `<span>` elements with `hljs-` classes,
 * its text unchanged. Code with another language gets only the class `hljs`,
 * and code with no language, `math` or `mermaid` is left as it is. Changes
 * the tree in place.
 */
export function highlightCode(tree: Root): void {
  CODE_HIGHLIGHTER.runSync(tree);
}
