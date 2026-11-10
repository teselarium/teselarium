import type { ReactElement } from "react";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";

interface ModInfoPopoverProps {
  sandbox: SandboxSnapshot;
}

function renderDetail(term: string, value: string): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="[overflow-wrap:anywhere]">
        <code className="text-xs">{value}</code>
      </dd>
    </div>
  );
}

/**
 * The content of the information popover: the mod's source, or the resolved
 * mod reference before the mod file loaded, the collection's location when
 * the sandbox has one, and the run link, as text the user can select. The
 * Share menu copies the link.
 */
export function ModInfoPopover({ sandbox }: ModInfoPopoverProps): ReactElement {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="font-medium">{sandbox.mod?.title ?? "Mod"}</h2>
      <dl className="flex flex-col gap-2">
        {renderDetail("Mod", sandbox.mod?.source ?? sandbox.modReference)}
        {sandbox.collection === null
          ? null
          : renderDetail("Collection", sandbox.collection)}
        {renderDetail("Run link", sandbox.hash)}
      </dl>
    </div>
  );
}
