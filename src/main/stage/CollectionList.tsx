import type { ReactElement } from "react";
import type { ResolvedDefaultModSettings } from "../../lib/core/engine/index.ts";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import {
  buildCollectionListRows,
  startCollectionListLoads,
} from "./collection_list.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import { buildViewerOpen } from "./detail_viewers.ts";
import type { ListDetail } from "./ListDetails.tsx";
import { useListInputs } from "./use_list_inputs.ts";

/**
 * The tile's resolved address for a tile link, opening in the tile viewer,
 * otherwise the collection's, opening in the collection viewer, or "None".
 */
function buildCollectionDetails(
  sandbox: SandboxSnapshot,
  defaults: ResolvedDefaultModSettings,
): ListDetail[] {
  if (sandbox.tile !== null) {
    const tileDetails: ListDetail[] = [
      {
        term: "Tile",
        value: sandbox.tile,
        open: buildViewerOpen("tile", sandbox.tile, defaults),
      },
    ];
    return tileDetails;
  }
  if (sandbox.collection === null) {
    const noneDetails: ListDetail[] = [
      { term: "Collection", value: "None", open: null },
    ];
    return noneDetails;
  }
  const details: ListDetail[] = [
    {
      term: "Collection",
      value: sandbox.collection,
      open: buildViewerOpen("collection", sandbox.collection, defaults),
    },
  ];
  return details;
}

/**
 * The collection capsule's list (`buildCollectionListRows`): "None", or the
 * tile and "None", pinned, then the catalog's collections, the recently used
 * ones and the current one, each scored for the current mod. A collection
 * with mosaics of the current mod opens its page. Opening the list starts
 * its loads (`startCollectionListLoads`).
 */
export function CollectionList(props: CapsuleListProps): ReactElement {
  const inputs = useListInputs(props, startCollectionListLoads);
  return (
    <CombinationList
      kind="collection"
      label="Collection list"
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      anchorRef={props.anchorRef}
      rows={buildCollectionListRows(inputs)}
      pairHeading=""
      listChoices={props.listChoices}
      details={buildCollectionDetails(props.sandbox, props.stage.defaults)}
    >
      {props.children}
    </CombinationList>
  );
}
