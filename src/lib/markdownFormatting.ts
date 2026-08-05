import { type EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

export type FormatKind = "heading" | "strong" | "emphasis" | "strike" | "code";

export type MarkdownRange = {
  from: number;
  to: number;
};

export type FormattedSpan = {
  kind: FormatKind;
  outerFrom: number;
  outerTo: number;
  contentFrom: number;
  contentTo: number;
  markRanges: MarkdownRange[];
};

const inlineFormats: Record<string, { kind: FormatKind; markName: string }> = {
  StrongEmphasis: { kind: "strong", markName: "EmphasisMark" },
  Emphasis: { kind: "emphasis", markName: "EmphasisMark" },
  Strikethrough: { kind: "strike", markName: "StrikethroughMark" },
  InlineCode: { kind: "code", markName: "CodeMark" },
};

export function getFormattedSpans(state: EditorState): FormattedSpan[] {
  const spans: FormattedSpan[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      const heading = /^ATXHeading[1-6]$/.test(node.name);
      if (heading) {
        const mark = node.node.getChild("HeaderMark");
        if (!mark) return false;

        const line = state.doc.lineAt(node.from);
        let contentFrom = mark.to;
        while (contentFrom < line.to && state.doc.sliceString(contentFrom, contentFrom + 1) === " ") {
          contentFrom += 1;
        }

        spans.push({
          kind: "heading",
          outerFrom: mark.from,
          outerTo: line.to,
          contentFrom,
          contentTo: line.to,
          markRanges: [{ from: mark.from, to: contentFrom }],
        });
        return;
      }

      const format = inlineFormats[node.name];
      if (!format) return;

      const marks = node.node.getChildren(format.markName);
      if (marks.length < 2) return false;

      const opening = marks[0];
      const closing = marks[marks.length - 1];
      spans.push({
        kind: format.kind,
        outerFrom: node.from,
        outerTo: node.to,
        contentFrom: opening.to,
        contentTo: closing.from,
        markRanges: marks.map((mark) => ({ from: mark.from, to: mark.to })),
      });
      return false;
    },
  });

  return spans.sort((a, b) => a.outerFrom - b.outerFrom || a.outerTo - b.outerTo);
}

export function formattedSpanAt(
  state: EditorState,
  position: number,
  side: "start" | "end",
): FormattedSpan | null {
  const spans = getFormattedSpans(state)
    .filter((span) => {
      if (side === "start") {
        return position >= span.outerFrom && position <= span.contentFrom;
      }
      return position >= span.contentTo && position <= span.outerTo;
    })
    .sort((a, b) => (a.outerTo - a.outerFrom) - (b.outerTo - b.outerFrom));

  return spans[0] ?? null;
}

function normalizeSelectionBoundary(
  state: EditorState,
  position: number,
  side: "start" | "end",
): number {
  const span = formattedSpanAt(state, position, side);
  if (!span) return position;
  return side === "start" ? span.contentFrom : span.contentTo;
}

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
