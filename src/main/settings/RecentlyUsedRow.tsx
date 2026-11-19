import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  clearRecentlyUsed,
  readRecentlyUsedSnapshot,
  subscribeRecentlyUsed,
} from "./recently_used.ts";
import type { RecentlyUsed, RecentlyUsedSnapshot } from "./recently_used.ts";

interface RecentlyUsedRowProps {
  recentlyUsed: RecentlyUsed;
}

function describeCount(count: number, one: string, many: string): string {
  const text = `${count} ${count === 1 ? one : many}`;
  return text;
}

/** "2 mods, 1 collection and 0 mosaics are recently used", or `null` when nothing is. */
function describeRecentlyUsed(snapshot: RecentlyUsedSnapshot): string | null {
  const total =
    snapshot.mods.length +
    snapshot.collections.length +
    snapshot.mosaics.length;
  if (total === 0) {
    return null;
  }
  const mods = describeCount(snapshot.mods.length, "mod", "mods");
  const collections = describeCount(
    snapshot.collections.length,
    "collection",
    "collections",
  );
  const mosaics = describeCount(snapshot.mosaics.length, "mosaic", "mosaics");
  const verb = total === 1 ? "is" : "are";
  const text = `${mods}, ${collections} and ${mosaics} ${verb} recently used, kept only on this device.`;
  return text;
}

/**
 * How many mods, collections and mosaics are recently used, and, while any
 * is kept, a "Clear" button that clears them at once, without reloading any
 * frame.
 */
export function RecentlyUsedRow({
  recentlyUsed,
}: RecentlyUsedRowProps): ReactElement {
  const snapshot = useStoreSnapshot(
    recentlyUsed,
    subscribeRecentlyUsed,
    readRecentlyUsedSnapshot,
  );
  const description = describeRecentlyUsed(snapshot);

  function handleClearClick(): void {
    clearRecentlyUsed(recentlyUsed);
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <p className="flex-1 text-sm">
        {description ?? "Nothing is recently used."}
      </p>
      {description === null ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearClick}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
