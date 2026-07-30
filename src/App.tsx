import { useEffect, useState } from "react";
import { useEditorStore } from "./store/editorStore";
import { CodeMirrorEditor } from "./components/CodeMirrorEditor";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { StatusBar } from "./components/StatusBar";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { undo, redo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { renderMarkdown } from "./lib/markdown";
import { t } from "./lib/i18n";
import { rebuildMenu } from "./lib/menu";
import typoraCss from "./styles/typora.css?raw";

function getEditorView(): EditorView | null {
  return (window as any).__cmView ?? null;
}

// --- Reusable editor operations ---

async function doCopy(): Promise<void> {
  const view = getEditorView();
  if (view) {
    const { from, to } = view.state.selection.main;
    if (from !== to) {
      try { await writeText(view.state.doc.sliceString(from, to)); } catch (e) { console.error(e); }
    }
  } else {
    document.execCommand("copy");
  }
}

async function doCut(): Promise<void> {
  const view = getEditorView();
  if (view) {
    const { from, to } = view.state.selection.main;
    if (from !== to) {
      try {
        await writeText(view.state.doc.sliceString(from, to));
        view.dispatch({ changes: { from, to, insert: "" } });
        view.focus();
      } catch (e) { console.error(e); }
    }
  }
}

async function doPaste(): Promise<void> {
  const view = getEditorView();
  if (view) {
    try {
      const text = await readText();
      if (text) {
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      }
    } catch (e) { console.error(e); }
  }
}

function doSelectAll(): void {
  const view = getEditorView();
  if (view) {
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  } else {
    document.execCommand("selectAll");
  }
}

function doUndo(): void {
  const view = getEditorView();
  if (view) { undo(view); view.focus(); }
}

function doRedo(): void {
  const view = getEditorView();
  if (view) { redo(view); view.focus(); }
}

function doBold(): void {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  const selected = view.state.doc.sliceString(from, to);
  view.dispatch({
    changes: { from, to, insert: `**${selected}**` },
    selection: { anchor: from + 2, head: to + 2 },
  });
  view.focus();
}

function doItalic(): void {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  const selected = view.state.doc.sliceString(from, to);
  view.dispatch({
    changes: { from, to, insert: `*${selected}*` },
    selection: { anchor: from + 1, head: to + 1 },
  });
  view.focus();
}

function doLink(): void {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to) || "text";
  view.dispatch({
    changes: { from, to, insert: `[${selected}](url)` },
    selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
  });
  view.focus();
}

function editorHasSelection(): boolean {
  const view = getEditorView();
  return view ? view.state.selection.main.from !== view.state.selection.main.to : false;
}

function buildEditorMenuItems(): MenuItem[] {
  const hasSelection = editorHasSelection();
  return [
    { id: "cut", label: t("cut"), shortcut: "⌘X", disabled: !hasSelection },
    { id: "copy", label: t("copy"), shortcut: "⌘C", disabled: !hasSelection },
    { id: "paste", label: t("paste"), shortcut: "⌘V" },
    { id: "sep1", separator: true },
    { id: "select_all", label: t("selectAll"), shortcut: "⌘A" },
    { id: "sep2", separator: true },
    { id: "undo", label: t("undo"), shortcut: "⌘Z" },
    { id: "redo", label: t("redo"), shortcut: "⌘⇧Z" },
    { id: "sep3", separator: true },
    { id: "bold", label: t("bold"), shortcut: "⌘B" },
    { id: "italic", label: t("italic"), shortcut: "⌘I" },
    { id: "link", label: t("insertLink"), shortcut: "⌘K" },
  ];
}

function buildPreviewMenuItems(): MenuItem[] {
  const hasSelection = (window.getSelection()?.toString().length ?? 0) > 0;
  return [
    { id: "copy", label: t("copy"), shortcut: "⌘C", disabled: !hasSelection },
    { id: "sep1", separator: true },
    { id: "select_all", label: t("selectAll"), shortcut: "⌘A" },
  ];
}

async function handleContextAction(id: string): Promise<void> {
  switch (id) {
    case "copy": await doCopy(); break;
    case "cut": await doCut(); break;
    case "paste": await doPaste(); break;
    case "select_all": doSelectAll(); break;
    case "undo": doUndo(); break;
    case "redo": doRedo(); break;
    case "bold": doBold(); break;
    case "italic": doItalic(); break;
    case "link": doLink(); break;
  }
}

function buildExportedHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</title>
<style>
${typoraCss}
body { padding: 40px 60px; max-width: 860px; margin: 0 auto; background: #fff; color: #1f2328; }
</style>
</head>
<body>
<div class="typora-content">
${bodyHtml}
</div>
</body>
</html>`;
}

async function exportHtml(): Promise<void> {
  const { content, currentFileName } = useEditorStore.getState();
  const defaultName = currentFileName.replace(/\.(md|markdown)$/i, "") + ".html";
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: "HTML", extensions: ["html", "htm"] }],
  });
  if (!selected) return;
  const body = renderMarkdown(content);
  const full = buildExportedHtml(currentFileName, body);
  try {
    await invoke("write_file_content", { path: selected, content: full });
  } catch (e) {
    console.error("Failed to export HTML:", e);
  }
}

function exportPdf(): void {
  const { content, currentFileName } = useEditorStore.getState();
  const body = renderMarkdown(content);
  const html = buildExportedHtml(currentFileName, body);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  };
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print failed:", e);
    }
    cleanup();
  };
}

async function saveImpl() {
  const { currentFilePath: path, content, setDirty, currentFileName } = useEditorStore.getState();
  if (!path) {
    const selected = await save({
      defaultPath: currentFileName,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (!selected) return false;
    try {
      await invoke("write_file_content", { path: selected, content });
      useEditorStore.getState().setFilePath(selected);
      return true;
    } catch (e) {
      console.error("Failed to save:", e);
      return false;
    }
  }
  try {
    await invoke("write_file_content", { path, content });
    setDirty(false);
    return true;
  } catch (e) {
    console.error("Failed to save:", e);
    return false;
  }
}

async function confirmDiscardIfDirty(): Promise<boolean> {
  const { isDirty, currentFileName } = useEditorStore.getState();
  if (!isDirty) return true;
  const yes = await ask(
    t("unsavedMsg")(currentFileName),
    { title: t("unsavedTitle"), kind: "warning", okLabel: t("save"), cancelLabel: t("discard") }
  );
  if (yes) {
    return await saveImpl();
  }
  return true;
}

async function openFileFromPath(path: string): Promise<void> {
  if (!(await confirmDiscardIfDirty())) return;
  try {
    const content = await invoke<string>("read_file_content", { path });
    const store = useEditorStore.getState();
    store.setContent(content);
    store.setFilePath(path);
    store.setDirty(false);
  } catch (e) {
    console.error("Failed to open file:", e);
  }
}

export default function App() {
  const { editorMode, theme, isDirty } = useEditorStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setContextMenu(null);
  }, [editorMode]);

  // Restore last session (file + UI prefs), build native menu, then persist on change
  useEffect(() => {
    try {
      const raw = localStorage.getItem("markora:session");
      if (raw) {
        const s = JSON.parse(raw);
        const store = useEditorStore.getState();
        if (s.theme) store.setTheme(s.theme);
        if (s.lang) store.setLang(s.lang);
        if (s.editorMode) store.setEditorMode(s.editorMode);
        if (s.currentFilePath) {
          // reopen the file only if no CLI/dropped file is pending
          invoke<string[]>("take_pending_files").then(async (pending) => {
            if (!pending || pending.length === 0) {
              try {
                const content = await invoke<string>("read_file_content", { path: s.currentFilePath });
                const st = useEditorStore.getState();
                st.setContent(content);
                st.setFilePath(s.currentFilePath);
                st.setDirty(false);
              } catch { /* file gone */ }
            } else {
              for (const p of pending) {
                try { await openFileFromPath(p); break; } catch {}
              }
            }
          }).catch(() => {});
        }
      }
    } catch {}

    // JS 接管原生菜单（语言切换时重建）
    rebuildMenu().catch((e) => console.error("build menu failed:", e));

    const unsub = useEditorStore.subscribe((s) => {
      try {
        localStorage.setItem("markora:session", JSON.stringify({
          currentFilePath: s.currentFilePath,
          theme: s.theme,
          lang: s.lang,
          editorMode: s.editorMode,
        }));
      } catch {}
    });
    return unsub;
  }, []);

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

    // shared handler for native menu events (from Rust menu or JS-rebuilt menu)
    const handleMenuId = async (id: string) => {
      const store = useEditorStore.getState();
      switch (id) {
        case "new_file": {
          if (!(await confirmDiscardIfDirty())) break;
          const selected = await save({
            defaultPath: "untitled.md",
            filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
          });
          if (!selected) break;
          try {
            await invoke("create_new_file", { path: selected });
            store.setContent("");
            store.setFilePath(selected);
            store.setDirty(false);
          } catch (e) { console.error(e); }
          break;
        }
        case "open_file": {
          if (!(await confirmDiscardIfDirty())) break;
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
          const selected = await save({
            defaultPath: store.currentFileName,
            filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
          });
          if (!selected) break;
          try {
            await invoke("write_file_content", { path: selected, content: store.content });
            store.setFilePath(selected);
          } catch (e) { console.error(e); }
          break;
        }
        case "toggle_mode":
          store.setEditorMode(store.editorMode === "source" ? "preview" : "source");
          break;
        case "toggle_theme": store.toggleTheme(); break;
        case "toggle_focus": store.toggleFocusMode(); break;
        case "toggle_lang": {
          store.setLang(store.lang === "zh" ? "en" : "zh");
          try { await rebuildMenu(); } catch (e) { console.error("rebuild menu failed:", e); }
          break;
        }
        case "close_requested": {
          if (await confirmDiscardIfDirty()) {
            try { await invoke("confirm_close"); } catch (e) { console.error(e); }
          }
          break;
        }
        case "copy": await doCopy(); break;
        case "cut": await doCut(); break;
        case "paste": await doPaste(); break;
        case "select_all": doSelectAll(); break;
        case "undo": doUndo(); break;
        case "redo": doRedo(); break;
        case "export_html": await exportHtml(); break;
        case "export_pdf": exportPdf(); break;
      }
    };

    // from Rust native menu (initial)
    const unlisten = listen<string>("menu-event", (e) => { void handleMenuId(e.payload); });
    // from JS-rebuilt menu (after language switch)
    const onNativeMenu = (e: Event) => { void handleMenuId((e as CustomEvent<string>).detail); };
    window.addEventListener("native-menu", onNativeMenu);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("native-menu", onNativeMenu);
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle files dropped onto the window and files queued from CLI / OS "Open with…"
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pending = await invoke<string[]>("take_pending_files");
        if (!cancelled && pending && pending.length > 0) {
          await openFileFromPath(pending[0]);
        }
      } catch (e) {
        console.error(e);
      }
    })();

    const unlistenDrop = listen<string[]>("files-dropped", async (event) => {
      const paths = event.payload;
      if (paths && paths.length > 0) {
        await openFileFromPath(paths[0]);
      }
    });

    return () => {
      cancelled = true;
      unlistenDrop.then((fn) => fn());
    };
  }, []);

  // Auto-save: 1.5s after the last edit, if we have a file path and there are unsaved changes
  useEffect(() => {
    let timer: number | null = null;
    const scheduleSave = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const { isDirty, currentFilePath, content, setDirty } = useEditorStore.getState();
        if (isDirty && currentFilePath) {
          try {
            await invoke("write_file_content", { path: currentFilePath, content });
            setDirty(false);
          } catch (e) {
            console.error("Auto-save failed:", e);
          }
        }
      }, 1500);
    };

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.content !== prev.content && state.isDirty && state.currentFilePath) {
        scheduleSave();
      }
    });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const mode = useEditorStore.getState().editorMode;
    const items = mode === "source" ? buildEditorMenuItems() : buildPreviewMenuItems();
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

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
        <div
          style={{ position: "relative", zIndex: 1, height: "100%" }}
          onContextMenu={handleContextMenu}
        >
          {editorMode === "source" ? <CodeMirrorEditor /> : <MarkdownPreview />}
          {isDirty && (
            <div
              title={t("unsavedTitle")}
              style={{
                position: "absolute",
                top: 14,
                right: 18,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 0 3px var(--accent-light)",
                zIndex: 20,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
      <StatusBar />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onItemClick={(id) => { void handleContextAction(id); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
