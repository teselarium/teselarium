import { ArrowUpDown, Info, ListFilter as ListFilterIcon } from "lucide-react";
import type { ReactElement } from "react";
import { CommandInput } from "@/vendor/shadcn/ui/command.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/vendor/shadcn/ui/dropdown-menu.tsx";
import { Separator } from "@/vendor/shadcn/ui/separator.tsx";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  checkListFilter,
  chooseListSort,
  LIST_FILTERS,
  LIST_SORTS,
  readListChoicesSnapshot,
  subscribeListChoices,
} from "./list_choices.ts";
import type { ChoiceOption, ListChoices, ListKind } from "./list_choices.ts";
import { stopKeyPropagation } from "./list_keys.ts";
import type { ListFilter, ListSort } from "./list_order.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

interface CombinationListToolbarProps {
  kind: ListKind;
  listChoices: ListChoices;
  search: string;
  onSearchChange: (search: string) => void;
  /** Told after every sort choice, the one already chosen too, so the list sorts again. */
  onSortChoose: () => void;
  /** Told after a filter is checked or unchecked. */
  onFilterChange: () => void;
  /** Whether the list shows its details page: the "Details" button is then pressed. */
  isShowingDetails: boolean;
  onDetailsToggle: () => void;
}

/** A toolbar button's look while it is on: an active filter, the details page shown. */
const PRESSED_CLASSES = "bg-accent text-accent-foreground";

/** A checkbox item keeps its menu open, so several filters can be checked in a row. */
function keepMenuOpen(event: Event): void {
  event.preventDefault();
}

/** The offered sort whose value the radio group gives, or `null`. */
function findSort(
  options: readonly ChoiceOption<ListSort>[],
  value: string,
): ListSort | null {
  for (const option of options) {
    if (option.value === value) {
      return option.value;
    }
  }
  return null;
}

/**
 * The search field of a list, then, behind a divider, its "Sort" menu, one
 * choice at a time, and its "Filter" menu, whose choices can be checked
 * together; the filter button is shown pressed while one is. Behind a second
 * divider, the "Details" button opens and closes the list's details page,
 * and is shown pressed while it is open. The choices
 * are kept for each list kind in `listChoices`. Both menus are non-modal, so
 * a click in the mod's frame reaches it and closes them with the list, and
 * Escape or a click in a menu closes only the menu.
 */
export function CombinationListToolbar({
  kind,
  listChoices,
  search,
  onSearchChange,
  onSortChoose,
  onFilterChange,
  isShowingDetails,
  onDetailsToggle,
}: CombinationListToolbarProps): ReactElement {
  const choice = useStoreSnapshot(
    listChoices,
    subscribeListChoices,
    readListChoicesSnapshot,
  )[kind];
  const hasFilter = choice.filters.length > 0;

  function handleSortChange(value: string): void {
    const sort = findSort(LIST_SORTS[kind], value);
    if (sort !== null) {
      chooseListSort(listChoices, kind, sort);
    }
  }

  /** The radio group does not tell a choice of the sort already chosen, so the item does. */
  function handleSortSelect(): void {
    onSortChoose();
  }

  function handleFilterChange(filter: ListFilter, isChecked: boolean): void {
    checkListFilter(listChoices, kind, filter, isChecked);
    onFilterChange();
  }

  const sortItems: ReactElement[] = [];
  for (const option of LIST_SORTS[kind]) {
    sortItems.push(
      <DropdownMenuRadioItem
        key={option.value}
        value={option.value}
        onSelect={handleSortSelect}
      >
        {option.label}
      </DropdownMenuRadioItem>,
    );
  }
  const filterItems: ReactElement[] = [];
  for (const option of LIST_FILTERS[kind]) {
    filterItems.push(
      <DropdownMenuCheckboxItem
        key={option.value}
        checked={choice.filters.includes(option.value)}
        onCheckedChange={handleFilterChange.bind(undefined, option.value)}
        onSelect={keepMenuOpen}
      >
        {option.label}
      </DropdownMenuCheckboxItem>,
    );
  }

  return (
    <div className="flex items-center border-b pr-1 [&_[data-slot=command-input-wrapper]]:flex-1 [&_[data-slot=command-input-wrapper]]:border-b-0">
      <CommandInput
        placeholder="Search…"
        value={search}
        onValueChange={onSearchChange}
      />
      <div className="flex items-center gap-0.5" onKeyDown={stopKeyPropagation}>
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-5"
        />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <StageBarIconButton label="Sort">
              <ArrowUpDown />
            </StageBarIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onKeyDown={stopKeyPropagation}>
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={choice.sort}
              onValueChange={handleSortChange}
            >
              {sortItems}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <StageBarIconButton
              label="Filter"
              data-active={hasFilter}
              className={hasFilter ? PRESSED_CLASSES : ""}
            >
              <ListFilterIcon />
            </StageBarIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onKeyDown={stopKeyPropagation}>
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            {filterItems}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-5"
        />
        <StageBarIconButton
          label="Details"
          aria-pressed={isShowingDetails}
          className={isShowingDetails ? PRESSED_CLASSES : ""}
          onClick={onDetailsToggle}
        >
          <Info />
        </StageBarIconButton>
      </div>
    </div>
  );
}
