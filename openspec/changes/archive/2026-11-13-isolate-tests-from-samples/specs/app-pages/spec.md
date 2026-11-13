## MODIFIED Requirements

### Requirement: Links in pages
A link from a page to a sibling markdown file (`<page>.md` or `./<page>.md`) SHALL open `#/<section>/<page>` in the app as a new history entry. A link to an app address (`#/...`) SHALL be followed in the app. A link to another site SHALL open in a new browsing context without access to the app. Any other relative link SHALL resolve against the page's file.

#### Scenario: Sibling page
- **WHEN** the Guides index page links to `first_steps.md` and the user follows it
- **THEN** the address is `#/guides/first_steps`, and the browser's back button shows the Guides index page again

#### Scenario: Run link
- **WHEN** a page links to the run link of a mod and the user follows it
- **THEN** the linked mod runs in the stage

#### Scenario: Other site
- **WHEN** a page links to `https://example.com/` 
- **THEN** the link has `target="_blank"` and `rel="noopener noreferrer"`
