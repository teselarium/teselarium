import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeSchema } from "rehype-sanitize";
import { ALERT_KINDS } from "./alerts_pass.ts";

const defaultAttributes = defaultSchema.attributes ?? {};

const defaultProtocols = defaultSchema.protocols ?? {};

const MEDIA_ATTRIBUTES = ["src", "poster", "width", "height"];

/**
 * What HTML a rendered tile body may hold: GitHub's sanitizing (no scripts,
 * frames, forms, `style` or event handlers, unsafe URLs stripped, ids
 * prefixed with `user-content-`), which keeps `<picture>` and `<source>` with
 * `srcset`, plus `<video>` and `<audio>` with their sources and posters, the
 * player placeholders, the alerts, and the math code classes.
 */
export const TILE_SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "video",
    "audio",
    "button",
    "aside",
  ],
  attributes: {
    ...defaultAttributes,
    video: MEDIA_ATTRIBUTES,
    audio: ["src"],
    source: [...(defaultAttributes.source ?? []), "src", "type"],
    button: [["type", "button"], ["className", "ot-player"], "dataOtPlayer"],
    span: [
      ...(defaultAttributes.span ?? []),
      ["className", "ot-player-box", "ot-player-title", "ot-player-host"],
    ],
    aside: [
      ["className", "ot-alert"],
      ["dataOtAlert", ...ALERT_KINDS],
    ],
    p: [...(defaultAttributes.p ?? []), ["className", "ot-alert-title"]],
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
  protocols: {
    ...defaultProtocols,
    poster: ["http", "https"],
  },
};
