import { describePermissionLine } from "../permissions/index.ts";
import type { SiteDecision } from "../permissions/index.ts";

function describeCount(
  count: number,
  singular: string,
  plural: string,
): string {
  const noun = count === 1 ? singular : plural;
  const description = `${count} ${noun}`;
  return description;
}

/** The text of the notification of a mod started with a collection. */
export function describeLoadedCollection(tileCount: number): string {
  const tiles = describeCount(tileCount, "tile", "tiles");
  const text = `Loaded the collection: the mod received ${tiles}.`;
  return text;
}

/** The text of the notification of "Reload tiles" after the collection loaded again. */
export function describeReloadedTiles(
  tileCount: number,
  issueCount: number,
): string {
  const tiles = describeCount(tileCount, "tile", "tiles");
  const issues = describeCount(
    issueCount,
    "collection issue",
    "collection issues",
  );
  const text = `Reloaded the tiles: the mod received ${tiles}, with ${issues}.`;
  return text;
}

function describeDecisionLines(
  decisions: readonly SiteDecision[],
  allowed: boolean,
): string[] {
  const lines: string[] = [];
  for (const decision of decisions) {
    if (decision.allowed === allowed) {
      lines.push(describePermissionLine(decision));
    }
  }
  return lines;
}

/**
 * The text of the notification of a site consent answer: each site allowed,
 * then each site refused, with its category, and whether the answer is remembered.
 */
export function describeSiteConsentAnswer(
  decisions: readonly SiteDecision[],
  isRemembered: boolean,
): string {
  const sentences: string[] = [];
  const allowedLines = describeDecisionLines(decisions, true);
  if (allowedLines.length > 0) {
    sentences.push(`Allowed the mod to ${allowedLines.join(", ")}.`);
  }
  const refusedLines = describeDecisionLines(decisions, false);
  if (refusedLines.length > 0) {
    sentences.push(`Refused to let the mod ${refusedLines.join(", ")}.`);
  }
  sentences.push(
    isRemembered
      ? "The answer is remembered."
      : "The answer is not remembered.",
  );
  const text = sentences.join(" ");
  return text;
}
