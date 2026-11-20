import type { ReactElement } from "react";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import {
  buildCollectionListRows,
  startCollectionListLoads,
} from "./collection_list.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { ListDetail } from "./CombinationList.tsx";
import { buildExplorerLink } from "./combination_list_inputs.ts";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import { useListInputs } from "./use_list_inputs.ts";

function buildCollectionDetails(sandbox: SandboxSnapshot): ListDetail[] {
  const link = sandbox.link;
  if (link.tile !== null) {
    const tileDetails: ListDetail[] = [{ term: "Tile", value: link.tile }];
    return tileDetails;
  }
  const details: ListDetail[] = [
    { term: "Collection", value: link.collection ?? "None" },
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
      details={buildCollectionDetails(props.sandbox)}
      explorer={buildExplorerLink(
        props.stage,
        "tiles",
        "Open the collection explorer",
      )}
    >
      {props.children}
    </CombinationList>
  );
}
