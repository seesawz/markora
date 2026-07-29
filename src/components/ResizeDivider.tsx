import { useRef, useCallback } from "react";
import { useEditorStore } from "../store/editorStore";

export function ResizeDivider() {
  const { setSidebarWidth, sidebarWidth } = useEditorStore();
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = sidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX.current;
        setSidebarWidth(startWidth.current + delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth, setSidebarWidth]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 cursor-col-resize flex-shrink-0 transition-colors"
      style={{
        background: "var(--border-secondary)",
        marginLeft: "-1px",
        zIndex: 10,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--border-secondary)")}
    />
  );
}
