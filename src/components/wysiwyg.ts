import { Extension, RangeSetBuilder, StateField, EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

// ponytail: WYSIWYG — 光标不在某节点内时,用 Decoration.replace 隐藏 markdown 语法符号,
// 配上 HighlightStyle 的字号/粗斜体,视觉上就是渲染态。光标进入,符号回来可编辑。
// 不支持表格(明确不做)。

// 光标(或选区)是否与 [from,to] 相交 —— 相交就不隐藏,保持源码可见
function cursorInside(state: EditorState, from: number, to: number): boolean {
  const sel = state.selection.main;
  return sel.from <= to && sel.to >= from;
}

// 给某段文本两端加不可见(宽度为0)的隐藏
function hide(builder: RangeSetBuilder<Decoration>, from: number, to: number) {
  if (from < to) builder.add(from, to, Decoration.replace({}));
}

function buildWysiwygDecos(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      const { from, to, name } = node;

      // ---- 标题:ATXHeading1..6,隐藏开头的 # 序列,整行加 class ----
      const headingMatch = /^ATXHeading([1-6])$/.exec(name);
      if (headingMatch) {
        const level = headingMatch[1];
        const line = state.doc.lineAt(from);
        builder.add(line.from, line.from, Decoration.line({ attributes: { class: `cm-md-h${level}` } }));
        // HeaderMark 子节点是 "#" 序列,光标不在本行才隐藏
        if (!cursorInside(state, line.from, line.to)) {
          const mark = node.node.getChild("HeaderMark");
          if (mark) hide(builder, mark.from, Math.min(mark.to + 1, line.to)); // +1 吃掉 # 后的空格
        }
        return false; // 不进子节点,避免重复处理
      }

      // ---- Setext 标题(=== / ---):隐藏下划标记行 ----
      if (name === "SetextHeading1" || name === "SetextHeading2") {
        const level = name === "SetextHeading1" ? "1" : "2";
        const line = state.doc.lineAt(from);
        builder.add(line.from, line.from, Decoration.line({ attributes: { class: `cm-md-h${level}` } }));
        if (!cursorInside(state, from, to)) {
          const mark = node.node.getChild("SetextMark");
          if (mark) {
            const markLine = state.doc.lineAt(mark.from);
            hide(builder, markLine.from, markLine.to);
          }
        }
        return false;
      }

      // ---- 粗体/斜体:隐藏 ** 或 * 标记 ----
      if (name === "StrongEmphasis" || name === "Emphasis") {
        if (!cursorInside(state, from, to)) {
          const marks = node.node.getChildren("EmphasisMark");
          for (const m of marks) hide(builder, m.from, m.to);
        }
        return false;
      }

      // ---- 行内代码:隐藏反引号 ----
      if (name === "InlineCode") {
        if (!cursorInside(state, from, to)) {
          const marks = node.node.getChildren("CodeMark");
          for (const m of marks) hide(builder, m.from, m.to);
        }
        return false;
      }

      // ---- 链接:只显示文字,隐藏 [ ] ( url ) ----
      if (name === "Link") {
        if (!cursorInside(state, from, to)) {
          // 结构: [ text ] ( url ) —— 找 LinkMark 和 URL
          const marks = node.node.getChildren("LinkMark");
          const url = node.node.getChild("URL");
          if (marks.length >= 2) {
            hide(builder, marks[0].from, marks[0].to); // [
            // 从 ]( 到 url 结束 ) 全隐藏
            const closeBracket = marks[1];
            const end = url ? Math.max(url.to, closeBracket.to) : closeBracket.to;
            const lastMark = marks[marks.length - 1];
            hide(builder, closeBracket.from, Math.max(lastMark.to, end));
          }
        }
        return false;
      }

      // ---- 图片:交给现有 imagePreview extension,这里跳过 ----
      if (name === "Image") return false;

      // ---- 删除线:隐藏 ~~ ----
      if (name === "Strikethrough") {
        if (!cursorInside(state, from, to)) {
          const marks = node.node.getChildren("StrikethroughMark");
          for (const m of marks) hide(builder, m.from, m.to);
        }
        return false;
      }

      // ---- 引用块:隐藏行首 > ,整行加引用样式 ----
      if (name === "QuoteMark") {
        const line = state.doc.lineAt(from);
        if (!cursorInside(state, line.from, line.to)) {
          hide(builder, from, Math.min(to + 1, line.to)); // ">" + 后面的空格
        }
        return false;
      }

      // ---- 列表标记:无序换成子弹点,有序保留数字 ----
      if (name === "ListMark") {
        const line = state.doc.lineAt(from);
        if (!cursorInside(state, line.from, line.to)) {
          const ordered = !!node.node.parent && node.node.parent.name === "OrderedList"
            || !!(node.node.parent?.parent && node.node.parent.parent.name === "OrderedList");
          builder.add(from, to, Decoration.replace({ widget: new BulletWidget(ordered ? state.doc.sliceString(from, to) : "•") }));
        }
        return false;
      }

      // ---- 任务列表的 [ ] / [x] ----
      if (name === "TaskMarker") {
        const line = state.doc.lineAt(from);
        if (!cursorInside(state, line.from, line.to)) {
          builder.add(from, to, Decoration.replace({}));
        }
        return false;
      }

      // ---- 分隔线:--- / *** 渲染成一条线 ----
      if (name === "HorizontalRule") {
        if (!cursorInside(state, from, to)) {
          const line = state.doc.lineAt(from);
          builder.add(line.from, line.from, Decoration.line({ attributes: { class: "cm-md-hr-line" } }));
          hide(builder, from, to);
        }
        return false;
      }
    },
  });

  return builder.finish();
}

// 列表标记 widget:无序显示 •,有序显示原数字
class BulletWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-bullet";
    span.textContent = this.text;
    return span;
  }
  eq(other: BulletWidget) { return other.text === this.text; }
  ignoreEvent() { return true; }
}

const wysiwygField = StateField.define<DecorationSet>({
  create(state) {
    return buildWysiwygDecos(state);
  },
  update(deco, tr) {
    // 文档或光标变化都要重建(光标进出节点决定显隐)
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    return buildWysiwygDecos(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function wysiwyg(): Extension {
  return [
    wysiwygField,
    EditorView.baseTheme({
      // 标题字号(渲染态) -- Kimi markdown 规范: H1=22/H2=20/H3=18px
      ".cm-md-h1": { fontSize: "22px", fontWeight: "700", lineHeight: "1.4", letterSpacing: "-0.02em" },
      ".cm-md-h2": { fontSize: "20px", fontWeight: "700", lineHeight: "1.4", letterSpacing: "-0.015em" },
      ".cm-md-h3": { fontSize: "18px", fontWeight: "650", lineHeight: "1.4", letterSpacing: "-0.01em" },
      ".cm-md-h4": { fontSize: "16px", fontWeight: "650" },
      ".cm-md-h5": { fontSize: "15px", fontWeight: "650" },
      ".cm-md-h6": { fontSize: "14px", fontWeight: "650" },
      // 子弹点 -- 暖中性色,不用强调色,更克制
      ".cm-md-bullet": {
        color: "var(--text-tertiary)",
        display: "inline-block",
        width: "1.2em",
      },
      // 分隔线渲染成一条线
      ".cm-md-hr-line": {
        borderTop: "1px solid var(--border-primary)",
        marginTop: "1em",
        paddingTop: "0.6em",
      },
    }),
  ];
}
