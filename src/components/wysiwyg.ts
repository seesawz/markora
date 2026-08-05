import { Extension, RangeSetBuilder, StateField, EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

// ponytail: WYSIWYG — 光标不在某节点内时,用 Decoration.replace 隐藏 markdown 语法符号,
// 配上 HighlightStyle 的字号/粗斜体,视觉上就是渲染态。光标进入,符号回来可编辑。
// 不支持表格(明确不做)。

// Typora 行为: 选区保持渲染态(标记隐藏,只显示样式);光标进入节点显示标记(可编辑)
export function shouldRevealMarkdownMarks(state: EditorState, from: number, to: number): boolean {
  const sel = state.selection.main;
  // 选区非空 → 保持渲染态,标记隐藏(只显示大字号/粗体等样式)
  if (!sel.empty) return false;
  // 光标在节点内 → 显示标记(可编辑)
  return sel.from <= to && sel.to >= from;
}

function normalizeSelectionBoundary(state: EditorState, position: number, side: "start" | "end"): number {
  let result = position;
  const line = state.doc.lineAt(position);
  syntaxTree(state).iterate({
    enter(node) {
      const { name, from, to } = node;

      if (/^ATXHeading[1-6]$/.test(name) && from === line.from && position <= line.from) {
        const mark = node.node.getChild("HeaderMark");
        if (mark && side === "start") result = Math.max(result, Math.min(mark.to + 1, line.to));
        return false;
      }

      if (side === "start" && from === position) {
        const markName = {
          StrongEmphasis: "EmphasisMark",
          Emphasis: "EmphasisMark",
          Strikethrough: "StrikethroughMark",
          InlineCode: "CodeMark",
        }[name];
        if (markName) {
          const marks = node.node.getChildren(markName);
          if (marks.length >= 2) result = Math.max(result, marks[0].to);
        }
      }

      if (side === "end" && to === position) {
        const markName = {
          StrongEmphasis: "EmphasisMark",
          Emphasis: "EmphasisMark",
          Strikethrough: "StrikethroughMark",
          InlineCode: "CodeMark",
        }[name];
        if (markName) {
          const marks = node.node.getChildren(markName);
          if (marks.length >= 2) result = Math.min(result, marks[marks.length - 1].from);
        }
      }
    },
  });
  return result;
}

// 选区从隐藏语法标记开始时,把边界移到可见正文,避免浏览器选区把标记重新绘制出来。
export function normalizeMarkdownSelection(
  state: EditorState,
  selection = state.selection,
): { anchor: number; head: number } | null {
  const main = selection.main;
  if (main.empty) return null;

  const forward = main.anchor <= main.head;
  const start = normalizeSelectionBoundary(state, main.from, "start");
  const end = normalizeSelectionBoundary(state, main.to, "end");
  const anchor = forward ? start : end;
  const head = forward ? end : start;
  if (anchor === main.anchor && head === main.head) return null;
  return { anchor, head };
}

// 用 mark 隐藏而不是 replace: CodeMirror 在选区穿过 replace 装饰时会重新显示原文。
function hide(builder: RangeSetBuilder<Decoration>, from: number, to: number) {
  if (from < to) {
    builder.add(from, to, Decoration.mark({
      attributes: { style: "display: none !important" },
    }));
  }
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
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
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
        if (!shouldRevealMarkdownMarks(state, from, to)) {
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
        if (!shouldRevealMarkdownMarks(state, from, to)) {
          const marks = node.node.getChildren("EmphasisMark");
          for (const m of marks) hide(builder, m.from, m.to);
        }
        return false;
      }

      // ---- 行内代码:隐藏反引号 ----
      if (name === "InlineCode") {
        if (!shouldRevealMarkdownMarks(state, from, to)) {
          const marks = node.node.getChildren("CodeMark");
          for (const m of marks) hide(builder, m.from, m.to);
        }
        return false;
      }

      // ---- 链接:只显示文字,隐藏 [ ] ( url ) ----
      if (name === "Link") {
        if (!shouldRevealMarkdownMarks(state, from, to)) {
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
        if (!shouldRevealMarkdownMarks(state, from, to)) {
          const marks = node.node.getChildren("StrikethroughMark");
          for (const m of marks) hide(builder, m.from, m.to);
        }
        return false;
      }

      // ---- 引用块:隐藏行首 > ,整行加引用样式 ----
      if (name === "QuoteMark") {
        const line = state.doc.lineAt(from);
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
          hide(builder, from, Math.min(to + 1, line.to)); // ">" + 后面的空格
        }
        return false;
      }

      // ---- 列表标记:无序换成子弹点,有序保留数字 ----
      if (name === "ListMark") {
        const line = state.doc.lineAt(from);
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
          const ordered = !!node.node.parent && node.node.parent.name === "OrderedList"
            || !!(node.node.parent?.parent && node.node.parent.parent.name === "OrderedList");
          builder.add(from, to, Decoration.replace({ widget: new BulletWidget(ordered ? state.doc.sliceString(from, to) : "•") }));
        }
        return false;
      }

      // ---- 任务列表的 [ ] / [x] ----
      if (name === "TaskMarker") {
        const line = state.doc.lineAt(from);
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
          builder.add(from, to, Decoration.replace({}));
        }
        return false;
      }

      // ---- 分隔线:--- / *** 渲染成一条线 ----
      if (name === "HorizontalRule") {
        if (!shouldRevealMarkdownMarks(state, from, to)) {
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
