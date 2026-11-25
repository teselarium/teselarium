# Spec Delta

## Purpose

Shows an instantiation's own content, such as the Home, Guides and About sections, as markdown pages that look exactly like mods: where the files live and how their addresses work, how they are rendered with the mods' theme styles in isolation from the app, which HTML they may hold, and how their links and images behave.

## ADDED Requirements

### Requirement: Page routes
For a section whose target is a page, the address `#/<section>` SHALL show the section's index page, and `#/<section>/<page>` SHALL show its page named `<page>`. A page name SHALL match `[A-Za-z0-9_-]+`. An address with a name that does not match, or with an unknown section, SHALL show Home.

#### Scenario: Index page
- **WHEN** the vanilla app is opened at `#/guides`
- **THEN** the Guides index page is shown and no mod frame is visible

#### Scenario: Sub-page
- **WHEN** the app is opened at `#/guides/first_steps` and the Guides section has that page
- **THEN** the page `first_steps` of Guides is shown

#### Scenario: Name with a path
- **WHEN** the app is opened at `#/guides/..%2Fabout%2Findex`
- **THEN** Home is shown and no file outside `pages/guides/` is requested

### Requirement: Page files
A page section's pages SHALL be markdown files in `pages/<section>/` next to the app: `index.md` for the index page and `<page>.md` for a page named `<page>`. A file's front matter SHALL NOT be shown. An instantiation SHALL change a page by replacing its file.

#### Scenario: Index file
- **WHEN** the app at `https://example.org/` shows the About index page
- **THEN** its content is the body of `https://example.org/pages/about/index.md`

#### Scenario: Replaced page
- **WHEN** `pages/home/index.md` holds `# Welcome to the Library`
- **THEN** the Home page shows a level 1 heading `Welcome to the Library`

#### Scenario: Front matter
- **WHEN** a page file starts with front matter holding `title: "Draft"`
- **THEN** the page does not show `title` or `Draft`

### Requirement: Pages look like mods
A page's content SHALL be rendered in an isolated root that holds the theme tokens and the same base stylesheet as a mod frame. The app's own styles SHALL NOT apply inside it, and its styles SHALL NOT apply outside it. The page SHALL follow the color scheme without reloading.

#### Scenario: Same heading as a mod
- **WHEN** a page and a mod that adds no styles both show a level 1 heading
- **THEN** both headings have the same computed font size, font weight and color

#### Scenario: Card in a page
- **WHEN** a page holds an `<article>`
- **THEN** its computed background color is the value of `--ot-card` and its border color is the value of `--ot-border`

#### Scenario: Page styles stay inside
- **WHEN** a page with a table is shown
- **THEN** the sidebar's and the header's computed styles are the same as on a page without a table

#### Scenario: Dark page
- **WHEN** the Home page is shown and the color scheme changes from `light` to `dark`
- **THEN** the page's computed text color becomes the dark value of `--ot-foreground` without reloading the app page

### Requirement: Allowed HTML in pages
HTML in a page's markdown SHALL be rendered, keeping only text formatting, headings, lists, tables, images, links, code, `<article>`, `<section>`, `<header>`, `<footer>`, `<aside>`, `<details>` and `<summary>`; `role` with the values `alert` and `status`; `data-ot-variant` on `<span>`; and `data-ot-color-scheme`. Every other element and attribute SHALL be removed, including scripts, frames, forms, `style` and event handler attributes.

#### Scenario: Card from markdown
- **WHEN** a page's markdown holds `<article><h2>Start here</h2></article>`
- **THEN** the page shows a card holding the heading `Start here`

#### Scenario: Badge from markdown
- **WHEN** a page's markdown holds `<span data-ot-variant="success">New</span>`
- **THEN** the page shows a success badge `New`

#### Scenario: Script removed
- **WHEN** a page's markdown holds `<script>window.pwned = true</script>`
- **THEN** the page holds no `<script>` element and `window.pwned` is undefined

#### Scenario: Event handler removed
- **WHEN** a page's markdown holds `<img src="x.png" onerror="window.pwned = true">`
- **THEN** the image has no `onerror` attribute and `window.pwned` is undefined

#### Scenario: Style attribute removed
- **WHEN** a page's markdown holds `<p style="position: fixed">Text</p>`
- **THEN** the paragraph has no `style` attribute

### Requirement: Links in pages
A link from a page to a sibling markdown file (`<page>.md` or `./<page>.md`) SHALL open `#/<section>/<page>` in the app as a new history entry. A link to an app address (`#/...`) SHALL be followed in the app. A link to another site SHALL open in a new browsing context without access to the app. Any other relative link SHALL resolve against the page's file.

#### Scenario: Sibling page
- **WHEN** the Guides index page links to `first_steps.md` and the user follows it
- **THEN** the address is `#/guides/first_steps`, and the browser's back button shows the Guides index page again

#### Scenario: Run link
- **WHEN** the Home page links to `#/run?mod=./samples/mods/book_list` and the user follows it
- **THEN** the sample book list mod runs in the stage

#### Scenario: Other site
- **WHEN** a page links to `https://example.com/` 
- **THEN** the link has `target="_blank"` and `rel="noopener noreferrer"`

### Requirement: Images in pages
A relative image address in a page SHALL resolve against the page's file.

#### Scenario: Image next to the page
- **WHEN** `pages/about/index.md` shows `![Logo](./logo.svg)` in the app at `https://example.org/`
- **THEN** the image's address is `https://example.org/pages/about/logo.svg`

### Requirement: Page load failures
When a page's file cannot be loaded, the page SHALL show an error alert that names the file's address and the reason. The sidebar SHALL keep working.

#### Scenario: Missing page
- **WHEN** the app is opened at `#/guides/missing` and `pages/guides/missing.md` does not exist
- **THEN** the page shows an alert that names the resolved address of `pages/guides/missing.md` and `404`, and the sidebar can still open Home

### Requirement: Vanilla pages
The vanilla app SHALL ship an index page for Home, Guides and About, each with a level 1 heading naming its section and a status note saying that the section is a work in progress.

#### Scenario: Vanilla Home
- **WHEN** the vanilla app is opened with no hash
- **THEN** the Home page shows a level 1 heading and an element with `role="status"` saying the page is a work in progress
