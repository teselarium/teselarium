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

/** The mosaic file's address of a mosaic link: its source once loaded, else the resolved reference. */
function renderMosaicDetail(sandbox: SandboxSnapshot): ReactElement | null {
  if (sandbox.mosaicReference === null) {
    return null;
  }
  return renderDetail(
    "Mosaic",
    sandbox.mosaic?.source ?? sandbox.mosaicReference,
  );
}

/** The mod's source, or the resolved mod reference, unknown for a mosaic link until its file loads. */
function renderModDetail(sandbox: SandboxSnapshot): ReactElement | null {
  const modAddress = sandbox.mod?.source ?? sandbox.modReference;
  if (modAddress === "") {
    return null;
  }
  return renderDetail("Mod", modAddress);
}

/**
 * The content of the information popover: for a mosaic link, the mosaic
 * file's address first, then the mod's source, or the resolved mod reference
 * before the mod file loaded, the collection's location when the sandbox has
 * one, and the run link, as text the user can select. The Share menu copies
 * the link.
 */
export function ModInfoPopover({ sandbox }: ModInfoPopoverProps): ReactElement {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="font-medium">
        {sandbox.mosaic?.title ?? sandbox.mod?.title ?? "Mod"}
      </h2>
      <dl className="flex flex-col gap-2">
        {renderMosaicDetail(sandbox)}
        {renderModDetail(sandbox)}
        {sandbox.collection === null
          ? null
          : renderDetail("Collection", sandbox.collection)}
        {renderDetail("Run link", sandbox.hash)}
      </dl>
    </div>
  );
}
