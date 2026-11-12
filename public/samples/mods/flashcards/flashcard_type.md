---
schema:
  definitions:
    flashcard:
      optionalProperties:
        title:
          type: string
        question: {}
        answer: {}
      additionalProperties: true
  ref: flashcard
---

# Flashcard Type

Any tile can be a flashcard: every property is optional, so every collection
matches this type. `title`, when the tile has one, must be a string. `question`
and `answer` take any value.

## Default fields

A study session asks for the field of the question and the field of the
answer. When the setup dialog opens with no remembered fields:

- The question is the `question` key when at least one tile has it, and
  "First heading" otherwise.
- When the question is a key, the answer is the `answer` key when at least one
  tile has it, and "Body" otherwise.

Any other metadata key can be chosen for either side, and "Body" shows the
whole body as the app renders it.

## First heading

With "First heading", the question is the first heading of the rendered body,
at any level, and the answer is its section: what follows the heading up to the
next heading of the same or a higher level, or to the end of the body. What
comes before the first heading is shown on neither side.

Only top-level headings count. A heading inside a blockquote, a list or an
alert is part of the content around it.

## Which tiles are cards

A tile is a card when both of its sides have a value:

- A metadata key has a value when it is a non-blank string, a number, a
  boolean, or a non-empty list of those. A list is shown with its items joined
  by `, `. Mappings are not values.
- "Body" has a value when the body is not blank.
- "First heading" has a value when the body has a heading with text and its
  section is not empty.

Metadata values are shown as plain text, as written, not rendered as markdown.
