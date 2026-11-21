import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/** The sidebar's navigation. The drawer of a narrow viewport has its own. */
export function sectionsNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Sections" });
}

/** The item of a section in the sidebar. A coming-soon item's name also says so. */
export function sectionItem(page: Page, name: string | RegExp): Locator {
  return sectionsNav(page).getByRole("link", { name });
}

/** The sidebar's item marked current, if any. */
export function currentItem(page: Page): Locator {
  return sectionsNav(page).locator('[aria-current="page"]');
}

export function sidebar(page: Page): Locator {
  return page.locator("#app-sidebar");
}

/** The sidebar's section items and Theme control, which scroll when they do not fit. */
export function sidebarItems(page: Page): Locator {
  return sidebar(page).locator("[data-sidebar-items]");
}

/** The sidebar's first row: the hamburger button and the app's name. */
export function sidebarHeadingRow(page: Page): Locator {
  return sidebar(page).locator("[data-sidebar-heading-row]");
}

export function hamburgerButton(page: Page): Locator {
  return sidebarHeadingRow(page).getByRole("button", { name: /sidebar/ });
}

/** The sidebar's Theme control, named after the current choice. */
export function sidebarThemeButton(page: Page): Locator {
  return sidebar(page).getByRole("button", { name: /^Theme: / });
}

export function resizeHandle(page: Page): Locator {
  return page.getByRole("separator", { name: "Resize sidebar" });
}

/** The body of the markdown page shown, inside its shadow root (Playwright's locators pierce it). */
export function pageBody(page: Page): Locator {
  return page.locator("[data-page-host] .page-body");
}

/** Activates a section from the sidebar, as a user clicks its item. */
export async function openSection(page: Page, name: string): Promise<void> {
  await sectionItem(page, name).click();
}

/** Opens Mods from the sidebar and waits for the explorer's stage bar. */
export async function openModsSection(page: Page): Promise<void> {
  await openSection(page, "Mods");
  await expect(page.getByRole("region", { name: "Stage bar" })).toContainText(
    "Mods",
  );
}

/** Runs in the page: the sidebar's width in pixels. */
export function readSidebarWidth(): number {
  return (
    document.getElementById("app-sidebar")?.getBoundingClientRect().width ?? 0
  );
}
