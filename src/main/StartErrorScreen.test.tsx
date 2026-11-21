import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StartErrorScreen } from "./StartErrorScreen.tsx";

const REGISTRY_TITLE = "The app cannot start: the section registry is invalid";
const CATALOG_TITLE = "The app cannot start: the instance catalog is invalid";
const REGISTRY_ERROR =
  'Section "run": the id "run" is reserved for run links (#/run?mod=...).';
const CATALOG_ERROR =
  'Instance catalog collections: "" is empty: an entry must be a non-empty string.';

function findAlertTitled(title: string): HTMLElement {
  for (const alert of screen.getAllByRole("alert")) {
    if (within(alert).queryByText(title) !== null) {
      return alert;
    }
  }
  throw new Error(`Expected an alert titled "${title}"`);
}

describe("StartErrorScreen", function describeStartErrorScreen(): void {
  it("lists the registry's errors under the registry's title", function showsRegistryErrors(): void {
    render(
      <StartErrorScreen registryErrors={[REGISTRY_ERROR]} catalogErrors={[]} />,
    );

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(findAlertTitled(REGISTRY_TITLE)).toHaveTextContent(REGISTRY_ERROR);
    expect(screen.queryByText(CATALOG_TITLE)).toBeNull();
  });

  it("lists the instance catalog's errors under its title", function showsInstanceCatalogErrors(): void {
    render(
      <StartErrorScreen registryErrors={[]} catalogErrors={[CATALOG_ERROR]} />,
    );

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(findAlertTitled(CATALOG_TITLE)).toHaveTextContent(CATALOG_ERROR);
    expect(screen.queryByText(REGISTRY_TITLE)).toBeNull();
  });

  it("lists both under their own titles", function showsBoth(): void {
    render(
      <StartErrorScreen
        registryErrors={[REGISTRY_ERROR]}
        catalogErrors={[CATALOG_ERROR]}
      />,
    );

    const registryAlert = findAlertTitled(REGISTRY_TITLE);
    const catalogAlert = findAlertTitled(CATALOG_TITLE);
    expect(registryAlert).toHaveTextContent(REGISTRY_ERROR);
    expect(registryAlert).not.toHaveTextContent(CATALOG_ERROR);
    expect(catalogAlert).toHaveTextContent(CATALOG_ERROR);
    expect(catalogAlert).not.toHaveTextContent(REGISTRY_ERROR);
  });
});
