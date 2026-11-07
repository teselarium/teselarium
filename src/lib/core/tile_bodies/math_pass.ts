import type { Element, ElementContent, Root } from "hast";
import temml from "temml";

/** The class of the code of inline math, from `remark-math`. */
const INLINE_MATH_CLASS = "math-inline";

/** The class of the code of display math and of fenced `math` blocks. */
const MATH_CODE_CLASS = "language-math";

/**
 * What a formula may ask Temml for: no command that links or styles, sizes up
 * to 20em, and at most 1000 macro expansions, which stops a self-recursive
 * macro.
 */
const MATH_OPTIONS = {
  annotate: true,
  throwOnError: true,
  trust: false,
  maxSize: [20, 20] as [number, number],
  maxExpand: 1000,
};

function readClassNames(element: Element): string[] {
  const className = element.properties.className;
  if (!Array.isArray(className)) {
    return [];
  }
  const classNames: string[] = [];
  for (const name of className) {
    classNames.push(String(name));
  }
  return classNames;
}

function hasClassName(element: Element, name: string): boolean {
  const hasName = readClassNames(element).includes(name);
  return hasName;
}

/** The code element of a `<pre>` that holds display math, or `null`. */
function findDisplayMathCode(pre: Element): Element | null {
  const code = pre.children[0];
  if (code?.type !== "element" || code.tagName !== "code") {
    return null;
  }
  if (!hasClassName(code, MATH_CODE_CLASS)) {
    return null;
  }
  return code;
}

/** The formula of a math code element, without the line break that ends a block's code. */
function readFormula(code: Element): string {
  let formula = "";
  for (const child of code.children) {
    if (child.type === "text") {
      formula += child.value;
    }
  }
  const trimmedFormula = formula.replace(/\n$/, "");
  return trimmedFormula;
}

function describeMathError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmedMessage = message.trim();
  return trimmedMessage;
}

/**
 * The MathML of a formula as a raw node, which `rehype-raw` parses with the
 * body's HTML, or `null` when Temml cannot render it. The code element then
 * gets `data-ot-math-error` with the reason, and stays as it was.
 */
function renderFormula(
  code: Element,
  displayMode: boolean,
): ElementContent | null {
  try {
    const mathMl = temml.renderToString(readFormula(code), {
      ...MATH_OPTIONS,
      displayMode,
    });
    const rawNode: ElementContent = { type: "raw", value: mathMl };
    return rawNode;
  } catch (error) {
    code.properties.dataOtMathError = describeMathError(error);
    return null;
  }
}

/** The MathML of a math element, or the element itself when it is no math or its formula fails. */
function replaceMathElement(element: Element): ElementContent {
  if (element.tagName === "pre") {
    const code = findDisplayMathCode(element);
    const mathMl = code === null ? null : renderFormula(code, true);
    return mathMl ?? element;
  }
  if (element.tagName === "code" && hasClassName(element, INLINE_MATH_CLASS)) {
    const mathMl = renderFormula(element, false);
    return mathMl ?? element;
  }
  renderMathIn(element);
  return element;
}

function renderMathIn(parent: Root | Element): void {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    if (child.type === "element") {
      parent.children[index] = replaceMathElement(child);
    }
  }
}

/**
 * The math pass, after `remark-rehype` and before `rehype-raw`: each
 * `code.math-inline`, and each `<pre>` holding `code.language-math` (display
 * math and fenced `math` blocks), becomes Temml's MathML, with the formula in
 * an `<annotation encoding="application/x-tex">`. A formula Temml cannot
 * render stays as written, with `data-ot-math-error` on its code. The
 * MathML is sanitized afterwards with the rest of the body. Changes the tree
 * in place.
 */
export function renderMath(tree: Root): void {
  renderMathIn(tree);
}
