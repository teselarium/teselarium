import type { ReactElement } from "react";
import type { ResolvedDefaultModSettings } from "../../lib/core/engine/index.ts";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import { buildViewerOpen } from "./detail_viewers.ts";
import type { DetailOpen } from "./detail_viewers.ts";
import type { ListDetail } from "./ListDetails.tsx";
import {
  buildMosaicListRows,
  buildPairHeading,
  startMosaicListLoads,
  UNSAVED_COMBINATION_TITLE,
} from "./mosaic_list.ts";
import { buildRunLinkAddress } from "./run_link_copy.ts";
import { useListInputs } from "./use_list_inputs.ts";

/** The mosaic file's address, opening in the mosaic viewer, or "Unsaved combination". */
function buildMosaicDetail(
  sandbox: SandboxSnapshot,
  defaults: ResolvedDefaultModSettings,
): ListDetail {
  const address = sandbox.mosaic?.source ?? sandbox.mosaicReference;
  if (address === null) {
    const unsaved: ListDetail = {
      term: "Mosaic",
      value: UNSAVED_COMBINATION_TITLE,
      open: null,
    };
    return unsaved;
  }
  const mosaic: ListDetail = {
    term: "Mosaic",
    value: address,
    open: buildViewerOpen("mosaic", address, defaults),
  };
  return mosaic;
}

/** The mosaic, then the run link as the app's full address, which opens itself. */
function buildMosaicListDetails(
  sandbox: SandboxSnapshot,
  defaults: ResolvedDefaultModSettings,
): ListDetail[] {
  const runLink = buildRunLinkAddress(sandbox.hash);
  const runLinkOpen: DetailOpen = { address: runLink, place: "a new tab" };
  const details: ListDetail[] = [
    buildMosaicDetail(sandbox, defaults),
    { term: "Run link", value: runLink, open: runLinkOpen },
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
      details={buildMosaicListDetails(props.sandbox, props.stage.defaults)}
    >
      {props.children}
    </CombinationList>
  );
}
