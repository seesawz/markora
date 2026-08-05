import { Extension, RangeSetBuilder, StateEffect, StateField, EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { getFormattedSpans, type FormattedSpan, type FormatKind } from "../lib/markdownFormatting";

export { normalizeMarkdownSelection } from "../lib/markdownFormatting";

type EditingSpan = {
  kind: FormatKind;
  lineFrom: number;
  outerFrom: number;
  outerTo: number;
};

const commitMarkdownEditing = StateEffect.define<null>();

function toEditingSpan(state: EditorState, span: FormattedSpan): EditingSpan {
  return {
    kind: span.kind,
    lineFrom: state.doc.lineAt(span.outerFrom).from,
    outerFrom: span.outerFrom,
    outerTo: span.outerTo,
  };
}

function spanAtCursor(state: EditorState, kind?: FormatKind): FormattedSpan | null {
  const head = state.selection.main.head;
  const spans = getFormattedSpans(state)
    .filter((span) => (!kind || span.kind === kind) && head >= span.outerFrom && head <= span.outerTo)
    .sort((a, b) => (a.outerTo - a.outerFrom) - (b.outerTo - b.outerFrom));
  return spans[0] ?? null;
}

const markdownEditingField = StateField.define<EditingSpan | null>({
  create() {
    return null;
  },
  update(editing, tr) {
    for (const effect of tr.effects) {
      if (effect.is(commitMarkdownEditing)) return null;
    }

    if (!tr.newSelection.main.empty) return null;

    if (!tr.docChanged) {
      if (!editing) return null;
      const span = spanAtCursor(tr.state, editing.kind);
      if (!span
        || tr.state.doc.lineAt(span.outerFrom).from !== editing.lineFrom
        || span.outerFrom > editing.outerTo
        || span.outerTo < editing.outerFrom) return null;
      return toEditingSpan(tr.state, span);
    }

    let inserted = "";
    tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, text) => {
      inserted += text.toString();
    });
    if (inserted.includes("\n")) return null;

    if (editing) {
      const mappedFrom = tr.changes.mapPos(editing.outerFrom, 1);
      const mappedTo = tr.changes.mapPos(editing.outerTo, -1);
      const span = getFormattedSpans(tr.state)
        .filter((item) => item.kind === editing.kind
          && item.outerFrom <= mappedTo
          && item.outerTo >= mappedFrom
          && tr.state.selection.main.head >= item.outerFrom
          && tr.state.selection.main.head <= item.outerTo)
        .sort((a, b) => (a.outerTo - a.outerFrom) - (b.outerTo - b.outerFrom))[0];
      return span ? toEditingSpan(tr.state, span) : null;
    }

    if (inserted.length === 0) return null;

    const currentLine = tr.state.doc.lineAt(tr.state.selection.main.head);
    const previousLine = tr.startState.doc.lineAt(tr.startState.selection.main.head);
    const currentSpans = getFormattedSpans(tr.state)
      .filter((span) => tr.state.doc.lineAt(span.outerFrom).from === currentLine.from);
    const previousSpans = getFormattedSpans(tr.startState)
      .filter((span) => tr.startState.doc.lineAt(span.outerFrom).from === previousLine.from);
    const span = spanAtCursor(tr.state);
    if (!span) return null;
    const current = currentSpans.filter((item) => item.kind === span.kind);
    const previous = previousSpans.filter((item) => item.kind === span.kind);
    const formatStarted = current.length > previous.length
      || previous.some((item) => item.contentFrom === item.contentTo)
        && current.some((item) => item.contentFrom < item.contentTo);
    return formatStarted ? toEditingSpan(tr.state, span) : null;
  },
});

// 新格式在当前编辑范围内显示标记，离开范围、选中或换行后进入渲染态。
export function shouldRevealMarkdownMarks(state: EditorState, from: number, to: number): boolean {
  const editing = state.field(markdownEditingField, false);
  if (editing && editing.outerFrom <= to && editing.outerTo >= from) {
    return true;
  }

  const selection = state.selection.main;
  if (!selection.empty) return false;
  return getFormattedSpans(state).some((span) => (
    span.contentFrom === span.contentTo
    && span.outerFrom <= to
    && span.outerTo >= from
    && selection.head >= span.outerFrom
    && selection.head <= span.outerTo
  ));
}

type DecorationSpec = {
  from: number;
  to: number;
  decoration: Decoration;
};

function hide(decorations: DecorationSpec[], from: number, to: number) {
  if (from < to) {
    decorations.push({
      from,
      to,
      decoration: Decoration.mark({
        attributes: { style: "display: none !important" },
      }),
    });
  }
}

function buildWysiwygDecos(state: EditorState): DecorationSet {
  const decorations: DecorationSpec[] = [];
  const add = (from: number, to: number, decoration: Decoration) => {
    decorations.push({ from, to, decoration });
  };
  const tree = syntaxTree(state);

  // 这些范围同时供选区归一化和删除逻辑使用，避免渲染态与编辑态出现不同边界。
  for (const span of getFormattedSpans(state)) {
    if (span.kind === "heading") {
      const line = state.doc.lineAt(span.outerFrom);
      const prefix = state.doc.sliceString(span.outerFrom, span.contentFrom);
      const level = Math.min(6, Math.max(1, prefix.match(/^#+/)?.[0].length ?? 1));
      add(line.from, line.from, Decoration.line({ attributes: { class: `cm-md-h${level}` } }));
    }
    if (!shouldRevealMarkdownMarks(state, span.outerFrom, span.outerTo)) {
      for (const range of span.markRanges) hide(decorations, range.from, range.to);
    }
  }

  tree.iterate({
    enter(node) {
      const { from, to, name } = node;

      // ---- Setext 标题(=== / ---):隐藏下划标记行 ----
      if (name === "SetextHeading1" || name === "SetextHeading2") {
        const level = name === "SetextHeading1" ? "1" : "2";
        const line = state.doc.lineAt(from);
        add(line.from, line.from, Decoration.line({ attributes: { class: `cm-md-h${level}` } }));
        if (!shouldRevealMarkdownMarks(state, from, to)) {
          const mark = node.node.getChild("SetextMark");
          if (mark) {
            const markLine = state.doc.lineAt(mark.from);
            hide(decorations, markLine.from, markLine.to);
          }
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
            hide(decorations, marks[0].from, marks[0].to); // [
            // 从 ]( 到 url 结束 ) 全隐藏
            const closeBracket = marks[1];
            const end = url ? Math.max(url.to, closeBracket.to) : closeBracket.to;
            const lastMark = marks[marks.length - 1];
            hide(decorations, closeBracket.from, Math.max(lastMark.to, end));
          }
        }
        return false;
      }

      // ---- 图片:交给现有 imagePreview extension,这里跳过 ----
      if (name === "Image") return false;

      // ---- 引用块:隐藏行首 > ,整行加引用样式 ----
      if (name === "QuoteMark") {
        const line = state.doc.lineAt(from);
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
          hide(decorations, from, Math.min(to + 1, line.to)); // ">" + 后面的空格
        }
        return false;
      }

      // ---- 列表标记:无序换成子弹点,有序保留数字 ----
      if (name === "ListMark") {
        const line = state.doc.lineAt(from);
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
          const ordered = !!node.node.parent && node.node.parent.name === "OrderedList"
            || !!(node.node.parent?.parent && node.node.parent.parent.name === "OrderedList");
          add(from, to, Decoration.replace({ widget: new BulletWidget(ordered ? state.doc.sliceString(from, to) : "•") }));
        }
        return false;
      }

      // ---- 任务列表的 [ ] / [x] ----
      if (name === "TaskMarker") {
        const line = state.doc.lineAt(from);
        if (!shouldRevealMarkdownMarks(state, line.from, line.to)) {
          add(from, to, Decoration.replace({}));
        }
        return false;
      }

      // ---- 分隔线:--- / *** 渲染成一条线 ----
      if (name === "HorizontalRule") {
        if (!shouldRevealMarkdownMarks(state, from, to)) {
          const line = state.doc.lineAt(from);
          add(line.from, line.from, Decoration.line({ attributes: { class: "cm-md-hr-line" } }));
          hide(decorations, from, to);
        }
        return false;
      }
    },
  });

  const builder = new RangeSetBuilder<Decoration>();
  decorations
    .sort((a, b) => a.from - b.from || a.to - b.to)
    .forEach(({ from, to, decoration }) => builder.add(from, to, decoration));
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
    const editingChanged = tr.effects.some((effect) => effect.is(commitMarkdownEditing));
    if (!tr.docChanged && !tr.selection && !editingChanged) return deco.map(tr.changes);
    return buildWysiwygDecos(tr.state);
  },
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.atomicRanges.of((view) => view.state.field(f)),
  ],
});

const commitEditingOnBlur = EditorView.domEventHandlers({
  blur(_event, view) {
    if (view.state.field(markdownEditingField) !== null) {
      view.dispatch({ effects: commitMarkdownEditing.of(null) });
    }
    return false;
  },
});

export function wysiwyg(): Extension {
  return [
    markdownEditingField,
    wysiwygField,
    commitEditingOnBlur,
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
