import { invoke } from "@tauri-apps/api/core";
import type { EditorView } from "@codemirror/view";

export type AiProvider = "openai" | "anthropic";

export interface AiConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
}

export interface SaveAiConfigInput {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearApiKey: boolean;
}

export interface CompleteAiInput {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  prompt: string;
}

export async function getAiConfig(): Promise<AiConfig> {
  return invoke<AiConfig>("get_ai_config");
}

export async function saveAiConfig(input: SaveAiConfigInput): Promise<AiConfig> {
  return invoke<AiConfig>("save_ai_config", { request: input });
}

export async function testAiConnection(input: SaveAiConfigInput): Promise<void> {
  await invoke("test_ai_connection", { request: input });
}

export async function completeAi(input: CompleteAiInput): Promise<string> {
  return invoke<string>("complete_ai", { request: input });
}

const MAX_CONTEXT_CHARS = 12000;

export function getEditorContext(view: EditorView): { from: number; to: number; text: string } {
  const { from, to } = view.state.selection.main;
  const start = Math.max(0, from - MAX_CONTEXT_CHARS / 2);
  const end = Math.min(view.state.doc.length, to + MAX_CONTEXT_CHARS / 2);
  return { from, to, text: view.state.doc.sliceString(start, end) };
}

export function buildCommandPrompt(view: EditorView, instruction: string): string {
  const context = getEditorContext(view);
  const selection = view.state.doc.sliceString(context.from, context.to);
  return [
    "你是 Markora 的 Markdown 编辑助手。",
    "请根据用户指令生成将要写入文档的内容。只返回内容本身，不要解释，不要添加“好的”“下面是”等前缀。",
    `用户指令：${instruction.trim()}`,
    selection ? `当前选中的内容：\n${selection}` : "当前没有选中的内容。",
    `文档上下文：\n${context.text}`,
  ].join("\n\n");
}

export function buildInlinePrompt(view: EditorView): string {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const before = view.state.doc.sliceString(Math.max(0, from - 6000), from);
  const after = view.state.doc.sliceString(from, Math.min(view.state.doc.length, from + 2500));
  return [
    "你是 Markora 的代码和 Markdown 续写助手。",
    "只返回光标后的续写内容，不要解释，不要重复光标前已有内容，不要添加 Markdown 代码围栏。",
    `当前行：${line.text}`,
    `光标前内容：\n${before}`,
    `光标后内容：\n${after}`,
  ].join("\n\n");
}

export function normalizeAiText(raw: string): string {
  const text = raw.trim();
  const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  return (fenced ? fenced[1] : text).trim();
}
