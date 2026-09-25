
## Design principles

This project follow the next principles: 
- Don't Repeat Yourself
- Keep It Simple
- Separation of Concerns
- Single Responsibility
- Modular and Composable
- Composition over inheritance
- Domain Driven Design
- Test Driven Development

## Conventions

In order to improve readability when returning an output in a function, prefer to store the output in a variable first with a clear name instead of a direct return of the expression that produce the output. Prefer returning a single variable(e.g. "return variable_name"), instead of a list (e.g. "return [a, b, ...]") or a dict (e.g. "return {a, b}").

Don't use anonymous functions.
Use explicit loops (like: for, for..of, for..in).
Reduce complexity by avoiding embedded logics and thus reducing the levels of indentation. For example, when finding more than three levels of identation inside a function, it must be refactored by extracting some logic outside (for example in a separated function). Don't define functions inside functions.

Whenever is possible, prefer functional programming approach, for example creating functions that return an output without modifying the state of the input. 

Use clear naming of variables, functions, classes, methods, etc.