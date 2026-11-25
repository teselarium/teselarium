import type { Root as HtmlRoot } from "hast";
import type { Code, Parent, Root as MarkdownRoot, RootContent } from "mdast";

/** A pass that changes a markdown tree in place. */
export type MarkdownTreePass = (tree: MarkdownRoot) => void;

/** A pass that changes an HTML tree in place. */
export type HtmlTreePass = (tree: HtmlRoot) => void;

/** Which extras a body needs: math for formulas, highlighting for labeled code, emoji for shortcodes. */
export interface BodyExtraNeeds {
  math: boolean;
  highlighting: boolean;
  emoji: boolean;
}

/** Loads the pass of each extra, from the chunk that holds its library. */
export interface BodyExtraLoaders {
  math: () => Promise<HtmlTreePass>;
  highlighting: () => Promise<HtmlTreePass>;
  emoji: () => Promise<MarkdownTreePass>;
}

/** The passes of the extras, each one leaving the tree as it is when the body does not need it. */
export interface BodyExtraPasses {
  replaceShortcodes: MarkdownTreePass;
  renderMath: HtmlTreePass;
  highlightCode: HtmlTreePass;
}

/** A loader whose first load is kept and shared, and forgotten when it fails. */
interface OnceLoad<T> {
  load: () => Promise<T>;
  promise: Promise<T> | null;
}

/** The loads of the extras of one renderer, each one at most once while it succeeds. */
export interface BodyExtraLoads {
  math: OnceLoad<HtmlTreePass>;
  highlighting: OnceLoad<HtmlTreePass>;
  emoji: OnceLoad<MarkdownTreePass>;
}

/** What may be an emoji shortcode. Times such as `10:30:45` match too, and stay text. */
const SHORTCODE = /:[a-z0-9_+-]+:/;

/** The code labels that are not highlighted: math is rendered as math, and diagrams are drawn by mods. */
export const UNHIGHLIGHTED_LABELS = ["math", "mermaid"];

function isParent(node: RootContent): node is RootContent & Parent {
  const hasChildren = "children" in node;
  return hasChildren;
}

function noteCodeNeeds(code: Code, needs: BodyExtraNeeds): void {
  if (code.lang === "math") {
    needs.math = true;
    return;
  }
  const isLabeled = typeof code.lang === "string" && code.lang !== "";
  if (isLabeled && !UNHIGHLIGHTED_LABELS.includes(code.lang ?? "")) {
    needs.highlighting = true;
  }
}

function noteNodeNeeds(node: RootContent, needs: BodyExtraNeeds): void {
  switch (node.type) {
    case "inlineMath":
    case "math":
      needs.math = true;
      break;
    case "code":
      noteCodeNeeds(node, needs);
      break;
    case "text":
      if (SHORTCODE.test(node.value)) {
        needs.emoji = true;
      }
      break;
  }
}

function noteNeedsIn(parent: Parent, needs: BodyExtraNeeds): void {
  for (const child of parent.children) {
    noteNodeNeeds(child, needs);
    if (isParent(child)) {
      noteNeedsIn(child, needs);
    }
  }
}

/**
 * The detection walk, after the dollar and alerts passes: a body needs math
 * for inline math, display math or a code block labeled `math`; highlighting
 * for a code block labeled with anything else but `mermaid`; and emoji for a
 * text that holds `:name:`, `name` being lowercase letters, digits, `_`, `+`
 * or `-`. Code and math are not text, so a shortcode in them needs nothing.
 */
export function detectBodyExtras(tree: MarkdownRoot): BodyExtraNeeds {
  const needs: BodyExtraNeeds = {
    math: false,
    highlighting: false,
    emoji: false,
  };
  noteNeedsIn(tree, needs);
  return needs;
}

/** Leaves the tree as it is: the pass of an extra the body does not need. */
function skipPass(): void {}

/** The passes of a body that needs no extras, as the launch's scan uses them. */
export const NO_EXTRA_PASSES: BodyExtraPasses = {
  replaceShortcodes: skipPass,
  renderMath: skipPass,
  highlightCode: skipPass,
};

function buildOnceLoad<T>(load: () => Promise<T>): OnceLoad<T> {
  const onceLoad: OnceLoad<T> = { load, promise: null };
  return onceLoad;
}

/** Builds the loads of the extras: each loader is called at most once while its load succeeds. */
export function buildExtraLoads(loaders: BodyExtraLoaders): BodyExtraLoads {
  const loads: BodyExtraLoads = {
    math: buildOnceLoad(loaders.math),
    highlighting: buildOnceLoad(loaders.highlighting),
    emoji: buildOnceLoad(loaders.emoji),
  };
  return loads;
}

/** A failed load is forgotten, so the next body that needs it loads it again. */
function forgetFailedLoad<T>(onceLoad: OnceLoad<T>, error: unknown): never {
  onceLoad.promise = null;
  throw error;
}

function loadOnce<T>(onceLoad: OnceLoad<T>): Promise<T> {
  if (onceLoad.promise !== null) {
    return onceLoad.promise;
  }
  const promise = onceLoad
    .load()
    .catch(forgetFailedLoad.bind(undefined, onceLoad));
  onceLoad.promise = promise;
  return promise;
}

function loadPassIfNeeded<T>(
  isNeeded: boolean,
  onceLoad: OnceLoad<T>,
  unneededPass: T,
): Promise<T> {
  if (!isNeeded) {
    const unneeded = Promise.resolve(unneededPass);
    return unneeded;
  }
  const loaded = loadOnce(onceLoad);
  return loaded;
}

/** Loads the passes a body needs, at the same time; the others leave the tree as it is. */
export async function loadBodyExtras(
  loads: BodyExtraLoads,
  needs: BodyExtraNeeds,
): Promise<BodyExtraPasses> {
  const [replaceShortcodes, renderMath, highlightCode] = await Promise.all([
    loadPassIfNeeded(
      needs.emoji,
      loads.emoji,
      NO_EXTRA_PASSES.replaceShortcodes,
    ),
    loadPassIfNeeded(needs.math, loads.math, NO_EXTRA_PASSES.renderMath),
    loadPassIfNeeded(
      needs.highlighting,
      loads.highlighting,
      NO_EXTRA_PASSES.highlightCode,
    ),
  ]);
  const passes: BodyExtraPasses = {
    replaceShortcodes,
    renderMath,
    highlightCode,
  };
  return passes;
}

interface MathPassModule {
  renderMath: HtmlTreePass;
}

interface HighlightPassModule {
  highlightCode: HtmlTreePass;
}

interface EmojiPassModule {
  replaceShortcodes: MarkdownTreePass;
}

function readMathPass(module: MathPassModule): HtmlTreePass {
  return module.renderMath;
}

function readHighlightPass(module: HighlightPassModule): HtmlTreePass {
  return module.highlightCode;
}

function readEmojiPass(module: EmojiPassModule): MarkdownTreePass {
  return module.replaceShortcodes;
}

/** The math pass and Temml, in a chunk of their own the page fetches on first use. */
function importMathPass(): Promise<HtmlTreePass> {
  return import("./math_pass.ts").then(readMathPass);
}

/** The highlighting pass and highlight.js's common languages, in a chunk of their own. */
function importHighlightPass(): Promise<HtmlTreePass> {
  return import("./highlight_pass.ts").then(readHighlightPass);
}

/** The emoji pass and GitHub's emoji names, in a chunk of their own. */
function importEmojiPass(): Promise<MarkdownTreePass> {
  return import("./emoji_pass.ts").then(readEmojiPass);
}

/** The loaders of the app's extras, each one a chunk of its own. */
export const BODY_EXTRA_LOADERS: BodyExtraLoaders = {
  math: importMathPass,
  highlighting: importHighlightPass,
  emoji: importEmojiPass,
};
