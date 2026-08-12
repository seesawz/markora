import { useEditorStore } from "../store/editorStore";

const dict = {
  zh: {
    // StatusBar
    saved: "已保存",
    unsaved: "未保存",
    words: "词",
    chars: "字符",
    untitled: "未命名.md",
    editorPlaceholder: "开始输入...",
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
    // Settings
    settingsSearch: "搜索设置...",
    settingsAiCompletion: "AI 服务",
    settingsAppearance: "外观",
    settingsLanguage: "语言",
    settingsLanguageDesc: "设置界面的显示语言",
    modelService: "模型服务",
    apiFormat: "API 格式",
    apiFormatDesc: "选择模型服务使用的请求协议",
    baseUrl: "Base URL",
    modelName: "模型名称",
    modelNameDesc: "服务商提供的模型名称",
    apiKey: "API Key",
    apiKeyDesc: "保存在本地配置文件中",
    testConnection: "测试连接",
    connectionSuccess: "连接成功。",
    apiKeyPlaceholder: "粘贴 API Key",
    closeSettings: "关闭设置",
    notFound: "未找到设置",
    notFoundDesc: "试试搜索 “AI”、“模型” 或 “API Key”。",
    zhLanguage: "简体中文",
    enLanguage: "English",
  },
  en: {
    saved: "Saved",
    unsaved: "Unsaved",
    words: "words",
    chars: "chars",
    untitled: "Untitled.md",
    editorPlaceholder: "Start typing...",
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
    // Settings
    settingsSearch: "Search settings...",
    settingsAiCompletion: "AI Service",
    settingsAppearance: "Appearance",
    settingsLanguage: "Language",
    settingsLanguageDesc: "Display language for the interface",
    modelService: "Model service",
    apiFormat: "API format",
    apiFormatDesc: "Request protocol used by the model service",
    baseUrl: "Base URL",
    modelName: "Model name",
    modelNameDesc: "Model name from your provider",
    apiKey: "API Key",
    apiKeyDesc: "Stored in your local config file",
    testConnection: "Test connection",
    connectionSuccess: "Connection successful.",
    apiKeyPlaceholder: "Paste API Key",
    closeSettings: "Close settings",
    notFound: "No settings found",
    notFoundDesc: "Try searching for \"AI\", \"model\", or \"API Key\".",
    zhLanguage: "简体中文",
    enLanguage: "English",
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
