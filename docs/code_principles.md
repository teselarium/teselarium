# Code principles

The general rules of this project. They would hold in another project with another stack. A rule that holds only here, with this stack or this code, goes in [code_conventions.md](code_conventions.md).

Read this file before exploring, proposing, planning or writing code. Agents read it once per session, and again only when its text is no longer in their context.

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

UI and user experience must be coherent between the different pages and components of the application. The consistency helps to accelerate the user learning curve by making the interaction more intuitive.

Code modules and components must be coherent, simple and with well defined boundaries (see the principles mentioned before). The application design and the code design should make the developer experience easier and reduce the learning curve, and also make the application more consistent, intuitive, robust and easy to evolve.

## Practices

AI is used in this project for accelerating development via OpenSpec (spec-driven development, not vibe coding).
Keep code readable for humans.

Whenever possible, prefer functional programming approach, for example creating functions that return an output without modifying the state of the input.

Use clear naming of variables, functions, classes, methods, etc.
Prefer naming based on domain concepts (use ubiquitous language, avoid generic names like utils, helpers, manager).

Error messages must include context.

When fixing complex bugs prefer a TDD approach: write the failing test first, then fix the code.

Do not hardcode fixes, search instead for robust solutions that prevents the problem from reappearing.

## Tests

- Test each behavior once, at the lowest level that can prove it. Go up a
  level only for what the lower one cannot observe.
- A module's tests protect that module and use their own fixtures. They never
  depend on examples, demos or other modules' fixtures.
- Test effort follows importance: critical modules are tested thoroughly,
  examples and optional parts lightly.
- The default run covers what every change can break. Tests of optional or
  isolated parts run when those parts change, and in a full run before a
  release.
- Run expensive variants (environments, platforms, configurations) only for
  tests whose result depends on them.
