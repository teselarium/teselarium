import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { readTooltipOnFocus } from "../../test/tooltip_texts.ts";
import {
  CAPSULE_MIN_WIDTH_CLASS,
  CombinationCapsule,
  ICONS_ONLY_MIN_WIDTH_CLASS,
} from "./CombinationCapsule.tsx";

describe("CombinationCapsule", function describeCombinationCapsule(): void {
  it("Its tooltip's text is its accessible name, and its opening tells the intent", async function namesWithTooltip(): Promise<void> {
    const onIntent = vi.fn<() => void>();
    render(
      <TooltipProvider>
        <CombinationCapsule
          kind="Mod"
          icon={null}
          title="Country Map"
          shrink={1}
          onIntent={onIntent}
        />
      </TooltipProvider>,
    );
    const capsule = screen.getByRole("button", {
      name: "Mod: Country Map",
    });

    const tooltip = await readTooltipOnFocus(capsule);

    expect(tooltip).toBe("Mod: Country Map");
    expect(capsule).toHaveAccessibleName(tooltip);
    expect(onIntent).toHaveBeenCalledOnce();
  });

  it("is never narrower than its icon and chevron, with its title shown", function keepsMinimumWithTitle(): void {
    render(
      <TooltipProvider>
        <CombinationCapsule
          kind="Mosaic"
          icon={null}
          title="Nobel laureates on the map"
          shrink={1}
        />
      </TooltipProvider>,
    );
    const capsule = screen.getByRole("button", { name: /^Mosaic: / });

    expect(capsule).toHaveClass(CAPSULE_MIN_WIDTH_CLASS);
    expect(capsule).not.toHaveClass(ICONS_ONLY_MIN_WIDTH_CLASS);
    expect(capsule).not.toHaveClass("min-w-0");
  });

  it("allows one gap less when its title is hidden on a narrow bar", function keepsMinimumIconsOnly(): void {
    render(
      <TooltipProvider>
        <CombinationCapsule
          kind="Collection"
          icon={null}
          title="Nobel Prize in Literature laureates"
          shrink={3}
          hidesTitleWhenNarrow
        />
      </TooltipProvider>,
    );
    const capsule = screen.getByRole("button", { name: /^Collection: / });

    expect(capsule).toHaveClass(CAPSULE_MIN_WIDTH_CLASS);
    expect(capsule).toHaveClass(ICONS_ONLY_MIN_WIDTH_CLASS);
  });
});
