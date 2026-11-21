# Design

## Context

See proposal.md, "Why". Today:

- `docs/code_conventions.md` has four sections: "Design principles", "Conventions", "Tests", "Vendored code" and "UI components". It has no title.
- The file reaches agents in two ways:
  - The `context` of `openspec/config.yaml`, which the CLI adds to the instructions of every artifact and of apply. So an artifact gets it however it is created.
  - `AGENTS.md`, for work outside OpenSpec.
- Code, docs and lint messages cite the file by section name, for example "docs/code_conventions.md, Tests". They don't use anchors, so a section keeps its links as long as its name and file stay the same.
- Oxlint (`.oxlintrc.json`) enforces `max-depth` 3, `func-style: declaration`, `func-names: always`, `typescript/explicit-function-return-type`, `unicorn/no-array-for-each`, `unicorn/no-array-reduce`, and the vendored zone's import restriction.

## Goals / Non-Goals

**Goals:**

- Each rule has exactly one home, and the opening line of each file decides where a new rule goes.
- The conventions are never reached without the principles, whichever way an agent arrives at them.

**Non-Goals:**

- Changing the meaning of any rule, or adding rules other than the placement test and the reading order.
- Changing lint rules. Only one lint message text changes.

## Decisions

### 1. Where each rule goes

| Today (section, rule) | Goes to (section) |
|---|---|
| Design principles: the list and both paragraphs | principles, "Design principles" |
| Conventions: "AI is used ... via OpenSpec (spec-driven development, not vibe coding)" | principles, "Practices". The clause "but AI is not authorized to create commits or push changes by it self" is dropped, because `AGENTS.md` holds it |
| Conventions: keep code readable for humans | principles, "Practices" |
| Conventions: prefer a functional approach | principles, "Practices" |
| Conventions: clear naming, domain naming | principles, "Practices" |
| Conventions: error messages include context | principles, "Practices" |
| Conventions: TDD for complex bugs | principles, "Practices" |
| Conventions: no hardcoded fixes | principles, "Practices" |
| Tests: the five rules | principles, "Tests" (same name, word for word) |
| Conventions: no anonymous functions | conventions, "Code" |
| Conventions: no returning anonymous literals | conventions, "Code" |
| Conventions: explicit loops | conventions, "Code" |
| Conventions: at most three levels of indentation | conventions, "Code" |
| Conventions: no functions inside functions | conventions, "Code" |
| Conventions: explicit return types | conventions, "Code" |
| Vendored code | conventions, "Vendored code" (same name) |
| UI components | conventions, "UI components" (same name, exceptions keep their numbers) |

- **Why "Practices" and "Code" as headings.** The old heading "Conventions" can't stay in the principles, because there it would name the other file. The general rules are habits of work, so "Practices". The project rules are about the shape of the code, so "Code".
- **What "exempt from the conventions above" now covers.** "Vendored code" keeps that phrase. It now refers to the "Code" section, which is what lint and review check vendored code against.
- **How rules are placed.** Each rule was placed with the placement test of decision 2.
- **Tests go to the principles** because they were written to be project-independent (`streamline-test-suite`, design decision 1).
- **Explicit return types stay in the conventions** because they depend on the stack (TypeScript).

### 2. Opening lines

Each file starts with a title and these paragraphs, word for word.

`docs/code_principles.md`:

> # Code principles
>
> The general rules of this project. They would hold in another project with another stack. A rule that holds only here, with this stack or this code, goes in [code_conventions.md](code_conventions.md).
>
> Read this file before exploring, proposing, planning or writing code. Agents read it once per session, and again only when its text is no longer in their context.

`docs/code_conventions.md`:

> # Code conventions
>
> The rules specific to this project. They apply [code_principles.md](code_principles.md) to this stack and this code. A rule that would hold in another project with another stack goes in the principles instead.
>
> Read the principles first: these conventions are never read alone. Read this file before designing, planning tasks or writing code. Agents read it once per session, and again only when its text is no longer in their context.
>
> A rule marked (lint) is enforced by Oxlint (`.oxlintrc.json`). A rule marked (lint, partly) has some of its forms caught by Oxlint, and review checks the rest. Review checks every unmarked rule.

- **Why both files state the test.** The test is written from each file's own side, so whichever file a reader opens tells them where the other kind of rule goes.
- **Why "read once" is phrased that way.** It is worded as "again only when its text is no longer in their context" rather than "never again", because after the context is summarized a re-read is the right thing to do.

### 3. Lint markers

| Convention | Marker | Why |
|---|---|---|
| No anonymous functions | (lint, partly) | `func-style` and `func-names` catch assigned and unnamed function expressions. Inline arrow callbacks pass |
| No returning anonymous literals | none | no rule |
| Explicit loops | (lint, partly) | `no-array-for-each` and `no-array-reduce`. `map` and `filter` pass |
| At most three levels of indentation | (lint, partly) | `max-depth` 3 counts nested blocks, not every level of indentation |
| No functions inside functions | none | `func-style: declaration` allows nested declarations |
| Explicit return types | (lint) | `typescript/explicit-function-return-type` |
| Vendored code never imports project code | (lint) | `no-restricted-imports` override for `src/vendor/**`. The marker replaces the sentence "The lint enforces it." |

**Alternative considered:** a single "(lint)" marker for partial checks too. Rejected, because it would tell a reader that lint backs up a rule in places where it doesn't.

### 4. Where each file is loaded

- **`openspec/config.yaml`, `context`**: it reaches every artifact and apply, so it carries both reading instructions:
  > Read `docs/code_principles.md` before proposing or updating openspec artifacts or writing code. When writing code, read `docs/code_conventions.md` after it. Read each file once per session, and again only when its text is no longer in your context.
- **`openspec/config.yaml`, rules**: `rules.design` (a new key) and `rules.tasks` (a new first entry) each get:
  > Read `docs/code_conventions.md`, after `docs/code_principles.md`, before writing this artifact.
- **`AGENTS.md`**: the line "Read docs/code_conventions.md before writing code." becomes:
  > Read docs/code_principles.md, then docs/code_conventions.md, before writing code. Read each once per session, and again only when its text is no longer in your context.

**Alternative considered:** leave the conventions out of `context` and rely on `AGENTS.md` for apply. Rejected, because `context` reaches apply in every agent, while `AGENTS.md` depends on the tool.

### 5. Links that change

- These two citations now point to the principles:
  - the lint message in `.oxlintrc.json`, which becomes "(docs/code_principles.md, Tests)";
  - the comment in `e2e/test_mods.ts`.
- `docs/README.md` lists "Code Principles" before "Code Conventions".
- Every other live citation names "Vendored code" or "UI components", or the file as a whole for code rules, so it stays valid. That covers `vite.config.ts`, `docs/stack.md`, `src/main/theme/ThemeControl.tsx`, `src/vendor/shadcn/README.md` and `default_mods/README.md`.

## Risks / Trade-offs

- **[A rule is lost or duplicated in the move]** → Verify against decision 1's table that each rule of today's file appears exactly once across the two files, apart from the dropped commit clause.
- **[A citation still points to a section that moved]** → Search for `code_conventions` outside `openspec/changes/archive/`, and check that each citation names a section that is still in that file.
- **[Rules end up in the wrong file]** → The placement test in both opening lines. The test can't settle every case, though. A rule that holds elsewhere only with changes is a judgment call, and should go in the conventions with a pointer to the principle it applies.
- **[Lint markers go stale when `.oxlintrc.json` changes]** → Accepted. The markers sit next to the rules, so a change to the lint config can update them in the same change.
- **[Agents read both files more often than they need]** → The "once per session" wording. Together the files are about 900 words, so the worst case costs little.

## Migration Plan

Docs and config only, so there is nothing to deploy. To roll back, revert the change.
