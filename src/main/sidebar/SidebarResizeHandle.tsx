import { useRef } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement } from "react";
import {
  dragSidebar,
  stepSidebarWidth,
  toggleSidebar,
} from "./sidebar_layout.ts";
import type { SidebarLayoutStore } from "./sidebar_layout.ts";

interface SidebarResizeHandleProps {
  layout: SidebarLayoutStore;
  /** The expanded sidebar's width, clamped. */
  width: number;
  /** The widest the viewport allows. */
  maxWidth: number;
  /** On the rail, a drag or the right arrow key expands the sidebar. */
  isCollapsed: boolean;
}

/** Where a drag started: the pointer's x and the sidebar's width then. */
interface DragStart {
  pointerX: number;
  width: number;
}

/** Arrow keys change the width by this much. */
const WIDTH_STEP = 16;

/** Set on `<body>` while dragging: frames take no pointer events (see app.css). */
const RESIZING_ATTRIBUTE = "data-sidebar-resizing";

function readDraggedWidth(start: DragStart, pointerX: number): number {
  return start.width + pointerX - start.pointerX;
}

function markResizing(isResizing: boolean): void {
  document.body.toggleAttribute(RESIZING_ATTRIBUTE, isResizing);
}

/** The sidebar's width as drawn when a drag starts: the expanded width, or the rail's. */
function readDrawnWidth(handle: HTMLElement): number {
  const sidebar = handle.closest("aside");
  return sidebar === null ? 0 : sidebar.getBoundingClientRect().width;
}

/**
 * The sidebar's right edge, expanded or collapsed: a focusable separator.
 * Dragging it sets the width; while it is held, the sidebar collapses as soon
 * as it is narrower than 160px and expands again at 160px or wider, and the
 * release keeps that state. The arrow keys change the width by 16px (the
 * right one expands the rail), and Enter collapses or expands the sidebar.
 * While dragging, the pointer is captured and frames take no pointer events,
 * so a frame under the pointer cannot take the drag in browsers whose capture
 * does not cross frames. The handle stays mounted when the sidebar collapses
 * or expands, so the capture survives it.
 */
export function SidebarResizeHandle({
  layout,
  width,
  maxWidth,
  isCollapsed,
}: SidebarResizeHandleProps): ReactElement {
  const dragStart = useRef<DragStart | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerX: event.clientX,
      width: readDrawnWidth(event.currentTarget),
    };
    markResizing(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (dragStart.current === null) {
      return;
    }
    dragSidebar(layout, readDraggedWidth(dragStart.current, event.clientX));
  }

  /** A release keeps the state the drag reached: the last move already applied it. */
  function handleDragEnd(): void {
    dragStart.current = null;
    markResizing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      stepSidebarWidth(
        layout,
        event.key === "ArrowRight" ? WIDTH_STEP : -WIDTH_STEP,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggleSidebar(layout);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={0}
      aria-valuemax={maxWidth}
      aria-valuenow={isCollapsed ? 0 : width}
      aria-valuetext={isCollapsed ? "Collapsed" : `${width} pixels`}
      tabIndex={0}
      className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-sidebar-border focus-visible:bg-ring"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
      onLostPointerCapture={handleDragEnd}
      onKeyDown={handleKeyDown}
    />
  );
}
