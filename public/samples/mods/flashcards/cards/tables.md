---
title: "Tables"
question: "Which character separates the cells of a table?"
answer: "The pipe, |"
---

## Tables

Pipes separate the cells, and a line of dashes separates the header row from
the others:

| Syntax     | Gives  |
| ---------- | ------ |
| `*text*`   | italic |
| `**text**` | bold   |

### Alignment

Colons in the dashes line align a column: `:---` to the left, `:---:` to the
center and `---:` to the right.

| Left | Center | Right |
| :--- | :----: | ----: |
| a    |   b    |     c |

## See also

Tables cannot hold block content, such as lists or code blocks, in their cells.
