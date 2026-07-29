import { useEditorStore } from "../store/editorStore";
import {
  PanelLeft,
  Eye,
  Code2,
  Sun,
  Moon,
  FolderOpen,
  FilePlus,
  Save,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

export function TitleBar() {
  const {
    sidebarVisible,
    toggleSidebar,
    editorMode,
    setEditorMode,
    theme,
    toggleTheme,
    currentFileName,
    isDirty,
    currentFilePath,
    setContent,
    setFilePath,
    setFileTreeRoot,
  } = useEditorStore();

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleSave = () => handleSaveImpl();
    document.addEventListener("app:save", handleSave);
    return () => document.removeEventListener("app:save", handleSave);
  }, []);

  const handleOpenFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setFileTreeRoot(selected as string);
    }
  };

  const handleNewFile = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      const fileName = "untitled.md";
      const filePath = `${selected}/${fileName}`;
      try {
        await invoke("create_new_file", { path: filePath });
        setContent("");
        setFilePath(filePath);
      } catch (e) {
        console.error("Failed to create file:", e);
      }
    }
  };

  const handleSaveImpl = async () => {
    if (!currentFilePath) {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const filePath = `${selected}/${currentFileName}`;
        try {
          setSaving(true);
          await invoke("write_file_content", { path: filePath, content: useEditorStore.getState().content });
          setFilePath(filePath);
        } catch (e) {
          console.error("Failed to save:", e);
        } finally {
          setSaving(false);
        }
      }
      return;
    }

    try {
      setSaving(true);
      await invoke("write_file_content", {
        path: currentFilePath,
        content: useEditorStore.getState().content,
      });
      useEditorStore.getState().setDirty(false);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-12 px-2 select-none"
      style={{
        background: "var(--titlebar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-secondary)",
      }}
    >
      {/* Space for macOS traffic lights */}
      <div style={{ width: 72, flexShrink: 0 }} />

      {/* Left toolbar */}
      <div className="flex items-center gap-0.5 no-drag">
        <IconButton onClick={toggleSidebar} active={sidebarVisible} title="Toggle Sidebar (Cmd+\)">
          <PanelLeft size={18} />
        </IconButton>
        <IconButton onClick={handleOpenFolder} title="Open Folder">
          <FolderOpen size={17} />
        </IconButton>
        <IconButton onClick={handleNewFile} title="New File">
          <FilePlus size={17} />
        </IconButton>
        <IconButton onClick={handleSaveImpl} title="Save (Cmd+S)" disabled={saving}>
          <Save size={17} />
        </IconButton>
      </div>

      {/* Center: file name */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <span
          className="text-[13px] font-medium truncate max-w-md"
          style={{ color: "var(--text-secondary)" }}
        >
          {isDirty && <span style={{ color: "var(--accent)" }}>● </span>}
          {currentFileName}
          {!currentFilePath && <span style={{ color: "var(--text-tertiary)" }}> (unsaved)</span>}
        </span>
      </div>

      {/* Right: mode + theme */}
      <div className="flex items-center gap-0.5 no-drag">
        <SegmentedControl>
          <SegmentButton
            active={editorMode === "source"}
            onClick={() => setEditorMode("source")}
            title="Source Mode (Cmd+/)"
          >
            <Code2 size={15} />
          </SegmentButton>
          <SegmentButton
            active={editorMode === "preview"}
            onClick={() => setEditorMode("preview")}
            title="Preview Mode (Cmd+/)"
          >
            <Eye size={15} />
          </SegmentButton>
        </SegmentedControl>
        <div className="w-px h-5 mx-1.5" style={{ background: "var(--border-primary)" }} />
        <IconButton onClick={toggleTheme} title="Toggle Theme">
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center w-9 h-8 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? "var(--bg-active)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
        } else {
          e.currentTarget.style.background = "var(--bg-active)";
          e.currentTarget.style.color = "var(--accent)";
        }
      }}
    >
      {children}
    </button>
  );
}

function SegmentedControl({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center p-0.5 rounded-lg"
      style={{ background: "var(--bg-tertiary)" }}
    >
      {children}
    </div>
  );
}

function SegmentButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-8 h-7 rounded-md transition-all"
      style={{
        background: active ? "var(--bg-elevated)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-tertiary)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = "var(--text-secondary)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = "var(--text-tertiary)";
      }}
    >
      {children}
    </button>
  );
}
