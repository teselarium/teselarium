import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { readStageSnapshot } from "../../lib/core/stage/index.ts";
import { startTestApp } from "../../test/test_app.ts";
import type { AppFixture } from "../../test/test_app.ts";
import type { SectionDefinition } from "../sections/section_registry.ts";
import { VANILLA_SECTIONS } from "../sections/vanilla_sections.ts";
import { COMING_SOON_SECTIONS } from "../../test/registries/coming_soon_sections.ts";
import { readTooltipOnFocus } from "../../test/tooltip_texts.ts";
import { chooseTheme } from "../theme/app_theme.ts";
import { Sidebar } from "./Sidebar.tsx";
import {
  collapseSidebar,
  expandSidebar,
  pressHamburger,
  readSidebarSnapshot,
} from "./sidebar_layout.ts";

function renderSidebar(fixture: AppFixture): RenderResult {
  return render(
    <TooltipProvider>
      <Sidebar
        stage={fixture.stage}
        sections={fixture.sections}
        switches={fixture.switches}
        layout={fixture.layout}
        appTheme={fixture.appTheme}
      />
    </TooltipProvider>,
  );
}

function sectionsNav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Sections" });
}

function readItemNames(list: HTMLElement): string[] {
  const names: string[] = [];
  for (const item of within(list).getAllByRole("link")) {
    names.push(item.textContent ?? "");
  }
  return names;
}

function findItem(name: string | RegExp): HTMLElement {
  return within(sectionsNav()).getByRole("link", { name });
}

/** The icon of an item: the content of its icon cell. */
function findItemIcon(item: HTMLElement): Element | null {
  return item.firstElementChild?.firstElementChild ?? null;
}

function sidebarAside(): HTMLElement {
  return screen.getByRole("complementary", { name: "Sidebar" });
}

function headingRow(): HTMLElement {
  const row = sidebarAside().querySelector<HTMLElement>(
    "[data-sidebar-heading-row]",
  );
  if (row === null) {
    throw new Error("Expected the sidebar's heading row");
  }
  return row;
}

function themeButton(): HTMLElement {
  return within(sidebarAside()).getByRole("button", { name: /^Theme: / });
}

/** Every list item of the sidebar, in order: the sections', then the theme control's. */
function readRowTexts(): string[] {
  const texts: string[] = [];
  for (const item of within(sidebarAside()).getAllByRole("listitem")) {
    texts.push(item.textContent ?? "");
  }
  return texts;
}

function readCurrentItems(): string[] {
  const names: string[] = [];
  for (const item of within(sectionsNav()).getAllByRole("link")) {
    if (item.getAttribute("aria-current") === "page") {
      names.push(item.textContent ?? "");
    }
  }
  return names;
}

function withIcon(icon: SectionDefinition["icon"]): SectionDefinition[] {
  const sections: SectionDefinition[] = [];
  for (const section of VANILLA_SECTIONS) {
    sections.push(section.id === "guides" ? { ...section, icon } : section);
  }
  return sections;
}

describe("Sidebar", function describeSidebar(): void {
  it("Vanilla sidebar", async function listsVanillaSections(): Promise<void> {
    renderSidebar(await startTestApp(""));

    const lists = within(sectionsNav()).getAllByRole("list");

    expect(lists).toHaveLength(2);
    expect(readItemNames(lists[0])).toEqual([
      "Home",
      "Tiles",
      "Mods",
      "Mosaics",
      "Guides",
    ]);
    expect(readItemNames(lists[1])).toEqual(["Settings", "About"]);
  });

  it("Lucide icon", async function showsLucideIcons(): Promise<void> {
    renderSidebar(await startTestApp(""));

    for (const item of within(sectionsNav()).getAllByRole("link")) {
      const icon = findItemIcon(item);
      expect(icon?.tagName.toLowerCase()).toBe("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    expect(findItem("Mods")).toHaveAccessibleName("Mods");
  });

  it("Full-color image", async function showsOwnColors(): Promise<void> {
    const sections = withIcon({ image: "./icons/guides.png", tint: false });
    renderSidebar(await startTestApp("", { sections }));

    const icon = findItemIcon(findItem("Guides"));

    expect(icon?.tagName).toBe("IMG");
    expect(icon).toHaveAttribute("src", "./icons/guides.png");
    expect(findItem("Guides")).toHaveAccessibleName("Guides");
  });

  it("draws a tinted image with the text color", async function tintsImage(): Promise<void> {
    const sections = withIcon({ image: "./icons/guides.svg" });
    renderSidebar(await startTestApp("", { sections }));

    const icon = findItemIcon(findItem("Guides")) as HTMLElement;

    expect(icon.tagName).toBe("SPAN");
    expect(icon.style.backgroundColor).toBe("currentcolor");
    expect(icon.style.maskImage).toContain("./icons/guides.svg");
  });

  it("An instantiation's coming-soon section", async function disablesComingSoon(): Promise<void> {
    const fixture = await startTestApp("", { sections: COMING_SOON_SECTIONS });
    renderSidebar(fixture);
    const example = findItem(/Example Section/);
    const visibleBefore = readStageSnapshot(fixture.stage).visible;

    fireEvent.click(example);

    expect(example).toHaveAttribute("aria-disabled", "true");
    expect(example).not.toHaveAttribute("href");
    expect(example).toHaveTextContent("Coming soon");
    expect(fixture.history.entries).toHaveLength(1);
    expect(readStageSnapshot(fixture.stage).visible).toEqual(visibleBefore);
  });

  it("No coming-soon item in the vanilla app", async function hasNoComingSoon(): Promise<void> {
    renderSidebar(await startTestApp(""));

    for (const item of within(sectionsNav()).getAllByRole("link")) {
      expect(item).not.toHaveTextContent("Coming soon");
      expect(item).not.toHaveAttribute("aria-disabled");
    }
  });

  it("gives each item its section's start address", async function linksStarts(): Promise<void> {
    renderSidebar(await startTestApp(""));

    expect(findItem("Home")).toHaveAttribute("href", "#/");
    expect(findItem("Tiles")).toHaveAttribute(
      "href",
      "#/run?mod=collection_explorer",
    );
    expect(findItem("Mods")).toHaveAttribute("href", "#/run?mod=mod_explorer");
    expect(findItem("Mosaics")).toHaveAttribute(
      "href",
      "#/run?mod=mosaic_explorer",
    );
    expect(findItem("Guides")).toHaveAttribute("href", "#/guides");
  });

  it("marks the active section's item as current", async function marksCurrent(): Promise<void> {
    const fixture = await startTestApp("#/guides");
    renderSidebar(fixture);
    expect(readCurrentItems()).toEqual(["Guides"]);

    fireEvent.click(findItem("Settings"));

    expect(readCurrentItems()).toEqual(["Settings"]);
    expect(fixture.history.hash).toBe("#/settings");
  });

  it("leaves a modified click to the browser", async function keepsModifiedClick(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);

    fireEvent.click(findItem("Settings"), { ctrlKey: true });

    expect(fixture.history.entries).toHaveLength(1);
  });

  it("Hamburger state", async function namesHamburger(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);
    const hamburger = screen.getByRole("button", { name: "Hide sidebar" });
    expect(hamburger).toHaveAttribute("aria-expanded", "true");
    expect(hamburger).toHaveAttribute("aria-controls", "app-sidebar-nav");
    expect(sectionsNav()).toHaveAttribute("id", "app-sidebar-nav");

    fireEvent.click(hamburger);

    expect(readSidebarSnapshot(fixture.layout).state).toBe("hidden");
    expect(hamburger).toHaveAttribute("aria-expanded", "false");
    expect(hamburger).toHaveAccessibleName("Show sidebar");
    expect(screen.queryByRole("navigation", { name: "Sections" })).toBeNull();
  });

  it("No app header", async function startsWithHeadingRow(): Promise<void> {
    renderSidebar(await startTestApp(""));

    const row = headingRow();
    const [button, heading] = Array.from(row.querySelectorAll("button, h1"));

    expect(sidebarAside().firstElementChild).toBe(row);
    expect(button).toHaveAccessibleName("Hide sidebar");
    expect(heading).toBe(
      screen.getByRole("heading", { level: 1, name: "OpenTesela" }),
    );
    expect(heading).not.toHaveClass("sr-only");
  });

  it("Heading in the rail", async function hidesHeadingText(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "OpenTesela",
    });

    expect(heading).toHaveClass("sr-only");
    expect(headingRow()).toContainElement(heading);
  });

  it("shrinks the hidden sidebar to the hamburger chip", async function rendersChip(): Promise<void> {
    const fixture = await startTestApp("");
    pressHamburger(fixture.layout);
    renderSidebar(fixture);

    const aside = sidebarAside();

    expect(aside).toBeVisible();
    expect(within(aside).getAllByRole("button")).toHaveLength(1);
    expect(within(aside).getByRole("button")).toHaveAccessibleName(
      "Show sidebar",
    );
    expect(within(aside).queryAllByRole("link")).toHaveLength(0);
    expect(within(aside).queryAllByRole("separator")).toHaveLength(0);
    expect(
      within(aside).getByRole("heading", { level: 1, name: "OpenTesela" }),
    ).toHaveClass("sr-only");
  });
});

describe("theme control", function describeThemeControl(): void {
  it("Below About", async function followsAbout(): Promise<void> {
    renderSidebar(await startTestApp(""));

    const rows = readRowTexts();

    expect(rows.slice(-2)).toEqual(["About", "Theme"]);
    expect(themeButton()).toHaveAccessibleName("Theme: System");
    expect(within(sectionsNav()).queryByRole("button")).toBeNull();
  });

  it("Tooltip in the rail", async function namesChoiceInRail(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    chooseTheme(fixture.appTheme, "dark");
    renderSidebar(fixture);

    act(function focusThemeControl(): void {
      themeButton().focus();
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Theme: Dark");
    expect(themeButton()).toHaveAccessibleName("Theme: Dark");
    expect(themeButton()).not.toHaveTextContent("Theme");
  });

  it("Tooltip when expanded", async function namesChoiceExpanded(): Promise<void> {
    const fixture = await startTestApp("");
    chooseTheme(fixture.appTheme, "light");
    renderSidebar(fixture);

    act(function focusThemeControl(): void {
      themeButton().focus();
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Theme: Light",
    );
    expect(themeButton()).toHaveTextContent("Theme");
  });

  it("Each press moves to the next choice", async function cyclesChoices(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);
    const names: string[] = [];
    const announcements: string[] = [];

    for (let press = 0; press < 3; press++) {
      fireEvent.click(themeButton());
      names.push(themeButton().getAttribute("aria-label") ?? "");
      announcements.push(
        sidebarAside().querySelector("[aria-live]")?.textContent ?? "",
      );
    }

    const expected = ["Theme: Light", "Theme: Dark", "Theme: System"];
    expect(names).toEqual(expected);
    expect(announcements).toEqual(expected);
    expect(fixture.appTheme.snapshot.choice).toBe("system");
  });

  it("is never the current item", async function isNeverCurrent(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    renderSidebar(fixture);

    fireEvent.click(themeButton());

    expect(fixture.appTheme.snapshot.choice).toBe("light");
    expect(themeButton()).not.toHaveAttribute("aria-current");
    expect(readCurrentItems()).toEqual(["Settings"]);
  });
});

describe("collapsed rail", function describeRail(): void {
  it("collapses with its button and expands again", async function togglesWithButtons(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(readSidebarSnapshot(fixture.layout).state).toBe("expanded");
  });

  it("keeps the label as the accessible name", async function namesRailItems(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);

    expect(findItem("Guides")).toHaveAccessibleName("Guides");
  });

  it("A coming-soon item's tooltip is in its accessible name", async function namesComingSoonInRail(): Promise<void> {
    const fixture = await startTestApp("", { sections: COMING_SOON_SECTIONS });
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);
    const example = findItem(/Example Section/);

    const tooltip = await readTooltipOnFocus(example);

    expect(tooltip).toBe("Example Section: Coming soon");
    expect(example).toHaveAccessibleName(tooltip);
  });

  it("Tooltip on focus", async function showsTooltipOnFocus(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);

    act(function focusGuides(): void {
      findItem("Guides").focus();
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guides");
  });

  it("Toggle with the keyboard", async function togglesWithShortcut(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
    fireEvent.keyDown(window, { key: "B", metaKey: true });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("expanded");
  });

  it("shows a hidden sidebar with the keyboard", async function showsHidden(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    pressHamburger(fixture.layout);
    renderSidebar(fixture);

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
  });

  it("leaves Ctrl+B to an editable field", async function ignoresFields(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);
    const field = document.createElement("input");
    document.body.append(field);

    fireEvent.keyDown(field, { key: "b", ctrlKey: true });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("expanded");
    field.remove();
  });
});

describe("narrow drawer", function describeDrawer(): void {
  it("Starts collapsed", async function startsAsRail(): Promise<void> {
    renderSidebar(await startTestApp("", { isNarrow: true }));

    expect(screen.queryByRole("separator")).toBeNull();
    expect(findItem("Guides").textContent).toBe("Guides");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape closes the drawer", async function closesOnEscape(): Promise<void> {
    const fixture = await startTestApp("", { isNarrow: true });
    renderSidebar(fixture);
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("link", { name: "Guides" })).toBeVisible();

    fireEvent.keyDown(drawer, { key: "Escape" });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Only the hamburger button: the drawer has no button named Close", async function hasNoCloseButton(): Promise<void> {
    const fixture = await startTestApp("", { isNarrow: true });
    expandSidebar(fixture.layout);
    renderSidebar(fixture);

    const drawer = screen.getByRole("dialog");

    expect(within(drawer).queryByRole("button", { name: "Close" })).toBeNull();
    expect(
      within(drawer).getByRole("button", { name: /sidebar/ }),
    ).toBeInTheDocument();
  });

  it("closes the drawer when a section is chosen", async function closesOnChoice(): Promise<void> {
    const fixture = await startTestApp("", { isNarrow: true });
    expandSidebar(fixture.layout);
    renderSidebar(fixture);

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Guides" }),
    );

    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
    expect(fixture.history.hash).toBe("#/guides");
  });
});

describe("SidebarResizeHandle", function describeResizeHandle(): void {
  it("Resize with the keyboard", async function resizesWithArrows(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(handle).toHaveAttribute("aria-valuenow", "240");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");

    fireEvent.keyDown(handle, { key: "ArrowRight" });

    expect(readSidebarSnapshot(fixture.layout).width).toBe(256);
    expect(handle).toHaveAttribute("aria-valuenow", "256");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "240");
  });

  it("collapses with Enter", async function collapsesWithEnter(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);

    fireEvent.keyDown(screen.getByRole("separator"), { key: "Enter" });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
  });

  it("Drag to collapse", async function collapsesWhileHeld(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    // jsdom lays nothing out: the sidebar measures 0px wide when the drag starts.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 });

    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120 });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("collapsed");
    expect(screen.getByRole("separator", { name: "Resize sidebar" })).toBe(
      handle,
    );
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300 });
    expect(readSidebarSnapshot(fixture.layout)).toMatchObject({
      state: "expanded",
      width: 300,
    });
  });

  it("is on the rail too, valued as collapsed", async function showsOnRail(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);

    const handle = screen.getByRole("separator", { name: "Resize sidebar" });

    expect(handle).toHaveAttribute("aria-valuenow", "0");
    expect(handle).toHaveAttribute("aria-valuetext", "Collapsed");
  });

  it("Expand with the keyboard", async function expandsWithArrow(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });

    expect(readSidebarSnapshot(fixture.layout)).toMatchObject({
      state: "expanded",
      width: 240,
    });
    expect(
      screen.getByRole("separator", { name: "Resize sidebar" }),
    ).toHaveAttribute("aria-valuenow", "240");
  });

  it("expands the rail with Enter", async function expandsWithEnter(): Promise<void> {
    const fixture = await startTestApp("");
    collapseSidebar(fixture.layout);
    renderSidebar(fixture);

    fireEvent.keyDown(screen.getByRole("separator"), { key: "Enter" });

    expect(readSidebarSnapshot(fixture.layout).state).toBe("expanded");
  });
});
