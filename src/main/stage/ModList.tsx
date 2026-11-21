import type { ReactElement } from "react";
import type { ResolvedDefaultModSettings } from "../../lib/core/engine/index.ts";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import { buildViewerOpen } from "./detail_viewers.ts";
import type { ListDetail } from "./ListDetails.tsx";
import { buildModListRows, startModListLoads } from "./mod_list.ts";
import { useListInputs } from "./use_list_inputs.ts";

/**
 * The mod's address, once known: its mod file once loaded, the resolved
 * reference before, and nothing while a mosaic link's mod is still unknown.
 * The address opens in the mod viewer. Then its version, once its file is
 * loaded.
 */
function buildModDetails(
  sandbox: SandboxSnapshot,
  defaults: ResolvedDefaultModSettings,
): ListDetail[] {
  const details: ListDetail[] = [];
  const address = sandbox.mod?.source ?? sandbox.modReference;
  if (address !== "") {
    details.push({
      term: "Mod",
      value: address,
      open: buildViewerOpen("mod", address, defaults),
    });
  }
  if (sandbox.mod !== null) {
    details.push({ term: "Version", value: sandbox.mod.version, open: null });
  }
  return details;
}

/**
 * The mod capsule's list (`buildModListRows`): the catalog's mods, the
 * recently used ones and the current one, each scored on the sandbox's
 * collection or tile. A mod with mosaics on that collection opens its page.
 * Opening the list starts its loads (`startModListLoads`).
 */
export function ModList(props: CapsuleListProps): ReactElement {
  const inputs = useListInputs(props, startModListLoads);
  return (
    <CombinationList
      kind="mod"
      label="Mod list"
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      anchorRef={props.anchorRef}
      rows={buildModListRows(inputs)}
      pairHeading=""
      listChoices={props.listChoices}
      details={buildModDetails(props.sandbox, props.stage.defaults)}
    >
      {props.children}
    </CombinationList>
  );
}
