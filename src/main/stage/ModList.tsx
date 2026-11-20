import type { ReactElement } from "react";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { ListDetail } from "./CombinationList.tsx";
import { buildExplorerLink } from "./combination_list_inputs.ts";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import { buildModListRows, startModListLoads } from "./mod_list.ts";
import { useListInputs } from "./use_list_inputs.ts";

function buildModDetails(sandbox: SandboxSnapshot): ListDetail[] {
  const details: ListDetail[] = [
    { term: "Mod", value: sandbox.mod?.source ?? sandbox.link.mod },
  ];
  if (sandbox.mod !== null) {
    details.push({ term: "Version", value: sandbox.mod.version });
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
      details={buildModDetails(props.sandbox)}
      explorer={buildExplorerLink(props.stage, "mods", "Open the mod explorer")}
    >
      {props.children}
    </CombinationList>
  );
}
