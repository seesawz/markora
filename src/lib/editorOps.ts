import { findClusterBreak, type EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

type FormatBoundary = {
  nodeFrom: number;
  nodeTo: number;
  contentFrom: number;
  contentTo: number;
};

const formatMarks: Record<string, string> = {
  StrongEmphasis: "EmphasisMark",
  Emphasis: "EmphasisMark",
  Strikethrough: "StrikethroughMark",
  InlineCode: "CodeMark",
};

const protectedMarkdownMarks = new Set([
  "HeaderMark",
  "SetextMark",
  "EmphasisMark",
  "StrikethroughMark",
  "CodeMark",
  "LinkMark",
  "URL",
  "QuoteMark",
  "ListMark",
  "TaskMarker",
]);

function protectedRanges(state: EditorState, from: number, to: number): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (protectedMarkdownMarks.has(node.name) && node.from < to && node.to > from) {
        ranges.push({ from: Math.max(node.from, from), to: Math.min(node.to, to) });
      }
    },
  });

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  return ranges.filter((range, index) => index === 0 || range.from > ranges[index - 1].to);
}

function deleteSelectionPreservingMarkdown(view: EditorView): boolean {
  const selection = view.state.selection.main;
  if (selection.empty) return false;

  const ranges = protectedRanges(view.state, selection.from, selection.to);
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  let cursor = selection.from;

  for (const range of ranges) {
    if (cursor < range.from) changes.push({ from: cursor, to: range.from, insert: "" });
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < selection.to) changes.push({ from: cursor, to: selection.to, insert: "" });
  if (changes.length === 0) return false;

  let anchor = selection.from;
  for (const range of ranges) {
    if (range.from <= anchor && anchor < range.to) anchor = range.to;
    else if (range.from > anchor) break;
  }

  const changeSet = view.state.changes(changes);
  view.dispatch({
    changes,
    selection: { anchor: changeSet.mapPos(anchor, -1) },
  });
  return true;
}

function formatBoundaryAt(state: EditorState, position: number): FormatBoundary | null {
  let result: FormatBoundary | null = null;
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      const markName = formatMarks[node.name];
      if (!markName || position < node.from || position > node.to) return;

      const marks = node.node.getChildren(markName);
      if (marks.length < 2) return;

      const opening = marks[0];
      const closing = marks[marks.length - 1];
      const contentFrom = opening.to;
      const contentTo = closing.from;
      if (position !== node.to && position !== contentFrom && position !== contentTo) return;

      const boundary = {
        nodeFrom: node.from,
        nodeTo: node.to,
        contentFrom,
        contentTo,
      };
      if (!result || boundary.nodeTo - boundary.nodeFrom < result.nodeTo - result.nodeFrom) {
        result = boundary;
      }
    },
  });

  return result;
}

const emptyFormatMarkers = ["**", "__", "~~", "`", "*", "_"];

function deleteEmptyFormat(view: EditorView, position: number): boolean {
  const line = view.state.doc.lineAt(position);
  const column = position - line.from;

  for (const marker of emptyFormatMarkers) {
    const start = column - marker.length;
    const end = column + marker.length;
    if (start < 0 || end > line.text.length) continue;
    if (line.text.slice(start, column) !== marker || line.text.slice(column, end) !== marker) continue;

    const from = line.from + start;
    const to = line.from + end;
    view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor: from } });
    return true;
  }

  return false;
}

// Typora-like deletion: consume formatted content before touching its delimiters.
export function deleteBackward(view: EditorView): boolean {
  const selection = view.state.selection.main;
  if (!selection.empty) return deleteSelectionPreservingMarkdown(view);

  const position = selection.head;
  const format = formatBoundaryAt(view.state, position);
  if (format && position >= format.contentTo && format.contentTo > format.contentFrom) {
    const from = findClusterBreak(view.state.doc.toString(), format.contentTo, false);
    if (from >= format.contentFrom) {
      view.dispatch({ changes: { from, to: format.contentTo, insert: "" }, selection: { anchor: from } });
      return true;
    }
  }

  return deleteEmptyFormat(view, position);
}

export function deleteForward(view: EditorView): boolean {
  const selection = view.state.selection.main;
  if (!selection.empty) return deleteSelectionPreservingMarkdown(view);

  const position = selection.head;
  const format = formatBoundaryAt(view.state, position);
  if (format && position <= format.contentFrom && format.contentTo > format.contentFrom) {
    const to = findClusterBreak(view.state.doc.toString(), format.contentFrom, true);
    if (to <= format.contentTo) {
      view.dispatch({ changes: { from: format.contentFrom, to, insert: "" }, selection: { anchor: position } });
      return true;
    }
  }

  return deleteEmptyFormat(view, position);
}

// 加粗/斜体/插入链接 —— keymap 和右键菜单共用
export function wrapSelection(view: EditorView, marker: string): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;
  const selected = view.state.doc.sliceString(from, to);
  view.dispatch({
    changes: { from, to, insert: `${marker}${selected}${marker}` },
    selection: { anchor: from + marker.length, head: to + marker.length },
  });
  return true;
}

export function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to) || "text";
  view.dispatch({
    changes: { from, to, insert: `[${selected}](url)` },
    selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
  });
  return true;
}
