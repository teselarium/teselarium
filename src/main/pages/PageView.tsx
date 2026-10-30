import { useMemo } from "react";
import type { ReactElement } from "react";
import {
  readStageSnapshot,
  subscribeStage,
} from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import { SETTINGS_SECTION_ID } from "../sections/section_registry.ts";
import type { SectionDefinition } from "../sections/section_registry.ts";
import type { SectionSwitches } from "../sections/section_switches.ts";
import { SettingsPage } from "../settings/SettingsPage.tsx";
import type { TileMediaSetting } from "../settings/tile_media_setting.ts";
import type { AppTheme } from "../theme/app_theme.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { MarkdownPage } from "./MarkdownPage.tsx";
import { buildPageFileUrl } from "./page_links.ts";
import type { PageFile } from "./page_links.ts";

interface PageViewProps {
  stage: Stage;
  appTheme: AppTheme;
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  tileMedia: TileMediaSetting;
}

function buildPageFile(
  baseUrl: string,
  section: string,
  page: string | null,
): PageFile {
  const file: PageFile = {
    section,
    url: buildPageFileUrl(baseUrl, section, page),
  };
  return file;
}

/**
 * The page the stage shows, if any: the Settings page for the Settings
 * section, or the markdown page of any other page section. Renders nothing
 * while a sandbox or nothing is shown.
 */
export function PageView({
  stage,
  appTheme,
  sections,
  switches,
  tileMedia,
}: PageViewProps): ReactElement | null {
  const snapshot = useStoreSnapshot(stage, subscribeStage, readStageSnapshot);
  const visible = snapshot.visible;
  const baseUrl = stage.fetchOptions.baseUrl ?? document.baseURI;
  const section = visible?.kind === "page" ? visible.section : null;
  const page = visible?.kind === "page" ? visible.page : null;
  const file = useMemo(
    function buildVisibleFile(): PageFile | null {
      return section === null ? null : buildPageFile(baseUrl, section, page);
    },
    [baseUrl, section, page],
  );
  if (file === null) {
    return null;
  }
  if (file.section === SETTINGS_SECTION_ID) {
    return (
      <SettingsPage
        appTheme={appTheme}
        sections={sections}
        switches={switches}
        tileMedia={tileMedia}
      />
    );
  }
  return (
    <MarkdownPage
      key={file.url}
      file={file}
      fetchOptions={stage.fetchOptions}
    />
  );
}
