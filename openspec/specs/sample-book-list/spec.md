# sample-book-list Specification

## Purpose

Describes what the shipped sample book list mod (`public/samples/mods/book_list/`) shows and how the user works with it: a grid of book covers, the number of books per row, and a card with each book's metadata and body.

## Requirements

### Requirement: Books in a grid
The mod SHALL show its title as a heading, then one list item per tile, in the tiles' order, laid out as a grid. Each item SHALL hold a button for the book whose accessible name holds the book's title and authors. Each book's cover area SHALL fill its column with a width to height ratio of 2:3, so all books in the grid have the same size.

#### Scenario: The sample books
- **WHEN** the mod runs with the sample collection
- **THEN** it shows a list of 3 items, "Fahrenheit 451", "Kallocain" and "The Library of Babel" in that order
- **AND** the buttons of the three books have the same width and the same height, and each height is 1.5 times its width

#### Scenario: Name of a book's button
- **WHEN** the mod runs with the sample collection
- **THEN** the button of Kallocain has an accessible name that contains "Kallocain" and "Karin Boye"

#### Scenario: A tile without a title
- **WHEN** the mod receives a tile whose metadata has no string `title`
- **THEN** the book shows the tile's `source` as its title

### Requirement: Book shape
Each book's cover area SHALL have square left corners and right corners rounded with the theme's radius (`--ot-radius`).

#### Scenario: Corners of a book
- **WHEN** the mod runs with the sample collection
- **THEN** the top-left and bottom-left corner radii of each book's button are `0px`
- **AND** its top-right and bottom-right corner radii are the value of `--ot-radius`

### Requirement: Title and authors under each cover
Each book SHALL show its title and its authors, joined with `, `, as text under its cover. A title longer than two lines SHALL be cut at two lines. At 8 and 10 books per row, the authors SHALL be left out of the text under the cover, and SHALL stay in the button's accessible name.

#### Scenario: Text under the cover
- **WHEN** the mod runs with the sample collection at 6 books per row
- **THEN** "Kallocain" and "Karin Boye" are visible under Kallocain's cover

#### Scenario: Authors left out at 10 per row
- **WHEN** the user chooses 10 books per row
- **THEN** "Karin Boye" is not visible, and Kallocain's button still has an accessible name that contains "Karin Boye"

### Requirement: Books per row
Next to the heading, the mod SHALL show a select labeled "Books per row" with the options 4, 6, 8 and 10. Choosing one SHALL lay the grid out with that many books per row, without reloading the mod's frame. The default SHALL be the config key `columns` when it is one of those numbers, and 6 otherwise. The mod file SHALL set `columns: 6`.

#### Scenario: Default books per row
- **WHEN** the mod runs with the sample collection in a frame 1200px wide
- **THEN** "Books per row" shows 6 and the grid has 6 columns

#### Scenario: Choosing books per row
- **WHEN** the user chooses 4 in "Books per row"
- **THEN** the grid has 4 columns and each book is wider than before

#### Scenario: Config sets the default
- **WHEN** the mod is mounted with the config `columns: 8` and nothing stored
- **THEN** "Books per row" shows 8

#### Scenario: Unknown config value
- **WHEN** the mod is mounted with the config `columns: 5` and nothing stored
- **THEN** "Books per row" shows 6

### Requirement: Remembered books per row
The mod SHALL store the chosen number of books per row in its storage under the key `columns`, and SHALL use the stored value when the mod starts. A stored value that is not 4, 6, 8 or 10 SHALL be ignored.

#### Scenario: Choice kept across starts
- **WHEN** the user chooses 8 books per row and the mod is opened again
- **THEN** "Books per row" shows 8

#### Scenario: Stored value wins over the config
- **WHEN** the storage holds `columns` 10 and the config sets `columns: 4`
- **THEN** "Books per row" shows 10

#### Scenario: Unknown stored value
- **WHEN** the storage holds `columns` 7 and the config sets `columns: 6`
- **THEN** "Books per row" shows 6

### Requirement: Narrow frames
A book SHALL NOT be narrower than 4.5rem. When the frame is too narrow for the chosen number of books per row, the grid SHALL show as many books per row as fit, and the select SHALL keep showing the chosen number.

#### Scenario: Ten per row in a narrow frame
- **WHEN** 10 books per row are chosen and the mod's frame is 400px wide
- **THEN** each book is at least 4.5rem wide, the grid has fewer than 10 columns, and "Books per row" shows 10

### Requirement: Placeholder book
A book SHALL show a placeholder instead of a cover when its metadata has no string `image`, when its cover fails to load, or when the config `show_covers` is not `true`. The placeholder SHALL have the same size and shape as a cover and show the book's title.

#### Scenario: No image
- **WHEN** the mod receives a tile titled "Untitled draft" with no `image`
- **THEN** that book's button shows the placeholder with the text "Untitled draft", with the size of the other books

#### Scenario: Cover fails to load
- **WHEN** the cover of Kallocain answers HTTP 404
- **THEN** Kallocain's button shows the placeholder with the text "Kallocain"

#### Scenario: Covers switched off
- **WHEN** the mod is mounted with the config `show_covers: false`
- **THEN** every book shows the placeholder and no cover image is requested

### Requirement: No books
When the mod receives no tiles, it SHALL show the heading and a status "There are no books to show.", with no grid and no "Books per row" select.

#### Scenario: Run without a collection
- **WHEN** the mod runs without a collection
- **THEN** it shows the status "There are no books to show." and no select

### Requirement: Book card
Clicking a book SHALL open a modal dialog, labeled by the book's title, that shows the book's metadata at the top and its body below. The rest of the mod SHALL NOT be usable while the card is open.

#### Scenario: Open Kallocain's card
- **WHEN** the user clicks Kallocain
- **THEN** a modal dialog named "Kallocain" is open, with "Kallocain" as its heading
- **AND** it shows the start of Kallocain's body, "Kallocain is a 1940 dystopian novel"

#### Scenario: Grid behind the card
- **WHEN** Kallocain's card is open and the user clicks where Fahrenheit 451 is shown
- **THEN** Fahrenheit 451's card is not opened, and no dialog is open, since the click lands on the backdrop

### Requirement: Card metadata
The top of the card SHALL show the book's cover when it has one, then its title, its authors, its year of publication, `country`, `language` and `pages` as labeled values, and each of its `genres` as a badge. A key that the tile lacks, or whose value has the wrong type, SHALL be left out without an empty label. The card SHALL NOT show the `image` address as text.

#### Scenario: Kallocain's metadata
- **WHEN** the user opens Kallocain's card
- **THEN** it shows "Karin Boye", "1940", "Sweden", "Swedish" and "220" as values
- **AND** it shows the badges "Dystopian", "Political" and "Social science fiction"

#### Scenario: Missing keys
- **WHEN** the user opens the card of a tile whose metadata has only `title`
- **THEN** the card shows the title and the body, and no labeled values and no badges

### Requirement: Year of publication
The card SHALL show the book's `date` labeled "Published": only its first four digits when it is a string that starts with four digits, and otherwise as written.

#### Scenario: Full date
- **WHEN** the user opens Kallocain's card, whose tile has `date: "1940-10-01"`
- **THEN** the card shows "1940" labeled "Published"

#### Scenario: Date without a year
- **WHEN** the user opens the card of a tile whose `date` is `"c. 1940"`
- **THEN** the card shows "c. 1940" labeled "Published"

### Requirement: No cover in the card
When the book has no cover (no string `image`, a cover that fails to load, or `show_covers` not `true`), the card SHALL show neither a cover nor a placeholder.

#### Scenario: Covers switched off in the card
- **WHEN** the mod is mounted with the config `show_covers: false` and the user opens Kallocain's card
- **THEN** the card shows no image and no placeholder, and its heading is "Kallocain"

### Requirement: Card body
Below the metadata, the card SHALL show the book's body as the engine renders it (see `tile-bodies`), so its links, media and players behave as in any rendered body. An empty body SHALL show nothing below the metadata.

#### Scenario: A link in the body
- **WHEN** the user opens Kallocain's card and clicks the link to `https://en.wikipedia.org/wiki/Kallocain` in its body
- **THEN** the mod sends `links.open` with that address and its frame does not navigate

### Requirement: Closing the card
The card SHALL close when the user presses Escape, presses its close button (accessible name "Close"), or clicks the backdrop outside it. A click inside the card SHALL NOT close it. After it closes, focus SHALL be on the book whose card it was. The book SHALL show the focus ring only when the card was closed with the keyboard: Escape, or Enter or Space on the close button.

#### Scenario: Escape
- **WHEN** Kallocain's card is open and the user presses Escape
- **THEN** no dialog is open and Kallocain's button has focus and shows the focus ring

#### Scenario: Close button
- **WHEN** Kallocain's card is open and the user clicks "Close" with the mouse, then moves the pointer off the books
- **THEN** no dialog is open, and Kallocain's button has focus, shows no focus ring and has no `box-shadow`

#### Scenario: Close button with the keyboard
- **WHEN** Kallocain's card is open, "Close" has focus and the user presses Enter
- **THEN** no dialog is open and Kallocain's button has focus and shows the focus ring

#### Scenario: Backdrop
- **WHEN** Kallocain's card is open and the user clicks the backdrop outside it, away from the books
- **THEN** no dialog is open, and Kallocain's button has focus and shows no focus ring

#### Scenario: Click inside the card
- **WHEN** Kallocain's card is open and the user clicks its body text
- **THEN** the card stays open

### Requirement: Card follows the tiles
While a card is open, it SHALL stay open when the tiles change and its book is still among them, and SHALL then show that book's new metadata and body. It SHALL close when its book is no longer among the tiles.

#### Scenario: Tiles reloaded with the book
- **WHEN** Kallocain's card is open and the user presses "Reload tiles" with a collection that still lists Kallocain, now with `pages: 230`
- **THEN** Kallocain's card is still open and shows "230"
- **AND** Kallocain's button has `aria-expanded="true"`

#### Scenario: Tiles reloaded without the book
- **WHEN** Kallocain's card is open and the user presses "Reload tiles" with a collection that no longer lists Kallocain
- **THEN** no dialog is open

### Requirement: Raised book
A book SHALL be raised, moved up a little and given the theme's shadow (`--ot-shadow`), while the pointer is over it, while it has keyboard focus, and while its card is open. When the user prefers reduced motion, a raised book SHALL get the shadow without moving.

#### Scenario: Raised on hover
- **WHEN** the pointer is over Kallocain's book
- **THEN** Kallocain's button has the computed `box-shadow` of `--ot-shadow` and its computed transform moves it up
- **AND** the other books' buttons have no `box-shadow`

#### Scenario: Raised while the card is open
- **WHEN** Kallocain's card is open
- **THEN** Kallocain's button has the computed `box-shadow` of `--ot-shadow` and its computed transform moves it up

#### Scenario: Back after closing
- **WHEN** the user opens and closes Kallocain's card, moves the pointer off the books and clicks the heading
- **THEN** Kallocain's button has no `box-shadow` and its computed transform is `none`

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and the pointer is over Kallocain's book
- **THEN** Kallocain's button has the computed `box-shadow` of `--ot-shadow` and its computed transform is `none`

### Requirement: The open book's state
Each book's button SHALL have `aria-haspopup="dialog"`. The button of the book whose card is open SHALL have `aria-expanded="true"`, and every other book's button SHALL have `aria-expanded="false"`.

#### Scenario: State while the card is open
- **WHEN** Kallocain's card is open
- **THEN** Kallocain's button has `aria-expanded="true"` and the other books' buttons have `aria-expanded="false"`

#### Scenario: State after closing
- **WHEN** the user opens and closes Kallocain's card
- **THEN** every book's button has `aria-expanded="false"`
