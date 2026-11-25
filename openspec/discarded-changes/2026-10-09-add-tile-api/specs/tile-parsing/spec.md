# Spec Delta

## Purpose

Turns tile and tile type markdown documents (YAML frontmatter plus markdown body) into structured tile objects that the rest of OpenTesela can validate, display and pass to mods.

## ADDED Requirements

### Requirement: Parse a tile document into a tile object
The system SHALL parse a markdown document with YAML frontmatter, given with its source location, into a tile object with exactly three properties: the source (string), the metadata (object parsed from the frontmatter) and the body (string).

#### Scenario: Parse a sample book tile
- **WHEN** the contents of `samples/tiles/books/farenheit_451.md` are parsed with source `./books/farenheit_451.md`
- **THEN** the result has source `./books/farenheit_451.md`
- **AND** metadata.title is `"Fahrenheit 451"`, metadata.authors is `["Ray Bradbury"]` and metadata.pages is the number `156`
- **AND** body starts with `Fahrenheit 451 is a 1953 dystopian novel`

### Requirement: Preserve the markdown body unchanged
The system SHALL return as body the original markdown text that follows the closing frontmatter delimiter line, without rendering, trimming inner content or otherwise transforming it.

#### Scenario: Body keeps markdown syntax
- **WHEN** a tile whose body contains `# Heading`, a link and a blank line is parsed
- **THEN** the body contains the same heading, link and blank line, character for character

### Requirement: Documents without frontmatter
The system SHALL parse a document that has no frontmatter block into a tile with empty metadata and the whole document as body.

#### Scenario: Plain markdown file
- **WHEN** a document `# Just text` with no leading `---` block is parsed
- **THEN** metadata is an empty object and body is `# Just text`

### Requirement: Metadata is JSON-compatible
The system SHALL produce metadata that holds only JSON-compatible values (strings, numbers, booleans, null, arrays, plain objects). Unquoted YAML dates and timestamps SHALL stay strings and not become date objects.

#### Scenario: Unquoted date stays a string
- **WHEN** a tile with frontmatter line `date: 1953-10-19` (unquoted) is parsed
- **THEN** metadata.date is the string `"1953-10-19"`

### Requirement: Frontmatter must be a YAML mapping
The system SHALL reject a document whose frontmatter is not valid YAML, or whose top level is not a mapping (for example a list or a scalar), with a parse error that names the source.

#### Scenario: Invalid YAML
- **WHEN** a document with frontmatter `title: "unterminated` is parsed with source `bad.md`
- **THEN** parsing fails with a parse error whose message includes `bad.md`

#### Scenario: Frontmatter is a list
- **WHEN** a document whose frontmatter is `- a` and `- b` is parsed
- **THEN** parsing fails with a parse error saying that frontmatter must be a mapping

### Requirement: Frontmatter is never executed
The system SHALL treat frontmatter only as YAML data. It SHALL NOT evaluate frontmatter declared in another language (such as `---js`) or YAML tags that build executable or custom objects. Such documents SHALL be rejected with a parse error.

#### Scenario: JavaScript frontmatter is rejected
- **WHEN** a document starting with `---js` followed by `{ title: (() => "x")() }` is parsed
- **THEN** parsing fails with a parse error and no code is run

### Requirement: Parse tile type documents
The system SHALL parse tile type documents with the same parser, producing a tile object whose metadata holds the `schema` object exactly as written in the frontmatter.

#### Scenario: Parse the sample book type
- **WHEN** the contents of `samples/types/book.md` are parsed
- **THEN** metadata.schema.ref is `"book"` and metadata.schema.definitions.book.properties has the keys `title`, `date`, `authors`, `country` and `genres`
- **AND** body starts with `# Book Type`
