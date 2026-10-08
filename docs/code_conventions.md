## Design principles

This project follows the next principles:

- Don't Repeat Yourself
- Keep It Simple
- Separation of Concerns
- Single Responsibility
- Modular and Composable
- Composition over inheritance
- Domain Driven Design
- Test Driven Development

## Conventions

Keep code readable for humans.
Don't use anonymous functions.
Don't write returns of anonymous object like anonymous list or dict (e.g. "return [a, b, ...]" or "return {a, b}"). Store the function output in a variable first and then return this variable (e.g. "variable_name = [a, b, ...]; return variable_name;").

Use explicit loops (like: for, for..of, for..in).
Reduce complexity by avoiding embedded logics and thus reducing the levels of indentation. For example, when finding more than three levels of indentation inside a function, it must be refactored by extracting some logic outside (for example in a separated function).
Avoid defining functions inside functions.

Whenever possible, prefer functional programming approach, for example creating functions that return an output without modifying the state of the input.

Use explicit return types.

Use clear naming of variables, functions, classes, methods, etc.
Prefer naming based on domain concepts (use ubiquitous language, avoid generic names like utils, helpers, manager).

Error messages must include context.

When fixing complex bugs prefer a TDD approach: write the failing test first, then fix the code.
