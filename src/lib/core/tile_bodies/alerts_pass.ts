import type { Blockquote, Paragraph, Parent, RootContent } from "mdast";

/** The alert kinds of GitHub, in lower case, with the title each one shows. */
const ALERT_TITLES = new Map([
  ["note", "Note"],
  ["tip", "Tip"],
  ["important", "Important"],
  ["warning", "Warning"],
  ["caution", "Caution"],
]);

export const ALERT_KINDS = [...ALERT_TITLES.keys()];

/** A first line that is only `[!KIND]`, with the line break that ends it. */
const ALERT_MARKER = /^\[!([A-Za-z]+)\][ \t]*(\n|$)/;

/** A quote's alert kind and the length of its marker line, as read from its first paragraph. */
interface AlertMarker {
  kind: string;
  length: number;
  paragraph: Paragraph;
}

function readAlertMarker(blockquote: Blockquote): AlertMarker | null {
  const firstBlock = blockquote.children[0];
  if (firstBlock?.type !== "paragraph") {
    return null;
  }
  const firstText = firstBlock.children[0];
  if (firstText?.type !== "text") {
    return null;
  }
  const match = ALERT_MARKER.exec(firstText.value);
  if (match === null) {
    return null;
  }
  const isLineEnd = match[2] === "\n" || firstBlock.children.length === 1;
  const kind = match[1].toLowerCase();
  if (!isLineEnd || !ALERT_TITLES.has(kind)) {
    return null;
  }
  const marker: AlertMarker = {
    kind,
    length: match[0].length,
    paragraph: firstBlock,
  };
  return marker;
}

/** The first paragraph without its marker line, or `null` when nothing else was in it. */
function dropMarkerLine(
  paragraph: Paragraph,
  length: number,
): Paragraph | null {
  const [firstText, ...otherChildren] = paragraph.children;
  if (firstText.type !== "text") {
    return paragraph;
  }
  const restText = firstText.value.slice(length);
  const children =
    restText === ""
      ? otherChildren
      : [{ ...firstText, value: restText }, ...otherChildren];
  if (children.length === 0) {
    return null;
  }
  const strippedParagraph: Paragraph = { ...paragraph, children };
  return strippedParagraph;
}

function buildAlertTitle(kind: string): Paragraph {
  const title: Paragraph = {
    type: "paragraph",
    data: { hProperties: { className: ["ot-alert-title"] } },
    children: [{ type: "text", value: ALERT_TITLES.get(kind) ?? kind }],
  };
  return title;
}

function turnIntoAlert(blockquote: Blockquote, marker: AlertMarker): void {
  const otherBlocks = blockquote.children.slice(1);
  const firstParagraph = dropMarkerLine(marker.paragraph, marker.length);
  const keptBlocks = firstParagraph === null ? [] : [firstParagraph];
  blockquote.children = [
    buildAlertTitle(marker.kind),
    ...keptBlocks,
    ...otherBlocks,
  ];
  blockquote.data = {
    hName: "aside",
    hProperties: { className: ["ot-alert"], dataOtAlert: marker.kind },
  };
}

function isParent(node: RootContent): node is RootContent & Parent {
  const hasChildren = "children" in node;
  return hasChildren;
}

/**
 * The alerts pass: a blockquote whose first line is only `[!NOTE]`, `[!TIP]`,
 * `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`, in any case, becomes an
 * `aside.ot-alert` with `data-ot-alert` and a title paragraph, without the
 * marker line. Changes the tree in place.
 */
export function applyAlerts(tree: Parent): void {
  for (const child of tree.children) {
    if (child.type === "blockquote") {
      applyBlockquoteAlert(child);
    }
    if (isParent(child)) {
      applyAlerts(child);
    }
  }
}

function applyBlockquoteAlert(blockquote: Blockquote): void {
  const marker = readAlertMarker(blockquote);
  if (marker !== null) {
    turnIntoAlert(blockquote, marker);
  }
}
