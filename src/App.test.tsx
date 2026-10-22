import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import type { Stage } from "./lib/core/stage/index.ts";
import { createAppTheme } from "./main/theme/app_theme.ts";
import type { AppTheme } from "./main/theme/app_theme.ts";
import { createFakeColorSchemeQuery } from "./test/fake_color_scheme_queries.ts";
import { createMemoryStorage } from "./test/memory_storage.ts";
import { startTestStage } from "./test/test_stages.ts";

function buildAppTheme(stage: Stage): AppTheme {
  const appTheme = createAppTheme({
    storage: createMemoryStorage(),
    systemQuery: createFakeColorSchemeQuery(false),
    stage,
    root: document.createElement("div"),
  });
  return appTheme;
}

describe("App", function describeApp(): void {
  it("renders the OpenTesela title", async function rendersTitle(): Promise<void> {
    const stage = await startTestStage("");
    render(<App stage={stage} appTheme={buildAppTheme(stage)} />);

    const title = screen.getByRole("heading", { name: "OpenTesela" });

    expect(title).toBeInTheDocument();
  });

  it("renders the Theme control in the header", async function rendersThemeControl(): Promise<void> {
    const stage = await startTestStage("");
    render(<App stage={stage} appTheme={buildAppTheme(stage)} />);

    const header = screen.getByRole("banner");

    expect(header).toContainElement(screen.getByLabelText("Theme"));
    expect(header).toContainElement(
      screen.getByRole("heading", { name: "OpenTesela" }),
    );
  });

  it("No hash", async function rendersHomeMod(): Promise<void> {
    const stage = await startTestStage("");
    render(<App stage={stage} appTheme={buildAppTheme(stage)} />);

    expect(
      screen.getByRole("heading", { name: "OpenTesela" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Book List").tagName).toBe("IFRAME");
  });
});
