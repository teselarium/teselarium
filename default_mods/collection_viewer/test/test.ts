/**
 * Tests of the collection viewer, which `mods.check` runs after mounting it.
 * Each case mounts the viewer with a fixture collection of `fixtures/` as its
 * target, so the cases pass whatever samples the app ships
 * (default_mods/README.md). The label and filter cases call the viewer's pure
 * modules directly.
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  addsParentForSharedFileNames,
  decodesFileNames,
  filtersIgnoringCase,
  keepsEveryIndexForAnEmptyFilter,
  keepsLabelsThatStillClash,
  keepsUndecodableFileNames,
  labelsByFileName,
} from "./label_cases.ts";
import {
  drawsCardBackground,
  drawsIssueBadges,
  drawsTilesInCard,
  keepsFilterNarrow,
  keepsOwnStylesToLayout,
} from "./look_cases.ts";
import { opensSelectedTile, showsRefusedOpen } from "./open_cases.ts";
import {
  clearsFilter,
  filtersTiles,
  labelsEncodedFileName,
  labelsFilterField,
  labelsSharedFileNames,
  saysEmptyTarget,
  saysNoTarget,
  showsEntryIssues,
  showsMissingTargetError,
  showsNoIssueListWithoutIssues,
  showsTargetCollection,
  showsTargetFormatError,
  showsTileAddresses,
} from "./viewer_cases.ts";

export default function registerViewerTests(t: ModTestRegistration): void {
  t.test("labels tiles by file name", labelsByFileName);
  t.test("decodes file names", decodesFileNames);
  t.test("keeps a file name that cannot be decoded", keepsUndecodableFileNames);
  t.test(
    "adds the parent folder to shared file names",
    addsParentForSharedFileNames,
  );
  t.test("keeps labels that still clash", keepsLabelsThatStillClash);
  t.test("filters labels ignoring letter case", filtersIgnoringCase);
  t.test(
    "keeps every tile for an empty filter",
    keepsEveryIndexForAnEmptyFilter,
  );
  t.test("shows the collection of its target", showsTargetCollection);
  t.test("shows each tile's address", showsTileAddresses);
  t.test("labels tiles that share a file name", labelsSharedFileNames);
  t.test("labels an encoded file name decoded", labelsEncodedFileName);
  t.test("shows the entry issues", showsEntryIssues);
  t.test("shows no issue list without issues", showsNoIssueListWithoutIssues);
  t.test("labels its filter field", labelsFilterField);
  t.test("filters the tiles and says how many are shown", filtersTiles);
  t.test("shows every tile once the filter is empty", clearsFilter);
  t.test("opens the selected tile in the tile viewer", opensSelectedTile);
  t.test("shows a refused open", showsRefusedOpen);
  t.test("says no collection was given without a target", saysNoTarget);
  t.test("says no collection was given for an empty target", saysEmptyTarget);
  t.test(
    "shows why a missing target cannot be inspected",
    showsMissingTargetError,
  );
  t.test("shows the format error of its target", showsTargetFormatError);
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
  t.test("draws the collection on the card background", drawsCardBackground);
  t.test("draws issue levels as badges", drawsIssueBadges);
  t.test(
    "draws the tiles in a card, with the count under the filter",
    drawsTilesInCard,
  );
  t.test("keeps the filter field to a readable width", keepsFilterNarrow);
}
