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
import { applyDollarRule } from "./dollar_pass.ts";
import { finishBody } from "./finishing_pass.ts";
import { replacePlayers } from "./players_pass.ts";
import type { TilePlayer } from "./players_pass.ts";
import { TILE_SANITIZE_SCHEMA } from "./tile_schema.ts";

/** A tile's body rendered for a mod, with what the engine needs to know about it. */
export interface RenderedBody {
  /** The sanitized HTML. */
  html: string;
  /** The absolute addresses of the body's images, video, audio, sources, posters and `srcset` candidates. */
  mediaUrls: string[];
  /** Each player address the body holds, with its player and the title the body gives it. */
  playerAddresses: Map<string, TilePlayer>;
  /** One warning per iframe left out for the private network guard. */
  issues: ModIssue[];
}

/** GitHub-flavored markdown with math, read from the body. */
const MARKDOWN_PARSER = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .freeze();

/**
 * Markdown to HTML, with the HTML written in the body parsed and GitHub's
 * heading ids. Ids are prefixed once, by the sanitizer.
 */
const HTML_CONVERTER = unified()
  .use(remarkRehype, { allowDangerousHtml: true, clobberPrefix: "" })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .freeze();

const BODY_SANITIZER = unified()
  .use(rehypeSanitize, TILE_SANITIZE_SCHEMA)
  .freeze();

const HTML_WRITER = unified().use(rehypeStringify).freeze();

/**
 * Renders a tile's body to HTML that is safe and works inside a mod's
 * sandbox: GitHub-flavored markdown and the HTML GitHub allows, math kept as
 * code, alerts, heading ids, players replaced by placeholders, paths resolved
 * against the tile, links marked to open through the app. Pure and
 * synchronous; the tile is not changed.
 */
export function renderTileBody(tile: Tile): RenderedBody {
  const markdownTree = MARKDOWN_PARSER.parse(tile.body);
  applyDollarRule(markdownTree, tile.body);
  applyAlerts(markdownTree);
  const htmlTree = HTML_CONVERTER.runSync(markdownTree);
  const bodyPlayers = replacePlayers(htmlTree, tile.source);
  const safeTree = BODY_SANITIZER.runSync(htmlTree);
  const mediaUrls = finishBody(safeTree, tile.source);
  const renderedBody: RenderedBody = {
    html: HTML_WRITER.stringify(safeTree),
    mediaUrls,
    playerAddresses: bodyPlayers.playerAddresses,
    issues: bodyPlayers.issues,
  };
  return renderedBody;
}
