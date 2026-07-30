import { useEditorStore } from "../store/editorStore";

const dict = {
  zh: {
    // StatusBar
    saved: "已保存",
    unsaved: "未保存",
    words: "词",
    chars: "字符",
    edit: "编辑",
    preview: "预览",
    untitled: "未命名.md",
    // Context menu
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    selectAll: "全选",
    undo: "撤销",
    redo: "重做",
    bold: "加粗",
    italic: "斜体",
    insertLink: "插入链接",
    // Dialogs
    unsavedTitle: "未保存的更改",
    unsavedMsg: (name: string) => `"${name}" 有未保存的更改。是否先保存？`,
    save: "保存",
    discard: "不保存",
    markdown: "Markdown",
    // Find & Replace
    findPlaceholder: "查找",
    replacePlaceholder: "替换",
    prev: "上一个",
    next: "下一个",
    replace: "替换",
    replaceAll: "全部替换",
    noResults: "无结果",
    close: "关闭",
  },
  en: {
    saved: "Saved",
    unsaved: "Unsaved",
    words: "words",
    chars: "chars",
    edit: "Edit",
    preview: "Preview",
    untitled: "Untitled.md",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    undo: "Undo",
    redo: "Redo",
    bold: "Bold",
    italic: "Italic",
    insertLink: "Insert Link",
    unsavedTitle: "Unsaved changes",
    unsavedMsg: (name: string) => `"${name}" has unsaved changes. Save before continuing?`,
    save: "Save",
    discard: "Discard",
    markdown: "Markdown",
    findPlaceholder: "Find",
    replacePlaceholder: "Replace",
    prev: "Previous",
    next: "Next",
    replace: "Replace",
    replaceAll: "Replace All",
    noResults: "No results",
    close: "Close",
  },
} as const;

export type TKey = keyof (typeof dict)["zh"];

export function t<K extends TKey>(key: K): (typeof dict)["zh"][K] {
  const lang = useEditorStore.getState().lang;
  return dict[lang][key] as (typeof dict)["zh"][K];
}

// ponytail: hook version for reactive components
export function useT() {
  const lang = useEditorStore((s) => s.lang);
  return dict[lang];
}
