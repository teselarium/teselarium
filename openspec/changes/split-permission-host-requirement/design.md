# Design

## Context

See proposal.md - Why. Two constraints of the OpenSpec CLI shape the delta:

- A MODIFIED requirement replaces the whole block at archive, so `openspec validate` rejects one that leaves out scenarios the main spec has (`MODIFIED "Permission hosts are origins" omits scenario(s) the current spec still has`).
- A requirement cannot be both REMOVED and ADDED in one delta (`Requirement present in both ADDED and REMOVED`).

In `openspec/specs/mod-loading/spec.md`, "Permission hosts are origins" sits between "Permission declarations" and "Mod file is plain YAML", with the other permission requirements.

## Goals / Non-Goals

**Goals:**
- Every requirement of `mod-loading` states one rule in 500 characters or fewer, and each scenario sits under the rule it tests.

**Non-Goals:**
- Rewording a scenario or changing what any rule accepts, rejects or says.
- Shortening other requirements, none of which is over the limit.

## Decisions

### Remove the requirement and add it back as "Permission host format"

The delta removes "Permission hosts are origins" and adds "Permission host format", "Wildcard hosts outside open" and "Any site in open". This is the only form the CLI accepts that moves scenarios out of a requirement. The REMOVED entry's reason names the three requirements, and its migration says that nothing changes for mod files.

*Alternative:* keep "Permission hosts are origins" as MODIFIED with all eleven scenarios, and give each new requirement a new scenario. Rejected by the user: each rule would be tested in two places.

### Keep the three requirements where the old one was

The archive's sync appends ADDED requirements at the end of a spec by default. Here, the sync places "Permission host format", "Wildcard hosts outside open" and "Any site in open", in that order, where "Permission hosts are origins" was: after "Permission declarations" and before "Mod file is plain YAML". The spec keeps the permission rules together, and nothing else moves.

### Verification

The scenarios are moved, not rewritten. A script compares the set of scenario blocks before and after, at proposal time on the delta and at archive time on the main spec. The tests that cover these scenarios (`src/lib/mod/mod_permissions.test.ts`) are grouped by function, not by requirement, so they keep passing unchanged and need no rename.

## Risks / Trade-offs

- [Archived changes name "Permission hosts are origins", which no longer exists after the archive] → Archived changes record the specs as they were, as they already do for older wording. No test, doc or code names the requirement.
- [A sync that appends the requirements at the end of the spec] → The workflow follow-up of tasks.md says where they go and how to check their order and `openspec validate --specs --strict` after the archive.
