## MODIFIED Requirements

### Requirement: Check report
The report SHALL be plain data with `source` (the resolved mod file address), `status`, `mountChecked` (whether the mount check ran), `testsChecked` and `tests` (the mod's test results) and `findings`, a list of `{ step, level, source, message }` in the order they were found, where `step` is `"bundle"`, `"mount"` or `"test"` and `level` is `"error"` or `"warning"`. `status` SHALL be `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none.

#### Scenario: Warnings only
- **WHEN** a mod without `api` and with a valid bundle that mounts is checked
- **THEN** the report's status is `"warn"` and its only finding is a `bundle` warning about the missing `api` range

#### Scenario: Mod without tests
- **WHEN** a mod without `test_path`, with a valid bundle that mounts, is checked
- **THEN** the report has `testsChecked` `false`, an empty `tests` list and no `test` finding

#### Scenario: Failed case
- **WHEN** a mod whose test case `lists books` throws is checked
- **THEN** the report's status is `"fail"`, its tests list `lists books` with status `"fail"`, and it has a `test` error whose message names `lists books`

#### Scenario: Plain data
- **WHEN** the sample mod is checked and a structured clone of the report is made
- **THEN** the clone deep-equals the report
