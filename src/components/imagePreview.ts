import { Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEditorStore } from "../store/editorStore";

// ponytail: 在编辑器里渲染图片挂件 —— 检测 ![](path) 行,在其下方插入 <img> 预览,路径文本保留可编辑
class ImageWidget extends WidgetType {
  constructor(readonly src: string) {
    super();
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-image-preview";
    const img = document.createElement("img");
    img.src = this.src;
    img.draggable = false;
    img.onerror = () => {
      wrap.classList.add("cm-image-broken");
      img.replaceWith(document.createTextNode("⚠ 图片加载失败"));
    };
    wrap.appendChild(img);
    return wrap;
  }
  eq(other: ImageWidget) {
    return other.src === this.src;
  }
  ignoreEvent() {
    return true;
  }
}

const IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function resolveSrc(raw: string): string | null {
  if (/^(https?:|data:|blob:|asset:)/i.test(raw)) return raw;
  const { currentFilePath } = useEditorStore.getState();
  let abs: string | null = null;
  if (raw.startsWith("/")) {
    abs = raw;
  } else if (currentFilePath) {
    const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf("/"));
    abs = `${dir}/${raw}`;
  }
  return abs ? convertFileSrc(abs) : null;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const cursor = view.state.selection.main;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    IMAGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let lastWidgetSrc: string | null = null;
    let matchFrom = -1;
    let matchTo = -1;
    while ((m = IMAGE_RE.exec(line.text))) {
      const src = resolveSrc(m[1]);
      if (!src) continue;
      lastWidgetSrc = src;
      matchFrom = line.from + m.index;
      matchTo = line.from + m.index + m[0].length;
    }
    if (lastWidgetSrc) {
      // 光标不在这一行时,隐藏 ![](path) 源码文本,只留图片
      const cursorOnLine = cursor.from <= line.to && cursor.to >= line.from;
      if (!cursorOnLine) {
        builder.add(
          matchFrom,
          matchTo,
          Decoration.replace({})
        );
      }
      builder.add(
        line.to,
        line.to,
        Decoration.widget({
          widget: new ImageWidget(lastWidgetSrc),
          side: 1,
          block: true,
        })
      );
    }
  }
  return builder.finish();
}

// ponytail: StateField + EditorView.decorations —— block decoration 不能用 ViewPlugin.decorations
const imageField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations({ state } as EditorView);
  },
  update(deco, tr) {
    // 文档或光标变化都可能影响显隐(光标进出图片行)
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    return buildDecorations({ state: tr.state } as EditorView);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function imagePreview(): Extension {
  return [
    imageField,
    EditorView.baseTheme({
      ".cm-image-preview": {
        padding: "6px 0",
        lineHeight: "0",
      },
      ".cm-image-preview img": {
        maxWidth: "min(100%, 480px)",
        maxHeight: "320px",
        borderRadius: "8px",
        border: "1px solid var(--border-primary)",
        display: "block",
      },
      ".cm-image-broken": {
        color: "var(--text-tertiary)",
        fontSize: "13px",
        lineHeight: "1.5",
      },
    }),
  ];
}
