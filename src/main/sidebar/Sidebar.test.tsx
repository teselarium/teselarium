import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { readStageSnapshot } from "../../lib/core/stage/index.ts";
import { startTestApp } from "../../test/test_app.ts";
import type { AppFixture } from "../../test/test_app.ts";
import type { SectionDefinition } from "../sections/section_registry.ts";
import { VANILLA_SECTIONS } from "../sections/vanilla_sections.ts";
import { HamburgerButton } from "./HamburgerButton.tsx";
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
      <HamburgerButton layout={fixture.layout} />
      <Sidebar
        stage={fixture.stage}
        sections={fixture.sections}
        switches={fixture.switches}
        layout={fixture.layout}
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
      "MosaicsComing soon",
      "Guides",
    ]);
    expect(readItemNames(lists[1])).toEqual(["Settings", "About"]);
  });

  it("Lucide icon", async function showsLucideIcons(): Promise<void> {
    renderSidebar(await startTestApp(""));

    for (const item of within(sectionsNav()).getAllByRole("link")) {
      const icon = item.firstElementChild;
      expect(icon?.tagName.toLowerCase()).toBe("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    expect(findItem("Mods")).toHaveAccessibleName("Mods");
  });

  it("Full-color image", async function showsOwnColors(): Promise<void> {
    const sections = withIcon({ image: "./icons/guides.png", tint: false });
    renderSidebar(await startTestApp("", { sections }));

    const icon = findItem("Guides").firstElementChild;

    expect(icon?.tagName).toBe("IMG");
    expect(icon).toHaveAttribute("src", "./icons/guides.png");
    expect(findItem("Guides")).toHaveAccessibleName("Guides");
  });

  it("draws a tinted image with the text color", async function tintsImage(): Promise<void> {
    const sections = withIcon({ image: "./icons/guides.svg" });
    renderSidebar(await startTestApp("", { sections }));

    const icon = findItem("Guides").firstElementChild as HTMLElement;

    expect(icon.tagName).toBe("SPAN");
    expect(icon.style.backgroundColor).toBe("currentcolor");
    expect(icon.style.maskImage).toContain("./icons/guides.svg");
  });

  it("Mosaics is coming soon", async function disablesMosaics(): Promise<void> {
    const fixture = await startTestApp("");
    renderSidebar(fixture);
    const mosaics = findItem(/Mosaics/);
    const visibleBefore = readStageSnapshot(fixture.stage).visible;

    fireEvent.click(mosaics);

    expect(mosaics).toHaveAttribute("aria-disabled", "true");
    expect(mosaics).not.toHaveAttribute("href");
    expect(mosaics).toHaveTextContent("Coming soon");
    expect(fixture.history.entries).toHaveLength(1);
    expect(readStageSnapshot(fixture.stage).visible).toEqual(visibleBefore);
  });

  it("gives each item its section's start address", async function linksStarts(): Promise<void> {
    renderSidebar(await startTestApp(""));

    expect(findItem("Home")).toHaveAttribute("href", "#/");
    expect(findItem("Tiles")).toHaveAttribute(
      "href",
      "#/run?mod=collection_explorer",
    );
    expect(findItem("Mods")).toHaveAttribute("href", "#/run?mod=mod_explorer");
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
    expect(hamburger).toHaveAttribute("aria-controls", "app-sidebar");

    fireEvent.click(hamburger);

    expect(readSidebarSnapshot(fixture.layout).state).toBe("hidden");
    expect(hamburger).toHaveAttribute("aria-expanded", "false");
    expect(hamburger).toHaveAccessibleName("Show sidebar");
    expect(screen.queryByRole("navigation", { name: "Sections" })).toBeNull();
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
