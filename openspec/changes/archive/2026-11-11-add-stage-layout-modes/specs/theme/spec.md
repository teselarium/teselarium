# Spec Delta

## MODIFIED Requirements

### Requirement: Theme tokens
The system SHALL define a fixed set of theme tokens. Each token SHALL be a CSS custom property whose name starts with `--ot-`, with one value for the light color scheme and one for the dark color scheme. The color tokens SHALL be the role colors listed below, and each SHALL have different light and dark values. Tokens that are not colors SHALL have the same value in both color schemes.

#### Scenario: Token names
- **WHEN** the tokens are listed
- **THEN** their names are exactly `--ot-background`, `--ot-foreground`, `--ot-card`, `--ot-card-foreground`, `--ot-popover`, `--ot-popover-foreground`, `--ot-primary`, `--ot-primary-foreground`, `--ot-secondary`, `--ot-secondary-foreground`, `--ot-muted`, `--ot-muted-foreground`, `--ot-accent`, `--ot-accent-foreground`, `--ot-highlight`, `--ot-highlight-foreground`, `--ot-destructive`, `--ot-destructive-foreground`, `--ot-warning`, `--ot-success`, `--ot-border`, `--ot-input`, `--ot-ring`, `--ot-font-sans`, `--ot-font-mono`, `--ot-font-size`, `--ot-line-height`, `--ot-space-1`, `--ot-space-2`, `--ot-space-3`, `--ot-space-4`, `--ot-space-6`, `--ot-radius`, `--ot-shadow`, `--ot-content-width` and `--ot-reading-width`

#### Scenario: Color tokens differ between color schemes
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** each of the twenty-three tokens from `--ot-background` to `--ot-ring` in the list above has a different value in each, and every other token has the same value in both

#### Scenario: Old token names are gone
- **WHEN** the tokens are resolved for the light color scheme
- **THEN** no token name starts with `--ot-color-`, and there is no `--ot-font-body`

#### Scenario: Resolved tokens are plain data
- **WHEN** the tokens are resolved for the dark color scheme
- **THEN** the result is a mapping from each token name to a string, and a structured clone of it deep-equals it
