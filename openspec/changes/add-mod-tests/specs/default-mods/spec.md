## MODIFIED Requirements

### Requirement: Mod viewer shows the check report
The mod viewer SHALL show the report's status as a badge, with `data-ot-variant` `success` for `"pass"`, `warning` for `"warn"` and `destructive` for `"fail"`, each test case with its status and message, and each finding with its step, level, source and message. When the request fails, it SHALL show the error message as an alert. The mod viewer SHALL stay the visible mod.

#### Scenario: Sample mod passes
- **WHEN** the viewer shows the sample book list mod and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check passed, with a `success` badge and no findings
- **AND** it lists the cases `lists the sample books` and `highlights the remembered book`, both passed
- **AND** the mod viewer is still the visible mod

#### Scenario: Failing mod
- **WHEN** the viewer shows a mod whose entrypoint answers HTTP 404 and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check failed, with a `destructive` badge and a bundle error that names the entrypoint's address and `404`

#### Scenario: Failing case
- **WHEN** the viewer checks a mod whose case `lists books` fails with `no books`
- **THEN** the viewer's frame shows a `destructive` badge and lists `lists books` as failed with the message `no books`
