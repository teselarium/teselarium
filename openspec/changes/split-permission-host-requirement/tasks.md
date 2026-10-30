# Tasks

## 1. Check the split

- [x] 1.1 Verify that the delta moves the scenarios without changing them: the scenario blocks under "Permission host format", "Wildcard hosts outside open" and "Any site in open" in `specs/mod-loading/spec.md` are, as a set, exactly the eleven under "Permission hosts are origins" in `openspec/specs/mod-loading/spec.md`, text included, and each of the three descriptions is 500 characters or fewer. Run `openspec validate split-permission-host-requirement --strict` and verify it reports the change as valid
- [x] 1.2 Verify that no code, test or doc names the removed requirement: `grep -rn "Permission hosts are origins" src e2e docs` matches nothing. Run `npx vitest run src/lib/mod` and verify it passes with no test changed

## 2. Release note

- [x] 2.1 Add `.changeset/split-permission-host-requirement.md` as an empty changeset (`npx changeset --empty`, then rename the file it creates), following the "Bump rule" section of `docs/releasing.md`: the change ships nothing to the people who use or instantiate the app, so it bumps no version, and the mod API does not change. Summary below its front matter: "Spec only: the mod file's host rules are stated as three requirements, with no change in what mod files accept." Verify `npx changeset status` lists no package to bump

## Workflow follow-up

- Archive the change with `/opsx:archive`, syncing the `mod-loading` delta. In the sync, place "Permission host format", "Wildcard hosts outside open" and "Any site in open", in that order, where "Permission hosts are origins" was, after "Permission declarations" and before "Mod file is plain YAML", as design.md says.
- After the archive, verify the order of the requirements in `openspec/specs/mod-loading/spec.md`, that its eleven host scenarios are the ones it had before, and that `openspec validate --specs --strict` passes for all 18 specs.
