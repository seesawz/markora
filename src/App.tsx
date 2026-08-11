import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "./store/editorStore";
import { TipTapEditor } from "./components/TipTapEditor";
import { StatusBar } from "./components/StatusBar";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { renderMarkdown, resolveLocalImages } from "./lib/markdown";
import { t } from "./lib/i18n";
import { rebuildMenu } from "./lib/menu";
import { completeAi, normalizeAiText } from "./lib/ai";
import { getSelectedDomText, getSelectedText, getTextInputPasteTarget, insertTextAtSelection, trackTextInputFocus } from "./lib/inputOps";
import { useAiStore } from "./store/aiStore";
import { useWorkspaceStore, type WorkspaceFile } from "./store/workspaceStore";
import { forgetSpot, rememberSpot } from "./lib/cursorMemory";
import { AiCommandModal, type AiCommandStatus } from "./components/AiCommandModal";
import { SettingsModal } from "./components/SettingsModal";
import { FileTree } from "./components/FileTree";
import { TabBar } from "./components/TabBar";
import { QuickSwitcher, type QuickFile } from "./components/QuickSwitcher";
import { PanelLeft } from "lucide-react";
import typoraCss from "./styles/typora.css?raw";

// --- 编辑器操作(基于 TipTap,通过 window.__tiptapEditor 访问) ---

function getEditor(): any {
  return (window as any).__tiptapEditor ?? null;
}

async function doCopy(): Promise<void> {
  const input = getTextInputPasteTarget();
  if (input) {
    const text = getSelectedText(input);
    if (text) {
      try { await writeText(text); } catch (e) { console.error(e); }
      return;
    }
  }
  const domText = getSelectedDomText();
  if (domText) {
    try { await writeText(domText); } catch (e) { console.error(e); }
    return;
  }
  const editor = getEditor();
  if (editor) {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const text = editor.state.doc.textBetween(from, to);
      try { await writeText(text); } catch (e) { console.error(e); }
    }
  } else {
    document.execCommand("copy");
  }
}

async function doCut(): Promise<void> {
  const input = getTextInputPasteTarget();
  if (input) {
    const text = getSelectedText(input);
    if (text) {
      try {
        await writeText(text);
        insertTextAtSelection(input, "");
      } catch (e) { console.error(e); }
    }
    return;
  }
  const editor = getEditor();
  if (editor) {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const text = editor.state.doc.textBetween(from, to);
      try {
        await writeText(text);
        editor.chain().focus().deleteSelection().run();
      } catch (e) { console.error(e); }
    }
  }
}

async function doPaste(): Promise<void> {
  const input = getTextInputPasteTarget();
  if (input) {
    try {
      insertTextAtSelection(input, await readText());
      input.focus();
    } catch (e) { console.error(e); }
    return;
  }
  const editor = getEditor();
  if (editor) {
    try {
      const text = await readText();
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }
    } catch (e) { console.error(e); }
  }
}

function doSelectAll(): void {
  const editor = getEditor();
  if (editor) {
    editor.chain().focus().selectAll().run();
  } else {
    document.execCommand("selectAll");
  }
}

function doUndo(): void {
  const editor = getEditor();
  if (editor) editor.chain().focus().undo().run();
}

function doRedo(): void {
  const editor = getEditor();
  if (editor) editor.chain().focus().redo().run();
}

function doBold(): void {
  const editor = getEditor();
  if (editor) editor.chain().focus().toggleBold().run();
}

function doItalic(): void {
  const editor = getEditor();
  if (editor) editor.chain().focus().toggleItalic().run();
}

function doLink(): void {
  const editor = getEditor();
  if (editor) {
    const url = window.prompt("输入链接地址:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }
}

function editorHasSelection(): boolean {
  const editor = getEditor();
  return editor ? editor.state.selection.from !== editor.state.selection.to : false;
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
  const { content, currentFileName, currentFilePath } = useEditorStore.getState();
  const defaultName = currentFileName.replace(/\.(md|markdown)$/i, "") + ".html";
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: "HTML", extensions: ["html", "htm"] }],
  });
  if (!selected) return;
  const body = resolveLocalImages(renderMarkdown(content), currentFilePath);
  const full = buildExportedHtml(currentFileName, body);
  try {
    await invoke("write_file_content", { path: selected, content: full });
  } catch (e) {
    console.error("Failed to export HTML:", e);
  }
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

// 另存为:总是弹出保存对话框,保存后切换到新路径
async function saveAsImpl(): Promise<void> {
  const { content, currentFileName } = useEditorStore.getState();
  const selected = await save({
    defaultPath: currentFileName,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  if (!selected) return;
  try {
    await invoke("write_file_content", { path: selected, content });
    useEditorStore.getState().setFilePath(selected);
    const name = selected.split(/[\\/]/).pop() || selected;
    useWorkspaceStore.getState().openTab(selected, name);
  } catch (e) {
    console.error("Failed to save as:", e);
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
  rememberCurrentSpot();
  try {
    const content = await invoke<string>("read_file_content", { path });
    const store = useEditorStore.getState();
    store.setContent(content);
    store.setFilePath(path);
    store.setDirty(false);
    const name = path.split(/[\\/]/).pop() || path;
    useWorkspaceStore.getState().openTab(path, name);
  } catch (e) {
    console.error("Failed to open file:", e);
  }
}

// 切走前记住当前文件的光标与滚动位置,切回来时恢复
function rememberCurrentSpot(): void {
  const editor = getEditor();
  const { currentFilePath } = useEditorStore.getState();
  if (editor && currentFilePath) {
    rememberSpot(currentFilePath, {
      pos: editor.state.selection.from,
      scrollTop: editor.view?.dom?.scrollTop ?? 0,
    });
  }
}

export default function App() {
  const theme = useEditorStore((s) => s.theme);
  const focusMode = useEditorStore((s) => s.focusMode);
  const root = useWorkspaceStore((s) => s.root);
  const tree = useWorkspaceStore((s) => s.tree);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabPath = useWorkspaceStore((s) => s.activeTabPath);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 侧栏展开状态,跨会话记住
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem("markora:sidebar") !== "0"; } catch { return true; }
  });
  const [quickOpen, setQuickOpen] = useState(false);
  const [aiCommandOpen, setAiCommandOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiCommandStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnchor, setAiAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem("markora:sidebar", sidebarOpen ? "1" : "0"); } catch {}
  }, [sidebarOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    useAiStore.getState().loadConfig().catch((error) => {
      useAiStore.getState().setError(String(error));
    });
  }, []);

  // --- 工作区 / 标签 ---

  const flushCurrentFile = async () => {
    rememberCurrentSpot();
    const { isDirty, currentFilePath, content } = useEditorStore.getState();
    if (isDirty && currentFilePath) {
      try {
        await invoke("write_file_content", { path: currentFilePath, content });
        useEditorStore.getState().setDirty(false);
      } catch (e) {
        console.error("Failed to flush file:", e);
      }
    }
  };

  const loadFileIntoEditor = async (path: string) => {
    const content = await invoke<string>("read_file_content", { path });
    const store = useEditorStore.getState();
    store.setContent(content);
    store.setFilePath(path);
  };

  const openFileInWorkspace = async (path: string) => {
    await flushCurrentFile();
    try {
      await loadFileIntoEditor(path);
      const name = path.split(/[\\/]/).pop() || path;
      useWorkspaceStore.getState().openTab(path, name);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  const openFileDialog = async () => {
    const selected = await open({ multiple: false, filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] });
    if (!selected) return;
    await openFileInWorkspace(selected as string);
  };

  const selectTab = async (path: string) => {
    const ws = useWorkspaceStore.getState();
    if (ws.activeTabPath === path && useEditorStore.getState().currentFilePath === path) return;
    await flushCurrentFile();
    try {
      await loadFileIntoEditor(path);
      ws.setActiveTab(path);
    } catch (e) {
      console.error("Failed to open tab:", e);
    }
  };

  const closeTab = async (path: string, flush = true) => {
    const ws = useWorkspaceStore.getState();
    const editorOnTab = useEditorStore.getState().currentFilePath === path;
    if (editorOnTab && flush) await flushCurrentFile();
    forgetSpot(path);
    const nextActive = ws.closeTab(path);
    if (!editorOnTab) return;
    if (nextActive) {
      try {
        await loadFileIntoEditor(nextActive);
      } catch (e) {
        console.error("Failed to load next tab:", e);
        const store = useEditorStore.getState();
        store.setContent("");
        store.setFilePath(null);
        store.setDirty(false);
      }
    } else {
      const store = useEditorStore.getState();
      store.setContent("");
      store.setFilePath(null);
      store.setDirty(false);
    }
  };

  const refreshWorkspaceTree = async () => {
    const ws = useWorkspaceStore.getState();
    if (!ws.root) return;
    try {
      const next = await invoke<WorkspaceFile[]>("scan_workspace", { root: ws.root });
      ws.setTree(next);
    } catch (e) {
      console.error("Failed to scan workspace:", e);
    }
  };

  const handleTreeRename = async (path: string, newName: string) => {
    const trimmed = (newName ?? "").trim();
    if (!trimmed || /[\\/]/.test(trimmed)) return;
    const sep = path.includes("\\") ? "\\" : "/";
    const dir = path.substring(0, path.lastIndexOf(sep));
    const newPath = `${dir}${sep}${trimmed}`;
    if (newPath === path) return;
    try {
      await invoke("rename_path", { from: path, to: newPath });
    } catch (e) {
      console.error("Failed to rename:", e);
      return;
    }
    const ws = useWorkspaceStore.getState();
    if (ws.tabs.some((tab) => tab.path === path)) {
      ws.renameTab(path, newPath, trimmed);
    }
    const editor = useEditorStore.getState();
    if (editor.currentFilePath === path) {
      editor.setFilePath(newPath);
    }
    await refreshWorkspaceTree();
  };

  const handleTreeDelete = async (path: string, isDir: boolean) => {
    const name = path.split(/[\\/]/).pop() || path;
    const ok = await ask(
      isDir
        ? `确定把文件夹 "${name}" 移入回收站吗?`
        : `确定把 "${name}" 移入回收站吗?`,
      { title: "删除确认", kind: "warning", okLabel: "移入回收站", cancelLabel: "取消" }
    );
    if (!ok) return;
    try {
      await invoke("trash_path", { path });
    } catch (e) {
      console.error("Failed to delete:", e);
      return;
    }
    const ws = useWorkspaceStore.getState();
    const prefix = path + (path.includes("\\") ? "\\" : "/");
    const affected = ws.tabs.filter((tab) => tab.path === path || tab.path.startsWith(prefix));
    for (const tab of affected) {
      await closeTab(tab.path, false);
    }
    await refreshWorkspaceTree();
  };

  const openFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const folder = selected as string;
    useWorkspaceStore.getState().setRoot(folder);
    await refreshWorkspaceTree();
    try {
      localStorage.setItem("markora:workspace", folder);
    } catch {}
  };

  // dir 指定时在该目录下新建(文件树右键),否则用工作区根目录
  const newFileInWorkspace = async (dir?: string) => {
    await flushCurrentFile();
    const rootPath = useWorkspaceStore.getState().root;
    const baseDir = dir ?? rootPath;
    const defaultPath = baseDir ? `${baseDir}/untitled.md` : "untitled.md";
    const selected = await save({
      defaultPath,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (!selected) return;
    try {
      await invoke("create_new_file", { path: selected });
      await loadFileIntoEditor(selected);
      const name = selected.split(/[\\/]/).pop() || selected;
      useWorkspaceStore.getState().openTab(selected, name);
      await refreshWorkspaceTree();
    } catch (e) {
      console.error("Failed to create file:", e);
    }
  };

  // 文件树右键:在指定目录下新建文件夹
  const newFolderInWorkspace = async (dir: string) => {
    const name = (window.prompt("新建文件夹名称:") ?? "").trim();
    if (!name || /[\\/]/.test(name)) return;
    const sep = dir.includes("\\") ? "\\" : "/";
    try {
      await invoke("create_folder", { path: `${dir}${sep}${name}` });
      await refreshWorkspaceTree();
    } catch (e) {
      console.error("Failed to create folder:", e);
    }
  };

  const openAiCommand = () => {
    const editor = getEditor();
    if (editor) {
      // 弹窗锚定在光标处(coordsAtPos 返回视口坐标)
      try {
        const rect = editor.view.coordsAtPos(editor.state.selection.head);
        setAiAnchor({ x: rect.left, y: rect.bottom + 8 });
      } catch {
        setAiAnchor({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    } else {
      setAiAnchor(null);
    }
    setAiStatus("idle");
    setAiError(null);
    setAiCommandOpen(true);
  };

  const closeAiCommand = () => {
    setAiCommandOpen(false);
    getEditor()?.commands.focus();
  };

  const handleAiCommand = async (instruction: string) => {
    const editor = getEditor();
    if (!editor) {
      setAiError("无法定位编辑器，请重试。");
      setAiStatus("error");
      return;
    }
    const currentAi = useAiStore.getState();
    if (!currentAi.apiKey) {
      setAiError("请先在 AI 设置中配置 API Key。");
      setAiStatus("error");
      return;
    }

    const { to } = editor.state.selection;
    const source = editor.getText();
    setAiStatus("generating");
    setAiError(null);
    currentAi.setGenerating(true);
    currentAi.setError(null);
    try {
      const raw = await completeAi({
        provider: currentAi.provider,
        baseUrl: currentAi.baseUrl,
        model: currentAi.model,
        prompt: `请根据以下指令处理文本：${instruction}\n\n当前文本：${source}`,
      });
      if (editor.getText() !== source) {
        throw new Error("文档在生成期间发生了变化，请重试。");
      }
      const text = normalizeAiText(raw);
      if (!text) throw new Error("AI 返回了空内容。");
      editor.chain().focus().insertContentAt(to, text).run();
      setAiCommandOpen(false);
      setAiStatus("idle");
    } catch (error) {
      setAiError(String(error));
      setAiStatus("error");
      currentAi.setError(String(error));
    } finally {
      useAiStore.getState().setGenerating(false);
    }
  };

  // Restore last session
  useEffect(() => {
    try {
      const raw = localStorage.getItem("markora:session");
      if (raw) {
        const s = JSON.parse(raw);
        const store = useEditorStore.getState();
        if (s.theme) store.setTheme(s.theme);
        if (s.lang) store.setLang(s.lang);
        if (s.currentFilePath) {
          invoke<string[]>("take_pending_files").then(async (pending) => {
            if (!pending || pending.length === 0) {
              try {
                const content = await invoke<string>("read_file_content", { path: s.currentFilePath });
                const st = useEditorStore.getState();
                st.setContent(content);
                st.setFilePath(s.currentFilePath);
                st.setDirty(false);
                const name = s.currentFilePath.split(/[\\/]/).pop() || s.currentFilePath;
                useWorkspaceStore.getState().openTab(s.currentFilePath, name);
              } catch { /* file gone */ }
            } else {
              for (const p of pending) await openFileFromPath(p);
            }
          });
        }
      }
    } catch {}
  }, []);

  // 窗口标题跟随当前文件与修改状态(原生 app 习惯)
  useEffect(() => {
    let last = "";
    const apply = (s: { currentFileName: string; isDirty: boolean }) => {
      const title = `${s.isDirty ? "• " : ""}${s.currentFileName} — Markora`;
      if (title === last) return;
      last = title;
      getCurrentWindow().setTitle(title).catch(() => {});
    };
    apply(useEditorStore.getState());
    return useEditorStore.subscribe(apply);
  }, []);

  // Build native menu
  useEffect(() => {
    rebuildMenu().catch(console.error);
  }, []);

  // Listen for menu events
  useEffect(() => {
    const unlisten = listen("menu-event", async (event) => {
      const id = event.payload as string;
      switch (id) {
        case "new_file": newFileInWorkspace(); break;
        case "open_file": openFileDialog(); break;
        case "open_folder": openFolder(); break;
        case "save": saveImpl(); break;
        case "save_as": saveAsImpl(); break;
        case "close_tab": {
          const active = useWorkspaceStore.getState().activeTabPath;
          if (active) closeTab(active);
          break;
        }
        case "export_html": exportHtml(); break;
        case "ai_command": openAiCommand(); break;
        case "toggle_sidebar": setSidebarOpen((v) => !v); break;
        case "toggle_theme": useEditorStore.getState().toggleTheme(); break;
        case "toggle_focus": useEditorStore.getState().toggleFocusMode(); break;
        case "settings":
        case "open_settings": setSettingsOpen(true); break;
        case "bold": doBold(); break;
        case "italic": doItalic(); break;
        case "link": doLink(); break;
        case "undo": doUndo(); break;
        case "redo": doRedo(); break;
        case "cut": doCut(); break;
        case "copy": doCopy(); break;
        case "paste": doPaste(); break;
        case "select_all": doSelectAll(); break;
        case "close_requested":
          if (await confirmDiscardIfDirty()) {
            try { await invoke("confirm_close"); } catch (e) { console.error(e); }
          }
          break;
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // Persist session
  useEffect(() => {
    const unsub = useEditorStore.subscribe((s) => {
      try {
        localStorage.setItem("markora:session", JSON.stringify({
          theme: s.theme,
          lang: s.lang,
          currentFilePath: s.currentFilePath,
        }));
      } catch {}
    });
    return unsub;
  }, []);

  // Track text input focus for paste target detection
  useEffect(() => {
    const handler = (e: FocusEvent) => trackTextInputFocus(e.target);
    document.addEventListener("focusin", handler);
    return () => document.removeEventListener("focusin", handler);
  }, []);

  // ⌘P 快速切换器
  const quickFiles = useMemo<QuickFile[]>(() => {
    if (!root || !tree) return [];
    const sep = root.includes("\\") ? "\\" : "/";
    const prefix = root.endsWith(sep) ? root : root + sep;
    const acc: QuickFile[] = [];
    const walk = (nodes: WorkspaceFile[]) => {
      for (const node of nodes) {
        if (node.isDir) walk(node.children);
        else acc.push({ path: node.path, name: node.name, rel: node.path.startsWith(prefix) ? node.path.slice(prefix.length) : node.path });
      }
    };
    walk(tree);
    return acc;
  }, [root, tree]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpen((v) => !v);
        return;
      }
      // ⌃Tab / ⌃⇧Tab 在标签间循环
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Tab") {
        e.preventDefault();
        const ws = useWorkspaceStore.getState();
        if (ws.tabs.length < 2 || !ws.activeTabPath) return;
        const idx = ws.tabs.findIndex((tab) => tab.path === ws.activeTabPath);
        const nextIdx = e.shiftKey
          ? (idx - 1 + ws.tabs.length) % ws.tabs.length
          : (idx + 1) % ws.tabs.length;
        selectTab(ws.tabs[nextIdx].path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-full w-full flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* 左右结构:sidebar 占满左侧整高,右侧为 TabBar + 编辑器;专注模式只留编辑器 */}
      <div className="flex-1 flex min-h-0">
        {!focusMode && (
          <FileTree
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
          root={root}
          tree={tree}
          activePath={useEditorStore.getState().currentFilePath}
          onOpenFile={openFileInWorkspace}
          onOpenFileDialog={openFileDialog}
          onOpenFolder={openFolder}
          onNewFile={() => newFileInWorkspace()}
          onNewFileAt={(dir) => newFileInWorkspace(dir)}
          onNewFolderAt={newFolderInWorkspace}
          onRefresh={refreshWorkspaceTree}
          onRename={handleTreeRename}
          onDelete={handleTreeDelete}
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          {!focusMode && (
            <div className="flex items-start">
              {!sidebarOpen && (
                <button
                  type="button"
                  className="sidebar-expand-btn"
                  onClick={() => setSidebarOpen(true)}
                  title="展开侧栏 (⌘\)"
                  aria-label="展开侧栏"
                >
                  <PanelLeft className="h-[15px] w-[15px]" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <TabBar
            tabs={tabs}
            activePath={activeTabPath}
            onSelect={selectTab}
            onClose={(path) => closeTab(path)}
            onRename={handleTreeRename}
            onReorder={(from, to) => useWorkspaceStore.getState().moveTab(from, to)}
                />
              </div>
            </div>
          )}
          <div
            className="flex-1 min-h-0 relative"
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, items: buildEditorMenuItems() });
            }}
          >
            <TipTapEditor />
          </div>
        </div>
      </div>
      {!focusMode && <StatusBar onOpenSettings={() => setSettingsOpen(true)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onItemClick={(id) => {
            handleContextAction(id);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}

      {quickOpen && (
        <QuickSwitcher
          files={quickFiles}
          onSelect={(path) => {
            setQuickOpen(false);
            openFileInWorkspace(path);
          }}
          onClose={() => {
            setQuickOpen(false);
            getEditor()?.commands.focus();
          }}
        />
      )}

      {aiCommandOpen && (
        <AiCommandModal
          open={aiCommandOpen}
          anchor={aiAnchor}
          status={aiStatus}
          error={aiError}
          onSubmit={handleAiCommand}
          onClose={closeAiCommand}
        />
      )}
    </div>
  );
}
