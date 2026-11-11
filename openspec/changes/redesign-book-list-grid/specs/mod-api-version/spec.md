# Spec Delta

## MODIFIED Requirements

### Requirement: Sample and default mods declare the API range
The sample mod SHALL declare `api: "^0.1.5"`, the first mod API version with the `<ot-tile-body>` element, and every default mod SHALL declare `api: "^0.1.0"`.

#### Scenario: Shipped mods match
- **WHEN** the sample book list mod, the mod explorer and the mod viewer are each opened
- **THEN** none of them shows the dialog or has an issue about its API
