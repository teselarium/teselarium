/**
 * Tests of the tile viewer, which `mods.check` runs after mounting it. The
 * check's tiles are the viewer's sample collection, `fixtures/`, whose
 * bodies `tiles.renderBody` renders, and the cases name it as `from`, so the
 * cases pass whatever samples the app ships (default_mods/README.md). The
 * tiles a case builds itself have no body. The heading and address cases
 * call the viewer's pure modules directly.
 */

import type { ModTestRegistration } from "../../mod_api.d.ts";
import {
  collapsesLongMetadata,
  cutsALongFirstList as cutsALongFirstListInView,
  drawsTheButtonAsAButton,
  drawsTwoLineThumbnails,
  keepsShortMetadataWhole as keepsShortMetadataInView,
  showsAllFields,
} from "./collapse_cases.ts";
import {
  countsValueLines,
  cutsALongFirstList,
  cutsTheListThatDoesNotFit,
  hidesAListWithNoRoomForAnItem,
  hidesFieldsAfterTheFirstThatDoesNotFit,
  keepsShortMetadataWhole,
  keepsSixLinesWhole,
  showsALargeFirstMappingWhole,
} from "./lines_cases.ts";
import {
  leavesOtherLinksToTheApp,
  opensLinkedTileWithFrom,
  opensLinkedTileWithoutAnyFrom,
  opensMetadataTileLink,
  opensOutsideTileWithoutFrom,
} from "./link_cases.ts";
import { drawsTheTileAsACard, keepsOwnStylesToLayout } from "./look_cases.ts";
import {
  disablesNextOnLast,
  disablesPreviousOnFirst,
  opensTheCollection,
  replacesWithNext,
  replacesWithPrevious,
  showsNoPlaceOutsideFrom,
  showsPlaceInCollection,
  showsRefusedOpen,
  warnsUnreadFrom,
} from "./place_cases.ts";
import {
  headsWithDecodedFileName,
  headsWithFileName as headsPureWithFileName,
  headsWithFileNameForOtherTitles,
  headsWithTitle,
  tellsImageAddresses,
  tellsTileAddresses,
  tellsWebAddresses,
} from "./pure_cases.ts";
import {
  headsWithFileName,
  hidesFailedThumbnail,
  laysValuesBesideTheirKeys,
  putsTheBodyInTheCard,
  linksWebAddresses,
  rendersNoEmptyBody,
  saysNoMetadata,
  saysNoTile,
  showsImageThumbnails,
  showsNestedMetadata,
  showsTheTile,
} from "./viewer_cases.ts";

export default function registerViewerTests(t: ModTestRegistration): void {
  t.test("heads a tile with its title", headsWithTitle);
  t.test(
    "heads a tile without a title with its file name",
    headsPureWithFileName,
  );
  t.test(
    "heads with the file name when the title is empty or not text",
    headsWithFileNameForOtherTitles,
  );
  t.test("heads with the decoded file name", headsWithDecodedFileName);
  t.test("tells web addresses", tellsWebAddresses);
  t.test("tells image addresses by their path", tellsImageAddresses);
  t.test("tells tile addresses by their path", tellsTileAddresses);
  t.test("counts the lines of each value", countsValueLines);
  t.test("keeps short metadata whole", keepsShortMetadataWhole);
  t.test("keeps metadata of six lines whole", keepsSixLinesWhole);
  t.test("cuts the list that does not fit", cutsTheListThatDoesNotFit);
  t.test(
    "hides the fields after the first that does not fit",
    hidesFieldsAfterTheFirstThatDoesNotFit,
  );
  t.test(
    "hides a list with no room for an item",
    hidesAListWithNoRoomForAnItem,
  );
  t.test("cuts a long first list", cutsALongFirstList);
  t.test("shows a large first mapping whole", showsALargeFirstMappingWhole);
  t.test("shows the tile's heading, source and body", showsTheTile);
  t.test("puts the body in the card, after a separator", putsTheBodyInTheCard);
  t.test(
    "heads a fixture without a title with its file name",
    headsWithFileName,
  );
  t.test("shows nested metadata in frontmatter order", showsNestedMetadata);
  t.test(
    "lays a value beside its key and list items one per line",
    laysValuesBesideTheirKeys,
  );
  t.test("links the web addresses of the metadata", linksWebAddresses);
  t.test("shows a thumbnail for an image address", showsImageThumbnails);
  t.test("draws thumbnails two lines high", drawsTwoLineThumbnails);
  t.test("starts long metadata collapsed", collapsesLongMetadata);
  t.test("shows all the fields, then fewer again", showsAllFields);
  t.test(
    "draws the metadata button as a button no taller than its heading",
    drawsTheButtonAsAButton,
  );
  t.test("shows short metadata without a button", keepsShortMetadataInView);
  t.test("cuts a long first list in the view", cutsALongFirstListInView);
  t.test("hides a thumbnail that fails to load", hidesFailedThumbnail);
  t.test("says that a file has no metadata", saysNoMetadata);
  t.test("renders no empty body", rendersNoEmptyBody);
  t.test("says no tile was given without tiles", saysNoTile);
  t.test("shows the tile's place in its collection", showsPlaceInCollection);
  t.test("disables Previous on the first tile", disablesPreviousOnFirst);
  t.test("disables Next on the last tile", disablesNextOnLast);
  t.test("replaces itself with the next tile", replacesWithNext);
  t.test("replaces itself with the previous tile", replacesWithPrevious);
  t.test("opens the collection from its name", opensTheCollection);
  t.test("shows a refused open", showsRefusedOpen);
  t.test("shows no place for a tile not in from", showsNoPlaceOutsideFrom);
  t.test("warns about a from it cannot read", warnsUnreadFrom);
  t.test("opens a linked tile of from with from", opensLinkedTileWithFrom);
  t.test(
    "opens a linked tile outside from without from",
    opensOutsideTileWithoutFrom,
  );
  t.test(
    "opens a linked tile without from when it has none",
    opensLinkedTileWithoutAnyFrom,
  );
  t.test("opens a tile linked by the metadata", opensMetadataTileLink);
  t.test("leaves the other links to the app", leavesOtherLinksToTheApp);
  t.test("keeps its own styles to layout", keepsOwnStylesToLayout);
  t.test("draws the tile as a card, with Next primary", drawsTheTileAsACard);
}
