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
import { useStoreSnapshot } from "../use_store_snapshot.ts";

interface SettingsPageProps {
  appTheme: AppTheme;
  /** The available sections, in registry order. */
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
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

/**
 * The Settings section's page: the Theme control, and a switch for each
 * optional section of the sidebar. A switch only hides the sidebar item.
 */
export function SettingsPage({
  appTheme,
  sections,
  switches,
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
    </div>
  );
}
