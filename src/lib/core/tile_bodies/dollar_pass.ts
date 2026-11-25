import type { Parent, PhrasingContent, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** The inline math node that `remark-math` adds to markdown trees. */
type InlineMath = Extract<PhrasingContent, { type: "inlineMath" }>;

/** Parses the source of dollars that are not math, without math. */
const TEXT_PARSER = unified().use(remarkParse).use(remarkGfm).freeze();

const LEADING_DOLLARS = /^\$+/;

const SPACE = /\s/;

const DIGIT = /\d/;

/**
 * Whether inline math follows the dollar rule of GitHub and Pandoc: the
 * opening dollars are followed by a non-space character, and the closing
 * dollars follow a non-space character and are not followed by a digit.
 * Math without source positions is kept.
 */
function followsDollarRule(math: InlineMath, source: string): boolean {
  const start = math.position?.start.offset;
  const end = math.position?.end.offset;
  if (start === undefined || end === undefined) {
    return true;
  }
  const written = source.slice(start, end);
  const fenceLength = LEADING_DOLLARS.exec(written)?.[0].length ?? 1;
  const formula = written.slice(fenceLength, written.length - fenceLength);
  const isOpenedBySpace = SPACE.test(formula.charAt(0));
  const isClosedBySpace = SPACE.test(formula.charAt(formula.length - 1));
  const isFollowedByDigit = DIGIT.test(source.charAt(end));
  const follows = !isOpenedBySpace && !isClosedBySpace && !isFollowedByDigit;
  return follows;
}

/** The markdown of dollars that are not math, rendered as the text they would be without math. */
function parseAsText(math: InlineMath, source: string): PhrasingContent[] {
  const start = math.position?.start.offset ?? 0;
  const end = math.position?.end.offset ?? 0;
  const written = source.slice(start, end);
  const firstBlock = TEXT_PARSER.parse(written).children[0];
  if (firstBlock?.type === "paragraph") {
    return firstBlock.children;
  }
  const textNodes: PhrasingContent[] = [{ type: "text", value: written }];
  return textNodes;
}

function isParent(node: RootContent): node is RootContent & Parent {
  const hasChildren = "children" in node;
  return hasChildren;
}

/**
 * The dollar pass: turns back into text, from the source, each inline math
 * that does not follow the dollar rule, so `It costs $5 and $10.` stays a
 * sentence. Changes the tree in place.
 */
export function applyDollarRule(tree: Parent, source: string): void {
  let index = 0;
  while (index < tree.children.length) {
    const child = tree.children[index];
    if (child.type === "inlineMath" && !followsDollarRule(child, source)) {
      const textNodes = parseAsText(child, source);
      tree.children.splice(index, 1, ...textNodes);
      index += textNodes.length;
      continue;
    }
    if (isParent(child)) {
      applyDollarRule(child, source);
    }
    index += 1;
  }
}
