import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeSchema } from "rehype-sanitize";

/** The badge variants of the base stylesheet's `span[data-tes-variant]`. */
const BADGE_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "destructive",
  "success",
  "warning",
];

const SECTIONING_ELEMENTS = ["article", "section", "header", "footer", "aside"];

const defaultAttributes = defaultSchema.attributes ?? {};

/**
 * What HTML a page's markdown may hold: GitHub's sanitizing (no scripts,
 * frames, forms, `style` or event handlers, `javascript:` and `data:` URLs
 * stripped, ids prefixed), plus the elements and attributes the base
 * stylesheet gives the mods' look to: the sectioning elements (`<article>` is
 * a card), `role` as `alert` or `status`, badges (`data-tes-variant` on
 * `<span>`) and color scheme sections (`data-tes-color-scheme`).
 */
export const PAGE_SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...SECTIONING_ELEMENTS],
  attributes: {
    ...defaultAttributes,
    "*": [
      ...(defaultAttributes["*"] ?? []),
      ["role", "alert", "status"],
      ["dataTesColorScheme", "light", "dark"],
    ],
    span: [
      ...(defaultAttributes.span ?? []),
      ["dataTesVariant", ...BADGE_VARIANTS],
    ],
  },
};
