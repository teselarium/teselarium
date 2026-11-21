# Proposal

## Why

`docs/code_conventions.md` mixes two kinds of rules: general ones that would hold in any project (design principles, naming, error context, the test rules) and ones specific to this project (code shape, the vendored zone, the UI component policy). Nothing says which is which, so a new rule has no clear home. The project-specific part is the one that keeps growing.

`openspec/config.yaml` is a second home for project rules: its per-artifact `rules` hold the phone and color-scheme requirements, the mod API bump, the changeset task and the verification task. They are rules of this project like the others, but a reader of the conventions never sees them.

## What Changes

- **New `docs/code_principles.md`** with the general rules: the design principles list, the UI/UX and module coherence paragraphs, the general rules of today's "Conventions" section (readable code, functional style, domain naming, errors with context, TDD for complex bugs, no hardcoded fixes), the "spec-driven, not vibe coding" stance, and the "Tests" section.
- **`docs/code_conventions.md` keeps only the project-specific rules**:
  - the code-shape rules (no anonymous functions, no returned literals, explicit loops, at most three levels of indentation, no nested functions, explicit return types), "Vendored code" and "UI components";
  - a new "Phones and color schemes" section and a new "OpenSpec changes" section, with the rules that move out of `openspec/config.yaml`. "OpenSpec changes" has a "Proposal", a "Specs" and a "Tasks" subsection.
- **Opening lines of both files**:
  - Both state the placement test, which is new: "Would this rule hold in another project with another stack?" Yes means the rule goes in the principles, no means it goes in the conventions.
  - The conventions file also says to read the principles first. The conventions apply the principles, so they are never read alone.
- **One home per rule**:
  - The "AI may not commit or push" sentence leaves the docs, because `AGENTS.md` already holds it.
  - The per-artifact `rules` move from `openspec/config.yaml` to the conventions. Each artifact's `rules` entry only points to its subsection.
- **Loading**:
  - Exploring loads the principles only.
  - Every artifact and writing code load the principles and then the conventions.
  - The loading instructions say to read each file once per session, and again only when its text is no longer in context.
- **`openspec/config.yaml`** keeps `schema`, a `context` that says to read both files, and for the proposal, specs and tasks one rule that points to their subsection of "OpenSpec changes".
- **`AGENTS.md`**: before writing code, read `docs/code_principles.md`, then `docs/code_conventions.md`.
- **References**:
  - `docs/README.md` lists both files.
  - The two links to the "Tests" section point to the principles: the lint message in `.oxlintrc.json` and the comment in `e2e/test_mods.ts`.
  - The links to "Vendored code" and "UI components" stay valid, since those sections stay in the conventions.
- **Wording**: rules move as they are written today. A sentence is only reworded where moving it makes it read wrong, and the meaning never changes.

No app behavior changes. Phone viewports and color schemes do not apply, because nothing visible changes. No mod API spec changes, so the mod API version is not bumped.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a docs and workflow-configuration change with no spec-level behavior change, so the change sets `skip_specs: true`.

## Impact

- **Docs**: the new `docs/code_principles.md`, `docs/code_conventions.md` and `docs/README.md`.
- **Agent and workflow config**: `AGENTS.md` and `openspec/config.yaml`.
- **References**: `.oxlintrc.json` (a lint message only, with no rule change) and `e2e/test_mods.ts` (a comment only).
- **Release**: a patch changeset that says the app does not change, as `streamline-test-suite` and `isolate-tests-from-samples` did.
- **Out of scope**:
  - a zone index in the conventions, and moving zone rules into zone READMEs (revisit when a third zone section appears);
  - Claude Code path-scoped rules;
  - lint rule changes, and markers that say which rules lint enforces;
  - archived changes, which keep their links to the old file as history.
