import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  readPlayerSitesSnapshot,
  removePlayerSite,
  subscribePlayerSites,
} from "./player_sites.ts";
import type { PlayerSites } from "./player_sites.ts";

interface PlayerSiteListProps {
  playerSites: PlayerSites;
}

interface PlayerSiteRowProps {
  host: string;
  playerSites: PlayerSites;
}

function describePlayerSite(host: string): string {
  const line = `play media from ${host}`;
  return line;
}

/** One site the user always plays from: the line, for every mod, and its Remove button. */
function PlayerSiteRow({
  host,
  playerSites,
}: PlayerSiteRowProps): ReactElement {
  function handleRemoveClick(): void {
    removePlayerSite(playerSites, host);
  }

  const line = describePlayerSite(host);
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
        {line}
      </span>
      <span className="text-xs text-muted-foreground">Every mod</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Remove: ${line}`}
        onClick={handleRemoveClick}
      >
        Remove
      </Button>
    </li>
  );
}

/** The sites the user always plays from, for every mod, or nothing when there are none. */
export function PlayerSiteList({
  playerSites,
}: PlayerSiteListProps): ReactElement | null {
  const hosts = useStoreSnapshot(
    playerSites,
    subscribePlayerSites,
    readPlayerSitesSnapshot,
  );
  if (hosts.length === 0) {
    return null;
  }
  const rows: ReactElement[] = [];
  for (const host of hosts) {
    rows.push(
      <PlayerSiteRow key={host} host={host} playerSites={playerSites} />,
    );
  }
  return (
    <ul aria-label="Sites always played from" className="mt-2 divide-y">
      {rows}
    </ul>
  );
}
