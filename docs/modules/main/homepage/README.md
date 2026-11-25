# Pages

Home, Guides and About are markdown pages: files that an instantiation writes or replaces, shown in the app's main area. They look exactly like mods, because they get the same base stylesheet. This document covers every page section; the [About](../about/README.md) section works the same way. The Settings section's page is the app's own (see [Settings](../settings/README.md)).

A section is a page section when its `target` in the [section registry](../README.md#the-section-registry) is `{ page: true }`.

## Files and addresses

A page section's pages are markdown files in `pages/<section>/`, next to the app (in this repository, `public/pages/`):

| Address | File, for an app at `https://example.org/` |
|---|---|
| `#/` | `https://example.org/pages/home/index.md` (the Home section's index page) |
| `#/guides` | `https://example.org/pages/guides/index.md` |
| `#/guides/first_steps` | `https://example.org/pages/guides/first_steps.md` |
| `#/about` | `https://example.org/pages/about/index.md` |

- `#/<section>` shows the section's index page, `index.md`, and `#/<section>/<page>` its page named `<page>`, `<page>.md`. Sub-pages are siblings of the index page: a page section has no folders inside it.
- A page name matches `[A-Za-z0-9_-]+`. An address with any other name (`..`, `/`, an encoded `%2F`), or with a section that is not a page section, shows Home, and no file is requested for it.
- Under a sub-path, such as GitHub Pages' `https://example.org/<repo>/`, the files are looked up next to the app: `https://example.org/<repo>/pages/...`.
- A file's front matter (a `---` YAML block at the top) is not shown, so a page can carry metadata for later tooling.
- A page is loaded each time it is shown, so a replaced file shows after the next visit. When it cannot be loaded, the page shows an error alert with the file's address and the reason (for example `HTTP 404`); the sidebar keeps working.
- To change a page, replace its file. To add a sub-page, add a `<page>.md` file and link to it.

The vanilla app ships an index page for Home, Guides and About: a level 1 heading and a note that the section is a work in progress.

## Pages look like mods

A page is rendered in an isolated shadow root that holds the theme tokens and the mods' base stylesheet (`THEME_FRAME_STYLES`, see the [theme module](../../lib/core/theme/README.md)), plus a few rules that give the page's body what a frame's `<body>` gets: padding, text color and font. Not the background: a page is drawn on the app's canvas (see [Canvas and panels](../README.md#canvas-and-panels)), so in light it is white where a mod's frame is cream.

- Plain HTML gets the app's look without classes, exactly as in a mod: a heading in a page and in a mod have the same size, weight and color.
- The app's own styles (Tailwind, shadcn/ui) do not apply inside a page, and a page's styles do not apply to the sidebar.
- A page follows the color scheme at once, without a reload.
- A page's content is at most `--tes-reading-width` wide and centered, so lines of text stay short enough to read on wide screens. In a narrower page area it fills the area. Pages have no theater mode.

## Markdown and HTML

Pages are [GitHub-flavored markdown](https://github.github.com/gfm/): headings, lists, tables, task lists, strikethrough, code, links and images. HTML written in the markdown is rendered after it is sanitized: everything outside the following list is removed.

- Text formatting, headings, paragraphs, lists, tables, images, links, code, `<blockquote>`, `<div>` and `<span>`.
- The sectioning elements `<article>`, `<section>`, `<header>`, `<footer>` and `<aside>`, and `<details>` with `<summary>`.
- `role="alert"` and `role="status"` on any element.
- `data-tes-variant` on a `<span>`, with `primary`, `secondary`, `outline`, `destructive`, `success` or `warning`.
- `data-tes-color-scheme="light"` or `"dark"` on any element.

Scripts, frames, forms, `<style>`, `style` attributes, event handler attributes (`onclick`, `onerror`, ...) and `javascript:` links are removed. Ids get the prefix `user-content-`, as on GitHub.

Leave a blank line between an HTML tag and markdown inside it, so the markdown is parsed:

```html
<article>

## Start here

Open [Mods](#/run?mod=mod_explorer) to see what the app can run.

</article>
```

### Examples

A **card**: an `<article>` has the card's background, border and radius.

```html
<article>
  <h2>Start here</h2>
  <p>A short introduction.</p>
</article>
```

An **alert** and a **status note**:

```html
<div role="alert">This collection is no longer maintained.</div>
<div role="status">This section is a work in progress.</div>
```

A **badge**:

```html
<span data-tes-variant="success">New</span>
```

A **disclosure**:

```html
<details>
  <summary>How are mods sandboxed?</summary>
  Each mod runs in its own frame, with no access to the app.
</details>
```

A **color scheme section**, drawn in the dark colors whatever the app's color scheme:

```html
<section data-tes-color-scheme="dark">Always dark.</section>
```

## Links and images

| A link to | Becomes |
|---|---|
| a sibling page, `first_steps.md` or `./first_steps.md` | `#/<section>/first_steps`, a new history entry in the app (`index.md` gives `#/<section>`) |
| an app address, `#/run?mod=...`, `#/settings` | followed in the app, as a new history entry |
| another site, `https://example.com/` | opened in a new tab, with `rel="noopener noreferrer"`, so it has no access to the app |
| anything else relative, `../about/team.pdf` | resolved against the page's file: `https://example.org/pages/about/team.pdf` |

A relative image address resolves against the page's file: in `pages/about/index.md`, `![Logo](./logo.svg)` shows `https://example.org/pages/about/logo.svg`. Keep a page's images next to it.

## Module details

| File | Owns |
|---|---|
| `src/main/pages/PageView.tsx` | Which page to show: the Settings page, or the markdown page of the shown page section. |
| `src/main/pages/MarkdownPage.tsx` | Loading the file, the shadow root and its styles, and the load error. |
| `src/main/pages/page_markdown.tsx` | The markdown pipeline: `react-markdown` with `remark-gfm`, `rehype-raw`, then `rehype-sanitize`. |
| `src/main/pages/page_sanitize_schema.ts` | The allowed HTML: GitHub's sanitizing schema plus the elements and attributes above. |
| `src/main/pages/page_links.ts` | The file of a page, and the link and image rules. |
