---
title: "Code blocks"
question: "How do you get syntax highlighting in a fenced code block?"
answer: "Write the language's name right after the opening fence, such as ```js"
---

## Code blocks

Three backticks open and close a fenced code block. The language's name after
the opening fence turns on its highlighting:

```js
function greet(name) {
  return `Hello, ${name}!`;
}
```

Inline code goes between single backticks: `greet("Ada")`.
