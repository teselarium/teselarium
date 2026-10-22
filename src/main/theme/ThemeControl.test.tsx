import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeColorSchemeQuery } from "../../test/fake_color_scheme_queries.ts";
import { FakeHistory } from "../../test/fake_history.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import { buildTestStage } from "../../test/test_stages.ts";
import { createAppTheme, readAppThemeSnapshot } from "./app_theme.ts";
import type { AppTheme } from "./app_theme.ts";
import { ThemeControl } from "./ThemeControl.tsx";

function buildAppTheme(storage: MemoryStorage): AppTheme {
  const appTheme = createAppTheme({
    storage,
    systemQuery: createFakeColorSchemeQuery(false),
    stage: buildTestStage(new FakeHistory("")),
    root: document.createElement("div"),
  });
  return appTheme;
}

function readSelectedLabel(select: HTMLSelectElement): string {
  return select.selectedOptions[0]?.textContent ?? "";
}

function readOptionLabel(option: HTMLElement): string {
  return option.textContent ?? "";
}

describe("ThemeControl", function describeThemeControl(): void {
  it("Default choice", function showsSystem(): void {
    render(<ThemeControl appTheme={buildAppTheme(createMemoryStorage())} />);

    const select = screen.getByLabelText<HTMLSelectElement>("Theme");

    expect(readSelectedLabel(select)).toBe("System");
    expect(screen.getAllByRole("option").map(readOptionLabel)).toEqual([
      "System",
      "Light",
      "Dark",
    ]);
  });

  it("Unknown stored value", function showsSystemForUnknown(): void {
    const storage = createMemoryStorage();
    storage.setItem("opentesela.theme-choice", "purple");
    render(<ThemeControl appTheme={buildAppTheme(storage)} />);

    const select = screen.getByLabelText<HTMLSelectElement>("Theme");

    expect(readSelectedLabel(select)).toBe("System");
  });

  it("chooses Dark and shows it", function choosesDark(): void {
    const storage = createMemoryStorage();
    const appTheme = buildAppTheme(storage);
    render(<ThemeControl appTheme={appTheme} />);
    const select = screen.getByLabelText<HTMLSelectElement>("Theme");

    fireEvent.change(select, { target: { value: "dark" } });

    expect(readSelectedLabel(select)).toBe("Dark");
    expect(readAppThemeSnapshot(appTheme)).toEqual({
      choice: "dark",
      colorScheme: "dark",
    });
    expect(storage.getItem("opentesela.theme-choice")).toBe("dark");
  });
});
