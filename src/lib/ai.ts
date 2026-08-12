import { invoke } from "@tauri-apps/api/core";

export type AiProvider = "openai" | "anthropic";

export interface AiConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface SaveAiConfigInput {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
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

export function normalizeAiText(raw: string): string {
  const text = raw.trim();
  const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  return (fenced ? fenced[1] : text).trim();
}
