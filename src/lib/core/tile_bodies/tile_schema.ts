import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeSchema } from "rehype-sanitize";
import { ALERT_KINDS } from "./alerts_pass.ts";

/** The attributes a schema allows, by tag name. */
type AllowedAttributes = NonNullable<SanitizeSchema["attributes"]>;

const defaultAttributes: AllowedAttributes = defaultSchema.attributes ?? {};

const defaultProtocols = defaultSchema.protocols ?? {};

const MEDIA_ATTRIBUTES = ["src", "poster", "width", "height"];

/** The MathML Core elements Temml writes. */
const MATHML_TAG_NAMES = [
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mn",
  "mo",
  "ms",
  "mtext",
  "mspace",
  "mfrac",
  "msqrt",
  "mroot",
  "msub",
  "msup",
  "msubsup",
  "munder",
  "mover",
  "munderover",
  "mmultiscripts",
  "mprescripts",
  "none",
  "mtable",
  "mtr",
  "mtd",
  "mpadded",
  "mphantom",
  "mstyle",
  "menclose",
  "merror",
];

/** The presentation attributes of MathML, which neither link nor style. */
const MATHML_ATTRIBUTES: AllowedAttributes[string] = [
  "display",
  "displaystyle",
  "scriptlevel",
  "mathvariant",
  "lspace",
  "rspace",
  "stretchy",
  "symmetric",
  "fence",
  "separator",
  "form",
  "largeop",
  "movablelimits",
  "accent",
  "accentunder",
  "width",
  "height",
  "depth",
  "voffset",
  "linethickness",
  "columnalign",
  "rowalign",
  "columnspacing",
  "rowspacing",
  "notation",
  ["className", /^tml-/],
];

/** The presentation attributes for each MathML element, with `encoding` on `<annotation>`. */
function buildMathMlAttributes(): AllowedAttributes {
  const mathMlAttributes: AllowedAttributes = {};
  for (const tagName of MATHML_TAG_NAMES) {
    mathMlAttributes[tagName] = MATHML_ATTRIBUTES;
  }
  mathMlAttributes.annotation = [...MATHML_ATTRIBUTES, "encoding"];
  return mathMlAttributes;
}

/**
 * What HTML a rendered tile body may hold: GitHub's sanitizing (no scripts,
 * frames, forms, `style` or event handlers, unsafe URLs stripped, ids
 * prefixed with `user-content-`), which keeps `<picture>` and `<source>` with
 * `srcset`, plus `<video>` and `<audio>` with their sources and posters, the
 * player placeholders, the alerts, the math code classes and the error of a
 * formula that failed, the MathML of formulas with its presentation
 * attributes (never `href`, `style` or event handlers), and highlight.js's
 * `hljs` classes.
 */
export const TILE_SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "video",
    "audio",
    "button",
    "aside",
    ...MATHML_TAG_NAMES,
  ],
  attributes: {
    ...defaultAttributes,
    ...buildMathMlAttributes(),
    video: MEDIA_ATTRIBUTES,
    audio: ["src"],
    source: [...(defaultAttributes.source ?? []), "src", "type"],
    button: [["type", "button"], ["className", "tes-player"], "dataTesPlayer"],
    span: [
      ...(defaultAttributes.span ?? []),
      [
        "className",
        "tes-player-box",
        "tes-player-title",
        "tes-player-host",
        /^hljs-/,
      ],
    ],
    aside: [
      ["className", "tes-alert"],
      ["dataTesAlert", ...ALERT_KINDS],
    ],
    p: [...(defaultAttributes.p ?? []), ["className", "tes-alert-title"]],
    code: [
      ["className", /^language-./, "math-inline", "math-display", "hljs"],
      "dataTesMathError",
    ],
  },
  protocols: {
    ...defaultProtocols,
    poster: ["http", "https"],
  },
};
