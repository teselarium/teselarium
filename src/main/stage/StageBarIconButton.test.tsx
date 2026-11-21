import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { readTooltipOnFocus } from "../../test/tooltip_texts.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

describe("StageBarIconButton", function describeStageBarIconButton(): void {
  it("Its tooltip's text is its accessible name", async function namesWithTooltip(): Promise<void> {
    render(
      <TooltipProvider>
        <StageBarIconButton label="Theater mode">T</StageBarIconButton>
      </TooltipProvider>,
    );
    const button = screen.getByRole("button", { name: "Theater mode" });

    const tooltip = await readTooltipOnFocus(button);

    expect(tooltip).toBe("Theater mode");
    expect(button).toHaveAccessibleName(tooltip);
  });
});
