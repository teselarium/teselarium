import type { ReactElement } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/vendor/shadcn/ui/card.tsx";
import { Label } from "@/vendor/shadcn/ui/label.tsx";
import { Switch } from "@/vendor/shadcn/ui/switch.tsx";
import { MOD_API_VERSION } from "../../lib/core/engine/index.ts";
import { APP_VERSION } from "../app_version.ts";
import type { SectionDefinition } from "../sections/section_registry.ts";
import {
  isSectionShown,
  readSectionSwitchesSnapshot,
  subscribeSectionSwitches,
  switchSection,
} from "../sections/section_switches.ts";
import type {
  SectionSwitches,
  SectionSwitchesSnapshot,
} from "../sections/section_switches.ts";
import { SectionIcon } from "../sidebar/SectionIcon.tsx";
import type { AppTheme } from "../theme/app_theme.ts";
import { ThemeControl } from "../theme/ThemeControl.tsx";
import {
  readCatalogSettingSnapshot,
  subscribeCatalogSetting,
  switchCatalogDefaultMosaics,
} from "./catalog_setting.ts";
import type { CatalogSetting } from "./catalog_setting.ts";
import type { SiteDecisions } from "./site_decisions.ts";
import type { PlayerSites } from "./player_sites.ts";
import { PlayerSiteList } from "./PlayerSiteList.tsx";
import type { RecentlyUsed } from "./recently_used.ts";
import { RecentlyUsedRow } from "./RecentlyUsedRow.tsx";
import { SiteDecisionList } from "./SiteDecisionList.tsx";
import {
  readTileMediaSnapshot,
  subscribeTileMediaSetting,
  switchTileLinkedMedia,
} from "./tile_media_setting.ts";
import type { TileMediaSetting } from "./tile_media_setting.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";

interface SettingsPageProps {
  appTheme: AppTheme;
  /** The available sections, in registry order. */
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  tileMedia: TileMediaSetting;
  catalogSetting: CatalogSetting;
  recentlyUsed: RecentlyUsed;
  siteDecisions: SiteDecisions;
  playerSites: PlayerSites;
}

interface TileMediaRowProps {
  tileMedia: TileMediaSetting;
}

interface CatalogRowProps {
  catalogSetting: CatalogSetting;
}

interface SectionRowProps {
  section: SectionDefinition;
  switches: SectionSwitches;
  snapshot: SectionSwitchesSnapshot;
}

/** The sections in the sidebar's order: the `main` group, then the `footer` group. */
function sortInSidebarOrder(
  sections: readonly SectionDefinition[],
): SectionDefinition[] {
  const mainSections: SectionDefinition[] = [];
  const footerSections: SectionDefinition[] = [];
  for (const section of sections) {
    if (section.group === "main") {
      mainSections.push(section);
    } else {
      footerSections.push(section);
    }
  }
  const sorted = [...mainSections, ...footerSections];
  return sorted;
}

/** One section: its icon and name, then "Always shown" or its switch, and "Coming soon" where it applies. */
function SectionRow({
  section,
  switches,
  snapshot,
}: SectionRowProps): ReactElement {
  function handleCheckedChange(isOn: boolean): void {
    switchSection(switches, section.id, isOn);
  }

  const switchId = `section-switch-${section.id}`;
  return (
    <li className="flex items-center gap-3 py-2">
      <SectionIcon icon={section.icon} />
      {section.optional ? (
        <Label htmlFor={switchId} className="flex-1 font-normal">
          {section.label}
        </Label>
      ) : (
        <span className="flex-1 text-sm">{section.label}</span>
      )}
      {section.comingSoon ? (
        <span className="text-xs text-muted-foreground">Coming soon</span>
      ) : null}
      {section.optional ? (
        <Switch
          id={switchId}
          checked={isSectionShown(snapshot, section.id)}
          onCheckedChange={handleCheckedChange}
        />
      ) : (
        <span className="text-xs text-muted-foreground">Always shown</span>
      )}
    </li>
  );
}

const TILE_MEDIA_SWITCH_ID = "tile-linked-media-switch";

/** The "Load media linked by tiles" switch. */
function TileMediaRow({ tileMedia }: TileMediaRowProps): ReactElement {
  const isOn = useStoreSnapshot(
    tileMedia,
    subscribeTileMediaSetting,
    readTileMediaSnapshot,
  );

  function handleCheckedChange(isChecked: boolean): void {
    switchTileLinkedMedia(tileMedia, isChecked);
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <Label htmlFor={TILE_MEDIA_SWITCH_ID} className="flex-1 font-normal">
        Load media linked by tiles
      </Label>
      <Switch
        id={TILE_MEDIA_SWITCH_ID}
        checked={isOn}
        onCheckedChange={handleCheckedChange}
      />
    </div>
  );
}

const CATALOG_SWITCH_ID = "catalog-default-mosaics-switch";

/** The "List the default mosaics of mods" switch. */
function CatalogRow({ catalogSetting }: CatalogRowProps): ReactElement {
  const isOn = useStoreSnapshot(
    catalogSetting,
    subscribeCatalogSetting,
    readCatalogSettingSnapshot,
  );

  function handleCheckedChange(isChecked: boolean): void {
    switchCatalogDefaultMosaics(catalogSetting, isChecked);
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <Label htmlFor={CATALOG_SWITCH_ID} className="flex-1 font-normal">
        List the default mosaics of mods
      </Label>
      <Switch
        id={CATALOG_SWITCH_ID}
        checked={isOn}
        onCheckedChange={handleCheckedChange}
      />
    </div>
  );
}

/**
 * The Settings section's page: the Theme control, a switch for each optional
 * section of the sidebar, the "List the default mosaics of mods" switch and
 * the recently used count with its "Clear" button, the
 * "Load media linked by tiles" switch, the
 * remembered site decisions with their Remove buttons, and the app's version
 * and mod API version as text to copy. A section switch only hides the
 * sidebar item.
 */
export function SettingsPage({
  appTheme,
  sections,
  switches,
  tileMedia,
  catalogSetting,
  recentlyUsed,
  siteDecisions,
  playerSites,
}: SettingsPageProps): ReactElement {
  const snapshot = useStoreSnapshot(
    switches,
    subscribeSectionSwitches,
    readSectionSwitchesSnapshot,
  );
  const rows: ReactElement[] = [];
  for (const section of sortInSidebarOrder(sections)) {
    rows.push(
      <SectionRow
        key={section.id}
        section={section}
        switches={switches}
        snapshot={snapshot}
      />,
    );
  }
  return (
    <div className="flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeControl appTheme={appTheme} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Sidebar
          </CardTitle>
          <CardDescription>
            Hiding a section only removes its item from the sidebar: its links
            still work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul aria-label="Sidebar sections" className="divide-y">
            {rows}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Catalog
          </CardTitle>
          <CardDescription>
            The explorers list the app's mods, collections and mosaics. Also
            listing the default mosaic of each mod helps when writing a mod, to
            try its own mosaic next to the others. Applies at once, to open
            explorers too. The stage bar's lists also offer the mods,
            collections and mosaics you recently tried, which the app keeps only
            on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <CatalogRow catalogSetting={catalogSetting} />
          <RecentlyUsedRow recentlyUsed={recentlyUsed} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Privacy
          </CardTitle>
          <CardDescription>
            Mods can show the images, audio and video their tiles link to. The
            linked sites can see that you viewed the tile. Applies to mods
            opened after the change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TileMediaRow tileMedia={tileMedia} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Mod permissions
          </CardTitle>
          <CardDescription>
            The answers you asked the app to remember when a mod from another
            site asked to use other sites. Each site a mod is allowed to use can
            see that you used that mod. Sites allowed to exchange data or load
            code can also receive what the mod shows or keeps. Changes apply the
            next time a mod is opened: after you remove an answer, the app asks
            again. Running mods keep their permissions. The sites you always
            play media from are listed for every mod: after you remove one, the
            app asks before the next player of that site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SiteDecisionList siteDecisions={siteDecisions} />
          <PlayerSiteList playerSites={playerSites} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Version
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl
            aria-label="Versions"
            className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm"
          >
            <dt className="text-muted-foreground">OpenTesela</dt>
            <dd>{APP_VERSION}</dd>
            <dt className="text-muted-foreground">Mod API</dt>
            <dd>{MOD_API_VERSION}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
