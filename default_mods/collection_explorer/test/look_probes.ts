// Reads the explorer's look in the case's frame, where the theme's base
// stylesheet is in the `opentesela` layer and the mod's own CSS is not.

/** The look properties: colors, backgrounds, borders, radii, fonts and shadows. */
const LOOK_PROPERTY_PATTERN = /^(background|border|font)|color$|shadow$/;

/** The theme's cascade layer in the frame. */
const THEME_LAYER_NAME = "opentesela";

function listStyleSheetRules(): CSSRule[] {
  const rules: CSSRule[] = [];
  for (const sheet of document.styleSheets) {
    rules.push(...sheet.cssRules);
  }
  return rules;
}

function listLookDeclarations(rule: CSSStyleRule): string[] {
  const declarations: string[] = [];
  for (const property of rule.style) {
    if (LOOK_PROPERTY_PATTERN.test(property)) {
      declarations.push(`${rule.selectorText} { ${property} }`);
    }
  }
  return declarations;
}

function isThemeLayer(rule: CSSRule): boolean {
  const isLayer =
    rule instanceof CSSLayerBlockRule && rule.name === THEME_LAYER_NAME;
  return isLayer;
}

/**
 * Every declaration outside the theme's layer that sets a look property, as
 * `selector { property }`. Empty when the mod's own styles are layout only.
 */
export function listOwnLookDeclarations(): string[] {
  const found: string[] = [];
  const rules = listStyleSheetRules();
  while (rules.length > 0) {
    const rule = rules.shift() as CSSRule;
    if (isThemeLayer(rule)) {
      continue;
    }
    if (rule instanceof CSSGroupingRule) {
      rules.push(...rule.cssRules);
    }
    if (rule instanceof CSSStyleRule) {
      found.push(...listLookDeclarations(rule));
    }
  }
  return found;
}

/** What `property: var(token)` computes to in the frame, read on a temporary element. */
export function readTokenAs(token: string, property: string): string {
  const probe = document.createElement("div");
  probe.style.setProperty(property, `var(${token})`);
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}
