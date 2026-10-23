import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../App.tsx";
import { startTestApp } from "../../test/test_app.ts";
import type { AppFixture } from "../../test/test_app.ts";
import { openStageSection } from "../../lib/core/stage/index.ts";
import { settleStage } from "../../test/test_stages.ts";

function renderApp(fixture: AppFixture): RenderResult {
  return render(
    <App
      stage={fixture.stage}
      appTheme={fixture.appTheme}
      sections={fixture.sections}
      switches={fixture.switches}
      layout={fixture.layout}
    />,
  );
}

function sidebarSections(): HTMLElement {
  return screen.getByRole("navigation", { name: "Sections" });
}

function readSidebarNames(): string[] {
  const names: string[] = [];
  for (const item of within(sidebarSections()).getAllByRole("link")) {
    names.push(item.textContent?.replace("Coming soon", "") ?? "");
  }
  return names;
}

function sectionRows(): HTMLElement {
  return screen.getByRole("list", { name: "Sidebar sections" });
}

function findRow(name: string): HTMLElement {
  for (const row of within(sectionRows()).getAllByRole("listitem")) {
    if (row.textContent?.startsWith(name) === true) {
      return row;
    }
  }
  throw new Error(`Expected a row for ${name}`);
}

describe("SettingsPage", function describeSettingsPage(): void {
  it("Vanilla settings page", async function showsSettings(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
    for (const name of ["Tiles", "Mods", "Mosaics", "Guides"]) {
      expect(screen.getByRole("switch", { name })).toBeChecked();
    }
    for (const name of ["Home", "Settings", "About"]) {
      expect(findRow(name)).toHaveTextContent("Always shown");
      expect(within(findRow(name)).queryByRole("switch")).toBeNull();
    }
    expect(findRow("Tiles")).toHaveTextContent("Coming soon");
    expect(findRow("Mosaics")).toHaveTextContent("Coming soon");
    expect(findRow("Mods")).not.toHaveTextContent("Coming soon");
  });

  it("lists the sections in the sidebar's order", async function listsInOrder(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    const names: string[] = [];
    for (const row of within(sectionRows()).getAllByRole("listitem")) {
      names.push(row.textContent?.split(/Always|Coming/)[0] ?? "");
    }

    expect(names).toEqual([
      "Home",
      "Tiles",
      "Mods",
      "Mosaics",
      "Guides",
      "Settings",
      "About",
    ]);
  });

  it("Hide Guides", async function hidesGuides(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    fireEvent.click(screen.getByRole("switch", { name: "Guides" }));

    expect(screen.getByRole("switch", { name: "Guides" })).not.toBeChecked();
    expect(readSidebarNames()).not.toContain("Guides");
  });

  it("Hide a coming-soon section", async function hidesTiles(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    fireEvent.click(screen.getByRole("switch", { name: "Tiles" }));

    expect(readSidebarNames()).not.toContain("Tiles");
  });

  it("Show it again", async function showsGuidesAgain(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    fireEvent.click(screen.getByRole("switch", { name: "Guides" }));
    fireEvent.click(screen.getByRole("switch", { name: "Guides" }));

    expect(readSidebarNames()).toEqual([
      "Home",
      "Tiles",
      "Mods",
      "Mosaics",
      "Guides",
      "Settings",
      "About",
    ]);
  });

  it("makes no item current while its section is hidden, and again once shown", async function followsSwitches(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    renderApp(fixture);
    fireEvent.click(screen.getByRole("switch", { name: "Mods" }));

    await act(async function openMods(): Promise<void> {
      openStageSection(fixture.stage, "mods");
      await settleStage(fixture.stage);
    });
    expect(
      within(sidebarSections()).queryByRole("link", { current: "page" }),
    ).toBeNull();
    await act(async function showMods(): Promise<void> {
      openStageSection(fixture.stage, "settings");
      await settleStage(fixture.stage);
    });
    fireEvent.click(screen.getByRole("switch", { name: "Mods" }));
    await act(async function backToMods(): Promise<void> {
      openStageSection(fixture.stage, "mods");
      await settleStage(fixture.stage);
    });

    expect(
      within(sidebarSections()).getByRole("link", { current: "page" }),
    ).toHaveAccessibleName("Mods");
  });
});
