# Spec Delta

## MODIFIED Requirements

### Requirement: Case context
Each case's function SHALL receive a context with `mount`, `root` (the frame's body), `tiles` (the tiles the check gives), `storage` (`get(key)` and `set(key, value)` on the case's slot, with the rules of `storage.get` and `storage.set`, usable before mounting), `requests` (each request the mod sent, in order, as `{ method, params, result }` or `{ method, params, error }`), `answer`, `expect` and `waitFor`.

#### Scenario: Seeded storage
- **WHEN** a case of the sample mod sets `columns` to `10`, then mounts the mod
- **THEN** the mod's "Books per row" select shows 10

#### Scenario: Requests are recorded
- **WHEN** a case of the sample mod mounts the mod and chooses 10 books per row
- **THEN** `requests` lists `storage.get` for `columns` with its result and then `storage.set` with key `columns` and the value `10`

### Requirement: Sample mod tests
The sample mod `book_list` SHALL declare `test_path: "./test.js"`. Its test file SHALL have, among its cases, `lists the sample books`, which mounts the mod and expects the three sample books, and `remembers the books per row`, which seeds `columns` and expects that choice in the "Books per row" select.

#### Scenario: Sample tests
- **WHEN** the sample book list mod is checked
- **THEN** the report's tests are the cases of the sample's test file, among them `lists the sample books` and `remembers the books per row`, each with status `"pass"`
