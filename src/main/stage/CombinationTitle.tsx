import { useRef } from "react";
import type { ReactElement, RefObject } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/vendor/shadcn/ui/dropdown-menu.tsx";
import {
  COLLECTION_ICON as CollectionIcon,
  MOD_ICON as ModIcon,
  MOSAIC_ICON as MosaicIcon,
} from "../catalog_icons.ts";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";
import {
  isMosaicPending,
  isSandboxLoading,
  readCollectionCapsuleTitle,
  readModCapsuleTitle,
  readMosaicCapsuleTitle,
} from "./capsule_titles.ts";
import { readRecentlyUsedSnapshot } from "../settings/recently_used.ts";
import { startCollectionListLoads } from "./collection_list.ts";
import { CollectionList } from "./CollectionList.tsx";
import { CombinationCapsule } from "./CombinationCapsule.tsx";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import { isFocusInFrame } from "./frame_focus.ts";
import type { ListChoices } from "./list_choices.ts";
import { startModListLoads } from "./mod_list.ts";
import { ModList } from "./ModList.tsx";
import { startMosaicListLoads } from "./mosaic_list.ts";
import { MosaicList } from "./MosaicList.tsx";
import type { ListLoads } from "./use_list_inputs.ts";
import type { CapsulePanel, StageBarPanel } from "./stage_bar_panels.ts";

interface CombinationTitleProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
  combinations: CombinationCatalog;
  recentlyUsed: RecentlyUsed;
  listChoices: ListChoices;
  /** The bar's open panel, or `null`. */
  openPanel: StageBarPanel | null;
  onPanelOpenChange: (panel: CapsulePanel, isOpen: boolean) => void;
  /** The bar's left side, which the lists open under. */
  anchorRef: RefObject<HTMLElement | null>;
}

const SEPARATOR_CLASSES = "shrink-0 text-muted-foreground select-none";

/** The single capsule of a mosaic link before its mosaic file is loaded, or after it failed first. */
function renderPendingMosaic(sandbox: SandboxSnapshot): ReactElement {
  return (
    <span className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-2 text-sm text-muted-foreground">
      <MosaicIcon className="size-4 shrink-0" />
      <span className="truncate">
        {isSandboxLoading(sandbox) ? "Loading mosaic…" : "Mosaic not loaded"}
      </span>
    </span>
  );
}

/** Starts a list's loads ahead of its opening, those not requested yet. */
function startListLoads(props: CombinationTitleProps, loads: ListLoads): void {
  const recent = readRecentlyUsedSnapshot(props.recentlyUsed);
  void loads(props.combinations, props.stage, props.sandbox, recent);
}

/** The folded capsule's menu holds the three lists: opening it measures for each. */
function startEveryListLoads(props: CombinationTitleProps): void {
  startListLoads(props, startModListLoads);
  startListLoads(props, startCollectionListLoads);
  startListLoads(props, startMosaicListLoads);
}

function buildListProps(
  props: CombinationTitleProps,
  panel: CapsulePanel,
  capsule: ReactElement,
): CapsuleListProps {
  const listProps: CapsuleListProps = {
    stage: props.stage,
    sandbox: props.sandbox,
    combinations: props.combinations,
    recentlyUsed: props.recentlyUsed,
    listChoices: props.listChoices,
    isOpen: props.openPanel === panel,
    onOpenChange: props.onPanelOpenChange.bind(undefined, panel),
    anchorRef: props.anchorRef,
    children: capsule,
  };
  return listProps;
}

/** The capsules' row: mod + collection -> mosaic, each opening its list. Hidden on a narrow bar (`data-narrow`, see `useNarrowStageBar`). */
function renderCapsuleRow(props: CombinationTitleProps): ReactElement {
  const sandbox = props.sandbox;
  const isUnsaved = sandbox.mosaicReference === null;
  const modTitle = readModCapsuleTitle(sandbox);
  const modCapsule = (
    <CombinationCapsule
      kind="Mod"
      icon={<ModIcon />}
      title={modTitle.title}
      shrink={isUnsaved ? 1 : 2}
      hidesTitleWhenNarrow
      onIntent={startListLoads.bind(undefined, props, startModListLoads)}
    />
  );
  const collectionCapsule = (
    <CombinationCapsule
      kind="Collection"
      icon={<CollectionIcon />}
      title={readCollectionCapsuleTitle(sandbox)}
      shrink={3}
      hidesTitleWhenNarrow
      onIntent={startListLoads.bind(undefined, props, startCollectionListLoads)}
    />
  );
  const mosaicCapsule = (
    <CombinationCapsule
      kind="Mosaic"
      icon={<MosaicIcon />}
      title={readMosaicCapsuleTitle(sandbox)}
      shrink={isUnsaved ? 2 : 1}
      isDashed={isUnsaved}
      onIntent={startListLoads.bind(undefined, props, startMosaicListLoads)}
    />
  );
  return (
    <div
      data-capsule-row=""
      className="flex min-w-0 items-center gap-1 group-data-narrow/stage-bar:hidden"
    >
      <ModList {...buildListProps(props, "mod-list", modCapsule)} />
      <span aria-hidden="true" className={SEPARATOR_CLASSES}>
        +
      </span>
      <CollectionList
        {...buildListProps(props, "collection-list", collectionCapsule)}
      />
      <span aria-hidden="true" className={SEPARATOR_CLASSES}>
        →
      </span>
      <MosaicList {...buildListProps(props, "mosaic-list", mosaicCapsule)} />
    </div>
  );
}

/**
 * The single capsule of a narrow bar (under 480px, or when the capsules do
 * not fit), with the mosaic capsule's look: its icon and title, so
 * "Unsaved combination" with a dashed border for a combination. Its menu
 * has "Mosaic: <title>", "Mod: <title>" and "Collection: <title>" rows that
 * open their lists, so a phone shows what runs one tap away.
 */
function FoldedCapsule(props: CombinationTitleProps): ReactElement {
  const sandbox = props.sandbox;
  const isUnsaved = sandbox.mosaicReference === null;
  const mosaicTitle = readMosaicCapsuleTitle(sandbox);
  const mosaicRow = `Mosaic: ${mosaicTitle}`;
  const modRow = `Mod: ${readModCapsuleTitle(sandbox).title}`;
  const collectionRow = `Collection: ${readCollectionCapsuleTitle(sandbox)}`;

  // The list a chosen row opens once the menu is closed, so the list keeps the focus.
  const chosenListRef = useRef<CapsulePanel | null>(null);

  function handleOpenChange(isOpen: boolean): void {
    if (isOpen) {
      startEveryListLoads(props);
    }
    props.onPanelOpenChange("folded", isOpen);
  }

  function handleMosaicSelect(): void {
    chosenListRef.current = "mosaic-list";
  }

  function handleModSelect(): void {
    chosenListRef.current = "mod-list";
  }

  function handleCollectionSelect(): void {
    chosenListRef.current = "collection-list";
  }

  /** Opens the chosen row's list instead of focusing the capsule; a click in a frame leaves the focus there. */
  function handleCloseAutoFocus(event: Event): void {
    const chosenList = chosenListRef.current;
    chosenListRef.current = null;
    if (chosenList !== null || isFocusInFrame()) {
      event.preventDefault();
    }
    if (chosenList !== null) {
      props.onPanelOpenChange(chosenList, true);
    }
  }

  return (
    <div className="hidden min-w-0 group-data-narrow/stage-bar:flex">
      <DropdownMenu
        open={props.openPanel === "folded"}
        onOpenChange={handleOpenChange}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <CombinationCapsule
            kind="Combination"
            icon={<MosaicIcon />}
            title={mosaicTitle}
            shrink={1}
            isDashed={isUnsaved}
          />
        </DropdownMenuTrigger>
        {/* The rows' titles are cut, so the menu stays inside a phone's viewport. */}
        <DropdownMenuContent
          align="start"
          className="max-w-[calc(100vw-2rem)]"
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <DropdownMenuItem onSelect={handleMosaicSelect}>
            <MosaicIcon />
            <span className="truncate">{mosaicRow}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleModSelect}>
            <ModIcon />
            <span className="truncate">{modRow}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCollectionSelect}>
            <CollectionIcon />
            <span className="truncate">{collectionRow}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * A combination sandbox's title, as a recipe: the mod capsule, `+`, the
 * collection capsule, an arrow and the mosaic capsule, the `+` and the arrow
 * hidden from assistive technologies. Under 480px of bar width, one folded
 * capsule takes their place. For a mosaic link, one capsule says "Loading
 * mosaic…" or "Mosaic not loaded" until its file is loaded.
 */
export function CombinationTitle(props: CombinationTitleProps): ReactElement {
  if (isMosaicPending(props.sandbox)) {
    return renderPendingMosaic(props.sandbox);
  }
  return (
    <>
      {renderCapsuleRow(props)}
      <FoldedCapsule {...props} />
    </>
  );
}
