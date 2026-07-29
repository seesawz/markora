import { useEffect } from "react";
import { useEditorStore } from "./store/editorStore";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { CodeMirrorEditor } from "./components/CodeMirrorEditor";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { StatusBar } from "./components/StatusBar";
import { ResizeDivider } from "./components/ResizeDivider";

export default function App() {
  const {
    sidebarVisible,
    editorMode,
    theme,
    statusBarVisible,
    toggleSidebar,
    setEditorMode,
  } = useEditorStore();

  // Apply theme class to root
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;

      if (cmd && e.key === "s") {
        e.preventDefault();
        // Trigger save via custom event
        document.dispatchEvent(new CustomEvent("app:save"));
      }

      if (cmd && e.key === "b") {
        e.preventDefault();
        // Trigger bold via custom event
        document.dispatchEvent(new CustomEvent("app:bold"));
      }

      if (cmd && e.key === "i") {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("app:italic"));
      }

      if (cmd && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }

      if (cmd && e.key === "/") {
        e.preventDefault();
        setEditorMode(editorMode === "source" ? "preview" : "source");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editorMode, toggleSidebar, setEditorMode]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {sidebarVisible && (
          <>
            <Sidebar />
            <ResizeDivider />
          </>
        )}

        <div className="flex-1 overflow-hidden" style={{ background: "var(--typora-bg)" }}>
          {editorMode === "source" ? <CodeMirrorEditor /> : <MarkdownPreview />}
        </div>
      </div>

      {statusBarVisible && <StatusBar />}
    </div>
  );
}
