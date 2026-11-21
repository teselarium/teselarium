# Tasks

## 1. Split the docs

- [x] 1.1 Add `docs/code_principles.md`. It has:
  - the title and opening paragraphs of design.md decision 2, word for word;
  - the "Design principles", "Practices" and "Tests" sections, with the rules that design.md decision 1 assigns to the principles.

  Move rules word for word. Reword a sentence only where the move makes it read wrong, and never change its meaning. Verify that the "Tests" section matches today's five rules word for word, and that the commit clause is not in the file.
- [x] 1.2 Rewrite `docs/code_conventions.md`. It has:
  - the title and opening paragraphs of design.md decision 2, word for word;
  - the "Code", "Vendored code", "UI components", "Phones and color schemes" and "OpenSpec changes" sections (the last with "Proposal", "Specs" and "Tasks" subsections), with the rules that design.md decision 1 assigns to the conventions, including the `rules` of `openspec/config.yaml`.

  Add no lint markers (design.md decision 3), and keep "The lint enforces it." in "Vendored code". Verify that the three exceptions of "UI components" keep their numbers. Using decision 1's table, verify that each rule of the old file and of the `config.yaml` rules appears exactly once across the two files, apart from the dropped commit clause.
- [x] 1.3 In `docs/README.md`, list "Code Principles: [code_principles.md](code_principles.md)" before the "Code Conventions" entry. Verify that both links open the files.

## 2. Loading instructions

- [x] 2.1 In `openspec/config.yaml`, replace the `context` with the text of design.md decision 4 and replace each artifact's `rules` with the pointer of decision 4, keeping `schema` and the commented examples. Verify that `openspec instructions <artifact> --change split-code-principles-and-conventions --json` returns the new `context` for `proposal`, `specs`, `design` and `tasks`, the pointer as the only rule for `proposal`, `specs` and `tasks`, and no rules for `design`.
- [x] 2.2 In `AGENTS.md`, replace the line "Read docs/code_conventions.md before writing code." with the line of design.md decision 4. Verify that the other rules of `AGENTS.md` are unchanged.

## 3. References

- [x] 3.1 Point the two "Tests" citations to the principles:
  - the `e2e/**` lint message in `.oxlintrc.json`, which becomes "(docs/code_principles.md, Tests)";
  - the comment in `e2e/test_mods.ts`.

  Point the "Mod API version" section of `docs/modules/lib/core/engine/README.md` to `docs/code_conventions.md`, "OpenSpec changes", instead of `openspec/config.yaml`. Verify that `npm run lint` passes.
- [x] 3.2 Run `grep -rn "code_conventions" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive .`. For each result, verify that it is in one of these places, and that the section it names, if any, is still in `docs/code_conventions.md`:
  - `openspec/changes/split-code-principles-and-conventions/`;
  - `openspec/discarded-changes/`, which is history like the archive and is left unchanged;
  - a place that design.md decision 5 lists as unchanged;
  - a place this change updated.

## 4. Release

- [x] 4.1 Add `.changeset/split-code-principles-and-conventions.md` with a `"opentesela": patch` bump and the summary "The code rules are split into general principles and project conventions; no change to the app." This follows the "Bump rule" of `docs/releasing.md`: nothing breaks for users or instantiations. Verify that `npx changeset status` lists it.

## 5. Verification

- [x] 5.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all pass, and that `openspec validate split-code-principles-and-conventions` passes.
