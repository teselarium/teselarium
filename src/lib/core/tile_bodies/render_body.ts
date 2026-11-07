import type { Root as HtmlRoot } from "hast";
import type { Root as MarkdownRoot } from "mdast";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { ModIssue } from "../../mod/index.ts";
import type { Tile } from "../../tile/index.ts";
import { applyAlerts } from "./alerts_pass.ts";
import {
  BODY_EXTRA_LOADERS,
  buildExtraLoads,
  detectBodyExtras,
  loadBodyExtras,
  NO_EXTRA_PASSES,
} from "./body_extras.ts";
import type {
  BodyExtraLoaders,
  BodyExtraLoads,
  BodyExtraPasses,
} from "./body_extras.ts";
import { applyDollarRule } from "./dollar_pass.ts";
import { finishBody } from "./finishing_pass.ts";
import { replacePlayers } from "./players_pass.ts";
import type { TilePlayer } from "./players_pass.ts";
import { TILE_SANITIZE_SCHEMA } from "./tile_schema.ts";

/** What the engine needs to know about a tile's body, found without rendering its HTML. */
export interface TileBodyScan {
  /** The absolute addresses of the body's images, video, audio, sources, posters and `srcset` candidates. */
  mediaUrls: string[];
  /** Each player address the body holds, with its player and the title the body gives it. */
  playerAddresses: Map<string, TilePlayer>;
  /** One warning per iframe left out for the private network guard. */
  issues: ModIssue[];
}

/** Renders a tile's body to its HTML, loading the extras the body needs. */
export type TileBodyRenderer = (tile: Tile) => Promise<string>;

/** A body's sanitized and finished tree, with what scanning it found. */
interface SafeBody {
  tree: HtmlRoot;
  scan: TileBodyScan;
}

/** GitHub-flavored markdown with math, read from the body. */
const MARKDOWN_PARSER = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .freeze();

/** Markdown to HTML, with the HTML written in the body kept as raw nodes. Ids are prefixed once, by the sanitizer. */
const HTML_CONVERTER = unified()
  .use(remarkRehype, { allowDangerousHtml: true, clobberPrefix: "" })
  .freeze();

/** Parses the raw HTML, the body's and the math pass's, and adds GitHub's heading ids. */
const RAW_HTML_PARSER = unified().use(rehypeRaw).use(rehypeSlug).freeze();

const BODY_SANITIZER = unified()
  .use(rehypeSanitize, TILE_SANITIZE_SCHEMA)
  .freeze();

const HTML_WRITER = unified().use(rehypeStringify).freeze();

/** The body's markdown tree after the dollar and alerts passes. */
function readMarkdownTree(tile: Tile): MarkdownRoot {
  const markdownTree = MARKDOWN_PARSER.parse(tile.body);
  applyDollarRule(markdownTree, tile.body);
  applyAlerts(markdownTree);
  return markdownTree;
}

/** The steps the scan and the render share, with the extras' passes, which the scan skips. */
function buildSafeBody(
  markdownTree: MarkdownRoot,
  tile: Tile,
  passes: BodyExtraPasses,
): SafeBody {
  passes.replaceShortcodes(markdownTree);
  const convertedTree = HTML_CONVERTER.runSync(markdownTree);
  passes.renderMath(convertedTree);
  const htmlTree = RAW_HTML_PARSER.runSync(convertedTree);
  const bodyPlayers = replacePlayers(htmlTree, tile.source);
  passes.highlightCode(htmlTree);
  const safeTree = BODY_SANITIZER.runSync(htmlTree);
  const mediaUrls = finishBody(safeTree, tile.source);
  const safeBody: SafeBody = {
    tree: safeTree,
    scan: {
      mediaUrls,
      playerAddresses: bodyPlayers.playerAddresses,
      issues: bodyPlayers.issues,
    },
  };
  return safeBody;
}

/**
 * Scans a tile's body for what the engine checks at launch: its media, its
 * players and the iframes it leaves out, as rendering it would find them.
 * Extras add no media and no players, so the scan loads none and renders no
 * HTML. Synchronous; the tile is not changed.
 */
export function scanTileBody(tile: Tile): TileBodyScan {
  const safeBody = buildSafeBody(readMarkdownTree(tile), tile, NO_EXTRA_PASSES);
  return safeBody.scan;
}

async function renderWithExtras(
  loads: BodyExtraLoads,
  tile: Tile,
): Promise<string> {
  const markdownTree = readMarkdownTree(tile);
  const passes = await loadBodyExtras(loads, detectBodyExtras(markdownTree));
  const safeBody = buildSafeBody(markdownTree, tile, passes);
  const html = HTML_WRITER.stringify(safeBody.tree);
  return html;
}

/** Builds a renderer whose extras come from `loaders`, each loaded at most once by the renderer. */
export function buildTileBodyRenderer(
  loaders: BodyExtraLoaders,
): TileBodyRenderer {
  const renderer: TileBodyRenderer = renderWithExtras.bind(
    undefined,
    buildExtraLoads(loaders),
  );
  return renderer;
}

/**
 * Renders a tile's body to HTML that is safe and works inside a mod's
 * sandbox: GitHub-flavored markdown and the HTML GitHub allows, formulas as
 * MathML, labeled code highlighted, emoji shortcodes as emoji, alerts,
 * heading ids, players replaced by placeholders, paths resolved against the
 * tile, links marked to open through the app. Loads Temml, the highlighter
 * and the emoji names the first time a body needs them, once per page, and
 * rejects when one cannot be loaded. The tile is not changed.
 */
export const renderTileBody: TileBodyRenderer =
  buildTileBodyRenderer(BODY_EXTRA_LOADERS);
