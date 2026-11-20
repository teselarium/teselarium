# Spec Delta

## ADDED Requirements

### Requirement: Viewer tables stack in a narrow frame
When its frame is narrower than 30rem, the collection viewer's tile table and the mod viewer's and mosaic viewer's permission tables SHALL show each row as a block, its values one under the other, without the header row. A tile SHALL show its label, then its address. A permission SHALL show its category and status, then its host, then its reason. No table SHALL be wider than its frame. In a frame 30rem or wider, the tables SHALL keep their columns.

#### Scenario: Collection viewer on a phone
- **WHEN** the collection viewer shows the Nobel laureates collection on a 412×915 viewport
- **THEN** the item `2010__mario_vargas_llosa.md` shows its label on one line, with its address below it
- **AND** the viewer's document cannot scroll sideways

#### Scenario: Mosaic viewer permissions on a small phone
- **WHEN** the mosaic viewer shows `nobel_books_list.yaml` on a 360×740 viewport
- **THEN** each permission's status badge, host and reason are inside the frame, and the viewer's document cannot scroll sideways

#### Scenario: Mod viewer permissions on a phone
- **WHEN** the mod viewer shows the book list mod on a 360×740 viewport
- **THEN** the `show` permission for `https://upload.wikimedia.org` shows its status badge `granted` inside the frame

#### Scenario: Wide frame keeps the columns
- **WHEN** the mosaic viewer shows `nobel_books_list.yaml` on a 1280×800 viewport
- **THEN** its permission table shows the header row `Category`, `Host`, `Reason`, `Status`, and each permission's values side by side

### Requirement: Stacked rows keep one separator each
A row of the viewers' tables that is stacked in a narrow frame SHALL have one separator, under its last value, and none between its values. The table's last row has none, as in a wide frame.

#### Scenario: Stacked rows keep one separator each
- **WHEN** the mosaic viewer shows `nobel_books_list.yaml` on a 360×740 viewport
- **THEN** each permission but the last has a line under its reason, and no permission has one between its category, host and reason

### Requirement: Stacked tables keep their semantics
A table that stacks its rows in a narrow frame SHALL still be exposed to assistive technology as a table: each row as a row, each value as a cell named by its column's heading, and the column headings as column headers, although the header row is not shown.

#### Scenario: Cells keep their column headings
- **WHEN** the mosaic viewer shows `nobel_books_list.yaml` on a 360×740 viewport
- **THEN** its permission table has the role `table`, four column headers `Category`, `Host`, `Reason` and `Status`, and one row per permission whose cells have the role `cell`

### Requirement: Tile viewer keeps its position on one line
The tile viewer's position in its collection, `<i> of <n>`, SHALL stay on one line at any frame width. When the collection's title and the position do not fit on one line, the title SHALL wrap. In a wide frame, the title SHALL be at the start of the line and only as wide as its text, and Next SHALL end the line.

#### Scenario: Position on a phone
- **WHEN** the tile viewer shows the seventh tile of the Nobel laureates collection, opened from it, on a 412×915 viewport
- **THEN** `7 of 17` is on one line, and the collection's title `Nobel Prize in Literature laureates` is fully shown

#### Scenario: Title on a wide frame
- **WHEN** the tile viewer shows a tile of its collection on a 1280×800 viewport
- **THEN** the collection's title starts the line and is only as wide as its text, and Next ends the line
