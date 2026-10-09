import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", function describeApp(): void {
  it("renders the OpenTesela title", function rendersTitle(): void {
    render(<App />);

    const title = screen.getByRole("heading", { name: "OpenTesela" });

    expect(title).toBeInTheDocument();
  });
});
