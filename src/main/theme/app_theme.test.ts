import { describe, expect, it, vi } from "vitest";
import type { Stage } from "../../lib/core/stage/index.ts";
import {
  changeSystemPreference,
  createFakeColorSchemeQuery,
} from "../../test/fake_color_scheme_queries.ts";
import type { FakeColorSchemeQuery } from "../../test/fake_color_scheme_queries.ts";
import { FakeHistory } from "../../test/fake_history.ts";
import {
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import { buildTestStage } from "../../test/test_stages.ts";
import {
  chooseTheme,
  createAppTheme,
  readAppThemeSnapshot,
  readStartColorScheme,
  subscribeAppTheme,
} from "./app_theme.ts";
import type { AppTheme } from "./app_theme.ts";

interface ThemeFixture {
  appTheme: AppTheme;
  stage: Stage;
  storage: MemoryStorage;
  systemQuery: FakeColorSchemeQuery;
  root: HTMLElement;
}

function buildFixture(
  storage: MemoryStorage = createMemoryStorage(),
  systemPrefersDark: boolean = false,
): ThemeFixture {
  const systemQuery = createFakeColorSchemeQuery(systemPrefersDark);
  const stage = buildTestStage(new FakeHistory(""));
  const root = document.createElement("div");
  const appTheme = createAppTheme({ storage, systemQuery, stage, root });
  const fixture: ThemeFixture = {
    appTheme,
    stage,
    storage,
    systemQuery,
    root,
  };
  return fixture;
}

describe("app theme", function describeAppTheme(): void {
  it("Default choice", function startsWithSystem(): void {
    const fixture = buildFixture();

    expect(readAppThemeSnapshot(fixture.appTheme)).toEqual({
      choice: "system",
      colorScheme: "light",
    });
    expect(fixture.root.dataset.tesColorScheme).toBe("light");
  });

  it("restores the stored choice", function restoresChoice(): void {
    const storage = createMemoryStorage();
    storage.setItem("teselarium.theme-choice", "dark");

    const fixture = buildFixture(storage);

    expect(readAppThemeSnapshot(fixture.appTheme)).toEqual({
      choice: "dark",
      colorScheme: "dark",
    });
    expect(fixture.stage.theme.colorScheme).toBe("dark");
  });

  it("writes the choice to the storage", function writesChoice(): void {
    const fixture = buildFixture();

    chooseTheme(fixture.appTheme, "dark");

    expect(fixture.storage.getItem("teselarium.theme-choice")).toBe("dark");
  });

  it("applies a choice to the page and the stage", function appliesChoice(): void {
    const fixture = buildFixture();

    chooseTheme(fixture.appTheme, "dark");

    expect(readAppThemeSnapshot(fixture.appTheme)).toEqual({
      choice: "dark",
      colorScheme: "dark",
    });
    expect(fixture.root.dataset.tesColorScheme).toBe("dark");
    expect(fixture.stage.theme.colorScheme).toBe("dark");
  });

  it("Operating system changes while the app is open", function followsSystem(): void {
    const fixture = buildFixture(createMemoryStorage(), false);

    changeSystemPreference(fixture.systemQuery, true);

    expect(readAppThemeSnapshot(fixture.appTheme).colorScheme).toBe("dark");
    expect(fixture.root.dataset.tesColorScheme).toBe("dark");
    expect(fixture.stage.theme.colorScheme).toBe("dark");
  });

  it("ignores the operating system for an explicit choice", function keepsChoice(): void {
    const fixture = buildFixture();
    chooseTheme(fixture.appTheme, "light");

    changeSystemPreference(fixture.systemQuery, true);

    expect(readAppThemeSnapshot(fixture.appTheme).colorScheme).toBe("light");
  });

  it("Storage cannot be written", function appliesWithoutStorage(): void {
    const fixture = buildFixture(createFullStorage());

    chooseTheme(fixture.appTheme, "dark");

    expect(readAppThemeSnapshot(fixture.appTheme)).toEqual({
      choice: "dark",
      colorScheme: "dark",
    });
    expect(fixture.root.dataset.tesColorScheme).toBe("dark");
  });

  it("notifies every change with a new frozen snapshot", function notifiesChanges(): void {
    const fixture = buildFixture();
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeAppTheme(fixture.appTheme, listener);
    const firstSnapshot = readAppThemeSnapshot(fixture.appTheme);

    chooseTheme(fixture.appTheme, "dark");
    unsubscribe();
    chooseTheme(fixture.appTheme, "light");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readAppThemeSnapshot(fixture.appTheme)).not.toBe(firstSnapshot);
    expect(Object.isFrozen(firstSnapshot)).toBe(true);
    expect(readAppThemeSnapshot(fixture.appTheme)).toBe(
      readAppThemeSnapshot(fixture.appTheme),
    );
  });
});

describe("readStartColorScheme", function describeReadStartColorScheme(): void {
  it("resolves the stored choice with the system preference", function resolvesStart(): void {
    const storage = createMemoryStorage();

    expect(
      readStartColorScheme(storage, createFakeColorSchemeQuery(true)),
    ).toBe("dark");
    storage.setItem("teselarium.theme-choice", "light");
    expect(
      readStartColorScheme(storage, createFakeColorSchemeQuery(true)),
    ).toBe("light");
  });
});
