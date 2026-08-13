import { useMemo } from "react";
import { useEditorStore } from "../store/editorStore";

export interface OutlineItem {
  level: number;
  text: string;
  pos: number;
  children: OutlineItem[];
}

/** 解析 Markdown 标题（# ~ ######），跳过代码围栏内内容，返回层级树 */
export function parseOutline(content: string): OutlineItem[] {
  const lines = content.split("\n");
  const roots: OutlineItem[] = [];
  const stack: OutlineItem[] = [];
  let offset = 0;
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      offset += line.length + 1;
      continue;
    }
    if (!inFence) {
      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const item: OutlineItem = {
          level: match[1].length,
          text: match[2].trim(),
          pos: offset,
          children: [],
        };
        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
          stack.pop();
        }
        if (stack.length === 0) {
          roots.push(item);
        } else {
          stack[stack.length - 1].children.push(item);
        }
        stack.push(item);
      }
    }
    offset += line.length + 1;
  }
  return roots;
}

function flatten(items: OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children)]);
}

interface OutlineRowProps {
  item: OutlineItem;
  onJump: (pos: number) => void;
}

function OutlineRow({ item, onJump }: OutlineRowProps) {
  return (
    <div className="outline-tree-item">
      <button
        type="button"
        className="outline-row"
        onClick={() => onJump(item.pos)}
        title={item.text}
        aria-label={`H${item.level} ${item.text}`}
      >
        <span className="truncate">{item.text}</span>
      </button>
      {item.children.length > 0 && (
        <div className="outline-tree-children">
          {item.children.map((child) => (
            <OutlineRow key={child.pos} item={child} onJump={onJump} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OutlinePanelProps {
  onOpenFileDialog: () => void;
  onOpenFolder: () => void;
  /** 常驻在文件树下方时:空态更简洁,不显示打开按钮 */
  compact?: boolean;
}

/** 单文件模式下的文档标题目录：解析当前文档标题，点击跳转 */
export function OutlinePanel({ onOpenFileDialog, onOpenFolder, compact = false }: OutlinePanelProps) {
  const content = useEditorStore((state) => state.content);

  const outline = useMemo(() => parseOutline(content), [content]);

  const jumpTo = (pos: number) => {
    const editor = (window as any).__tiptapEditor;
    if (!editor) return;
    // 找到对应的标题项
    const item = flatten(outline).find((i) => i.pos === pos);
    if (!item) return;
    // 在文档中查找标题节点
    let found = false;
    editor.state.doc.descendants((node: any, nodePos: number) => {
      if (found) return false;
      if (node.type.name === "heading" && node.textContent.trim() === item.text) {
        editor.chain().focus().setTextSelection(nodePos + 1).run();
        // 滚动到可见区域
        const { view } = editor;
        const coords = view.coordsAtPos(nodePos);
        if (coords) {
          const editorDOM = view.dom.closest('.tiptap-editor');
          if (editorDOM) {
            editorDOM.scrollTop = coords.top - 100;
          }
        }
        found = true;
        return false;
      }
      return true;
    });
  };

  return (
    <div className="outline-panel flex flex-1 flex-col overflow-hidden">
      {outline.length === 0 ? (
        <div className="outline-empty flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
            {content ? "文档里还没有标题" : "未打开文档"}
          </p>
          {!compact && (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-[var(--border-primary)] px-3 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                onClick={onOpenFileDialog}
              >
                打开文件
              </button>
              <button
                type="button"
                className="rounded-md border border-[var(--border-primary)] px-3 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                onClick={onOpenFolder}
              >
                打开文件夹
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-y-auto pb-4">
          {outline.map((item) => (
            <OutlineRow key={item.pos} item={item} onJump={jumpTo} />
          ))}
        </div>
      )}
    </div>
  );
}
