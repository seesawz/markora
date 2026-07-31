import type { EditorView } from "@codemirror/view";

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
