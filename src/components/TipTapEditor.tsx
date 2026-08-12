import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEditorStore } from "../store/editorStore";
import { markdownToTiptap, tiptapToMarkdown } from "../lib/markdownSerializer";
import { recallSpot } from "../lib/cursorMemory";
import { t } from "../lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { SearchPanel } from "./SearchPanel";
import { SearchHighlight } from "../lib/searchHighlight";
import { useWorkspaceStore } from "../store/workspaceStore";

// 从 TipTap Editor 获取纯文本（用于统计）
function getTextFromEditor(editor: Editor): string {
  return editor.getText();
}
void getTextFromEditor;

// 从 TipTap Editor 获取 Markdown
function getMarkdownFromEditor(editor: Editor): string {
  return tiptapToMarkdown(editor.getJSON());
}

export function TipTapEditor() {
  // 字段级订阅:光标/字数等高频变化不会重渲染编辑器本体
  const content = useEditorStore((s) => s.content);
  const theme = useEditorStore((s) => s.theme);
  const isDirty = useEditorStore((s) => s.isDirty);
  const activeTabPath = useWorkspaceStore((s) => s.activeTabPath);

  const isDark = theme === "dark";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState<{ query: string; replace: boolean }>({ query: "", replace: false });
  const editorRef = useRef<Editor | null>(null);
  const contentTimer = useRef<number | null>(null);
  const cursorRaf = useRef<number | null>(null);
  const loadedTabPath = useRef<string | null>(null);

  // 拖拽选择时 selection 每次 mousemove 都变,用 rAF 合帧后再写入 store
  const reportCursor = () => {
    if (cursorRaf.current !== null) return;
    cursorRaf.current = requestAnimationFrame(() => {
      cursorRaf.current = null;
      const current = editorRef.current;
      if (current) useEditorStore.getState().setCursor(current.state.selection.from, 1);
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { HTMLAttributes: { class: "code-block" } },
        // dropcursor 显示拖拽落点;gapcursor 让图片/代码块等节点边缘也能放置光标
        dropcursor: { color: "var(--accent)", width: 2 },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Image.configure({
        HTMLAttributes: { class: "editor-image" },
      }),
      Placeholder.configure({
        // 函数形式:每次渲染取值,切换语言即时生效
        placeholder: () => t("editorPlaceholder"),
      }),
      Typography,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      SearchHighlight,
    ],
    content: content ? markdownToTiptap(content) : "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        "data-theme": isDark ? "dark" : "light",
      },
      handleKeyDown: (_view, event) => {
        // Mod+B: 加粗
        if ((event.metaKey || event.ctrlKey) && event.key === "b") {
          event.preventDefault();
          editor?.chain().focus().toggleBold().run();
          return true;
        }
        // Mod+I: 斜体
        if ((event.metaKey || event.ctrlKey) && event.key === "i") {
          event.preventDefault();
          editor?.chain().focus().toggleItalic().run();
          return true;
        }
        // Mod+K: 链接
        if ((event.metaKey || event.ctrlKey) && event.key === "k") {
          event.preventDefault();
          const url = window.prompt("输入链接地址:");
          if (url) {
            editor?.chain().focus().setLink({ href: url }).run();
          }
          return true;
        }
        // Mod+F: 搜索
        if ((event.metaKey || event.ctrlKey) && event.key === "f") {
          event.preventDefault();
          setSearchSeed({ query: "", replace: false });
          setSearchOpen(true);
          return true;
        }
        // Mod+H: 替换
        if ((event.metaKey || event.ctrlKey) && event.key === "h") {
          event.preventDefault();
          setSearchSeed({ query: "", replace: true });
          setSearchOpen(true);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        // 处理剪贴板图片
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            void (async () => {
              try {
                const { currentFilePath, currentFileName } = useEditorStore.getState();
                const name = `image-${Date.now()}.png`;

                let targetDir: string;
                let markdownPath: string;
                if (currentFilePath) {
                  const base = currentFileName.replace(/\.(md|markdown)$/i, "");
                  const sep = currentFilePath.includes("\\") ? "\\" : "/";
                  const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf(sep));
                  targetDir = `${dir}${sep}${base}.assets`;
                  markdownPath = `${base}.assets/${name}`;
                } else {
                  const dataDir = await appDataDir();
                  targetDir = `${dataDir}images`;
                  markdownPath = `${targetDir}/${name}`;
                }

                await invoke<string>("save_clipboard_image", { dir: targetDir, name });
                editor?.chain().focus().setImage({ src: markdownPath }).run();
              } catch (e) {
                console.log("[paste] no clipboard image:", e);
              }
            })();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // 节流保存内容
      if (contentTimer.current !== null) window.clearTimeout(contentTimer.current);
      useEditorStore.getState().setDirty(true);
      const tabPath = useWorkspaceStore.getState().activeTabPath;
      const markdown = getMarkdownFromEditor(editor);
      contentTimer.current = window.setTimeout(() => {
        if (useWorkspaceStore.getState().activeTabPath === tabPath) {
          useEditorStore.getState().setContent(markdown);
        }
      }, 500);

      reportCursor();
    },
    onSelectionUpdate: () => {
      reportCursor();
    },
  });

  editorRef.current = editor;
  (window as any).__tiptapEditor = editor;

  // 卸载时清掉挂起的节流任务
  useEffect(() => () => {
    if (contentTimer.current !== null) window.clearTimeout(contentTimer.current);
    if (cursorRaf.current !== null) cancelAnimationFrame(cursorRaf.current);
  }, []);

  // 外部加载新文件
  useEffect(() => {
    if (!editor) return;
    const tabChanged = loadedTabPath.current !== activeTabPath;
    if (isDirty && !tabChanged) return;
    const currentMarkdown = getMarkdownFromEditor(editor);
    if (currentMarkdown !== content) {
      const tiptapContent = markdownToTiptap(content);
      editor.commands.setContent(tiptapContent, { emitUpdate: false });
    }

    loadedTabPath.current = activeTabPath;
    if (!tabChanged) return;

    // 恢复该文件上次的光标与滚动位置(会话级记忆,Obsidian 式)
    const path = useEditorStore.getState().currentFilePath;
    const spot = path ? recallSpot(path) : null;
    if (spot) {
      const maxPos = editor.state.doc.content.size;
      editor.commands.setTextSelection(Math.min(spot.pos, maxPos));
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.view.dom.scrollTop = spot.scrollTop;
      });
    } else {
      editor.view.dom.scrollTop = 0;
      editor.commands.setTextSelection(1);
    }
    if (activeTabPath) {
      requestAnimationFrame(() => editorRef.current?.commands.focus());
    }
  }, [activeTabPath, content, editor, isDirty]);

  // 主题切换
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: "tiptap-editor",
          "data-theme": isDark ? "dark" : "light",
        },
      },
    });
  }, [isDark, editor]);

  if (!editor) {
    return <div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">加载中...</div>;
  }

  return (
    <div className="h-full w-full overflow-hidden" style={{ background: "var(--bg-primary)", position: "relative" }}>
      <EditorContent editor={editor} className="h-full w-full" />
      {searchOpen && (
        <SearchPanel
          editor={editor}
          initialQuery={searchSeed.query}
          initialShowReplace={searchSeed.replace}
          onClose={() => {
            setSearchOpen(false);
            editor.commands.focus();
          }}
        />
      )}
    </div>
  );
}
