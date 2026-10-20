import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { startTestStage } from "./test/test_stages.ts";

describe("App", function describeApp(): void {
  it("renders the OpenTesela title", async function rendersTitle(): Promise<void> {
    const stage = await startTestStage("");
    render(<App stage={stage} />);

    const title = screen.getByRole("heading", { name: "OpenTesela" });

    expect(title).toBeInTheDocument();
  });

  it("No hash", async function rendersHomeMod(): Promise<void> {
    const stage = await startTestStage("");
    render(<App stage={stage} />);

    expect(
      screen.getByRole("heading", { name: "OpenTesela" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Book List").tagName).toBe("IFRAME");
  });
});
