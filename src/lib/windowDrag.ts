import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";

const INTERACTIVE_SELECTOR = "button, input, textarea, select, a, [role='tab'], [contenteditable='true'], [draggable='true']";

export function handleWindowDragMouseDown(event: MouseEvent<HTMLElement>): void {
  if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest(INTERACTIVE_SELECTOR)) return;

  event.preventDefault();
  event.stopPropagation();
  void getCurrentWindow().startDragging().catch((error) => console.error("window drag failed:", error));
}
