import { useEffect } from "react";
import { useEditorStore } from "./store/editorStore";
import { CodeMirrorEditor } from "./components/CodeMirrorEditor";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { StatusBar } from "./components/StatusBar";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

async function saveImpl() {
  const { currentFilePath: path, content, setDirty } = useEditorStore.getState();
  if (!path) {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const filePath = `${selected}/${useEditorStore.getState().currentFileName}`;
    try {
      await invoke("write_file_content", { path: filePath, content });
      useEditorStore.getState().setFilePath(filePath);
    } catch (e) {
      console.error("Failed to save:", e);
    }
    return;
  }
  try {
    await invoke("write_file_content", { path, content });
    setDirty(false);
  } catch (e) {
    console.error("Failed to save:", e);
  }
}

export default function App() {
  const { editorMode, theme } = useEditorStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === "s") { e.preventDefault(); saveImpl(); }
      if (cmd && e.key === "/") {
        e.preventDefault();
        useEditorStore.getState().setEditorMode(
          useEditorStore.getState().editorMode === "source" ? "preview" : "source"
        );
      }
    };
    document.addEventListener("keydown", onKey);

    const unlisten = listen<string>("menu-event", async (event) => {
      const store = useEditorStore.getState();
      switch (event.payload) {
        case "new_file": {
          const selected = await open({ directory: true, multiple: false });
          if (!selected) break;
          const filePath = `${selected}/untitled.md`;
          try {
            await invoke("create_new_file", { path: filePath });
            store.setContent("");
            store.setFilePath(filePath);
            store.setDirty(false);
          } catch (e) { console.error(e); }
          break;
        }
        case "open_file": {
          const selected = await open({ multiple: false, filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] });
          if (!selected) break;
          try {
            const content = await invoke<string>("read_file_content", { path: selected as string });
            store.setContent(content);
            store.setFilePath(selected as string);
            store.setDirty(false);
          } catch (e) { console.error(e); }
          break;
        }
        case "save": await saveImpl(); break;
        case "save_as": {
          const selected = await open({ directory: true, multiple: false });
          if (!selected) break;
          const filePath = `${selected}/${store.currentFileName}`;
          try {
            await invoke("write_file_content", { path: filePath, content: store.content });
            store.setFilePath(filePath);
          } catch (e) { console.error(e); }
          break;
        }
        case "toggle_mode":
          store.setEditorMode(store.editorMode === "source" ? "preview" : "source");
          break;
        case "toggle_theme": store.toggleTheme(); break;
      }
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{
      background: "var(--bg-primary)",
      position: "relative",
    }}>
      <div className="flex-1 overflow-hidden" style={{
        position: "relative",
      }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 200,
            background: "radial-gradient(ellipse at top, var(--accent-light), transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
          {editorMode === "source" ? <CodeMirrorEditor /> : <MarkdownPreview />}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
