import type { ReactElement } from "react";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { ListDetail } from "./CombinationList.tsx";
import { buildExplorerLink } from "./combination_list_inputs.ts";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import {
  buildMosaicListRows,
  buildPairHeading,
  startMosaicListLoads,
  UNSAVED_COMBINATION_TITLE,
} from "./mosaic_list.ts";
import { useListInputs } from "./use_list_inputs.ts";

function buildMosaicListDetails(sandbox: SandboxSnapshot): ListDetail[] {
  const details: ListDetail[] = [
    {
      term: "Mosaic",
      value:
        sandbox.mosaic?.source ??
        sandbox.mosaicReference ??
        UNSAVED_COMBINATION_TITLE,
    },
    { term: "Run link", value: sandbox.hash },
  ];
  return details;
}

/**
 * The mosaic capsule's list (`buildMosaicListRows`): the sandbox's own
 * unsaved pair pinned, then the mosaics and the tried combinations, by
 * default under "For <mod> + <collection>" and "Other combinations". Opening
 * the list starts its loads (`startMosaicListLoads`).
 */
export function MosaicList(props: CapsuleListProps): ReactElement {
  const inputs = useListInputs(props, startMosaicListLoads);
  return (
    <CombinationList
      kind="mosaic"
      label="Mosaic list"
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      anchorRef={props.anchorRef}
      rows={buildMosaicListRows(inputs)}
      pairHeading={buildPairHeading(props.sandbox)}
      listChoices={props.listChoices}
      details={buildMosaicListDetails(props.sandbox)}
      explorer={buildExplorerLink(
        props.stage,
        "mosaics",
        "Open the mosaic explorer",
      )}
    >
      {props.children}
    </CombinationList>
  );
}
