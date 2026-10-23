import type { CSSProperties, ReactElement } from "react";
import type { SectionIcon as SectionIconDefinition } from "../sections/section_registry.ts";

interface SectionIconProps {
  icon: SectionIconDefinition;
}

const ICON_CLASS = "size-5 shrink-0";

/** An image drawn in the text color: the image is the mask of a `currentColor` box. */
function renderTintedImage(image: string): ReactElement {
  const maskImage = `url("${image}")`;
  const style: CSSProperties = {
    maskImage,
    WebkitMaskImage: maskImage,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    backgroundColor: "currentColor",
  };
  return (
    <span
      className={`${ICON_CLASS} inline-block`}
      style={style}
      aria-hidden="true"
      data-section-icon="tinted"
    />
  );
}

/**
 * A section's icon, before its label: a lucide icon, an image tinted with the
 * item's text color, or, with `tint: false`, the image in its own colors.
 * Always decorative: the label names the item.
 */
export function SectionIcon({ icon }: SectionIconProps): ReactElement {
  if ("lucide" in icon) {
    const LucideIcon = icon.lucide;
    return <LucideIcon className={ICON_CLASS} aria-hidden="true" />;
  }
  if (icon.tint === false) {
    return (
      <img className={ICON_CLASS} src={icon.image} alt="" aria-hidden="true" />
    );
  }
  return renderTintedImage(icon.image);
}
