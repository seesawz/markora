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
import { useAiStore } from "../store/aiStore";
import { markdownToTiptap, tiptapToMarkdown } from "../lib/markdownSerializer";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { SelectionFix } from "./tiptapSelectionFix";
import { SearchPanel } from "./SearchPanel";

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
  const {
    content,
    setContent,
    theme,
    setCursor,
    isDirty,
  } = useEditorStore();

  const isDark = theme === "dark";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState<{ query: string; replace: boolean }>({ query: "", replace: false });
  const editorRef = useRef<Editor | null>(null);
  const contentTimer = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { HTMLAttributes: { class: "code-block" } },
        // 禁用可能干扰原生选区的扩展
        dropcursor: false,
        gapcursor: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Image.configure({
        HTMLAttributes: { class: "editor-image" },
      }),
      Placeholder.configure({
        placeholder: "开始输入...",
      }),
      Typography,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      SelectionFix,
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
      contentTimer.current = window.setTimeout(() => {
        const markdown = getMarkdownFromEditor(editor);
        setContent(markdown);
      }, 500);

      // 更新光标位置（简化版：TipTap 没有行列概念，用字符位置）
      const { from } = editor.state.selection;
      setCursor(from, 1);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from } = editor.state.selection;
      setCursor(from, 1);
    },
  });

  editorRef.current = editor;
  (window as any).__tiptapEditor = editor;

  // 外部加载新文件
  useEffect(() => {
    if (!editor || isDirty) return;
    const currentMarkdown = getMarkdownFromEditor(editor);
    if (currentMarkdown === content) return;

    const tiptapContent = markdownToTiptap(content);
    editor.commands.setContent(tiptapContent);
    // TipTap 没有 clearHistory,用 setContent 重置即可
  }, [content, editor, isDirty]);

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

  // AI 补全（简化版，先禁用）
  useEffect(() => {
    const unsub = useAiStore.subscribe((state, previous) => {
      if (state.enabled !== previous.enabled && !state.enabled && editorRef.current) {
        // 清除 AI 状态
      }
    });
    return unsub;
  }, []);

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
