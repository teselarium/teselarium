import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { SAMPLE_MOD_REFERENCE } from "./test/sample_mods.ts";
import { startTestApp } from "./test/test_app.ts";
import type { AppFixture } from "./test/test_app.ts";
import { MOD_HOME_ROUTING } from "./test/test_stages.ts";

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

describe("App", function describeApp(): void {
  it("renders the OpenTesela title", async function rendersTitle(): Promise<void> {
    renderApp(await startTestApp(""));

    const title = screen.getByRole("heading", { name: "OpenTesela" });

    expect(title).toBeInTheDocument();
  });

  it("No Theme control in the header", async function hasNoThemeControl(): Promise<void> {
    renderApp(await startTestApp(""));

    const header = screen.getByRole("banner");

    expect(
      within(header).getByRole("button", { name: "Hide sidebar" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("heading", { name: "OpenTesela" }),
    ).toBeInTheDocument();
    expect(within(header).queryByLabelText("Theme")).toBeNull();
  });

  it("No hash", async function rendersNoFrame(): Promise<void> {
    const { container } = renderApp(await startTestApp(""));

    expect(
      screen.getByRole("heading", { name: "OpenTesela" }),
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
