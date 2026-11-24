import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { readStageCatalog } from "./lib/core/stage/index.ts";
import { SAMPLE_MOD_REFERENCE } from "./test/sample_mods.ts";
import { startTestApp } from "./test/test_app.ts";
import type { AppFixture } from "./test/test_app.ts";
import { MOD_HOME_ROUTING } from "./test/test_stages.ts";

function renderApp(fixture: AppFixture): RenderResult {
  return render(
    <App
      stage={fixture.stage}
      combinations={fixture.combinations}
      listChoices={fixture.listChoices}
      recentlyUsed={fixture.recentlyUsed}
      userCatalog={fixture.userCatalog}
      appTheme={fixture.appTheme}
      sections={fixture.sections}
      switches={fixture.switches}
      tileMedia={fixture.tileMedia}
      catalogSetting={fixture.catalogSetting}
      theater={fixture.theater}
      siteDecisions={fixture.siteDecisions}
      playerSites={fixture.playerSites}
      layout={fixture.layout}
    />,
  );
}

describe("App", function describeApp(): void {
  it("renders the Teselarium title", async function rendersTitle(): Promise<void> {
    renderApp(await startTestApp(""));

    const title = screen.getByRole("heading", { name: "Teselarium" });

    expect(title).toBeInTheDocument();
  });

  it("Store refused at start", async function startsWithoutStore(): Promise<void> {
    const fixture = await startTestApp("", { userCatalog: { database: null } });

    renderApp(fixture);

    expect(
      screen.getByRole("heading", { level: 1, name: "Teselarium" }),
    ).toBeTruthy();
    const catalog = await readStageCatalog(fixture.stage);
    for (const mosaic of catalog.mosaics) {
      expect(mosaic.listedBy).not.toBe("user");
    }
  });

  it("No app header", async function hasNoHeader(): Promise<void> {
    renderApp(await startTestApp(""));

    const sidebar = screen.getByRole("complementary", { name: "Sidebar" });

    expect(screen.queryByRole("banner")).toBeNull();
    expect(
      within(sidebar).getByRole("button", { name: "Hide sidebar" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("heading", { name: "Teselarium" }),
    ).toBeInTheDocument();
  });

  it("marks the layout with the sidebar's state", async function marksState(): Promise<void> {
    const fixture = await startTestApp("");
    const { container } = renderApp(fixture);
    const layout = container.querySelector(".app-layout");
    expect(layout).toHaveAttribute("data-sidebar-state", "expanded");

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(layout).toHaveAttribute("data-sidebar-state", "collapsed");
    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(layout).toHaveAttribute("data-sidebar-state", "hidden");
  });

  it("No hash", async function rendersNoFrame(): Promise<void> {
    const { container } = renderApp(await startTestApp(""));

    expect(
      screen.getByRole("heading", { name: "Teselarium" }),
    ).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Sections" }),
    ).toBeInTheDocument();
  });

  it("Home as a mod", async function rendersHomeMod(): Promise<void> {
    renderApp(await startTestApp("", { routing: MOD_HOME_ROUTING }));

    expect(screen.getByTitle("Book List").tagName).toBe("IFRAME");
  });

  it("keeps the stage mounted and hidden while a page shows", async function hidesStage(): Promise<void> {
    const { container } = renderApp(
      await startTestApp(`#/run?mod=${SAMPLE_MOD_REFERENCE}`),
    );
    const frame = screen.getByTitle("Book List");

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole(
        "link",
        { name: "Settings" },
      ),
    );

    const stageView = await screen.findByTitle("Book List");
    expect(stageView).toBe(frame);
    expect(container.querySelector("[data-stage-view]")).not.toBeVisible();
  });
});
