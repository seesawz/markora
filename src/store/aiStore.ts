import { create } from "zustand";
import { getAiConfig, type AiConfig, type AiProvider } from "../lib/ai";

interface AiState extends AiConfig {
  enabled: boolean;
  isGenerating: boolean;
  error: string | null;
  setConfig: (config: AiConfig) => void;
  setEnabled: (enabled: boolean) => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  loadConfig: () => Promise<void>;
}

const defaultConfig: AiConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKeyConfigured: false,
};

export const useAiStore = create<AiState>((set) => ({
  ...defaultConfig,
  enabled: false,
  isGenerating: false,
  error: null,

  setConfig: (config) => set(config),
  setEnabled: (enabled) => set({ enabled, error: null }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  loadConfig: async () => {
    const config = await getAiConfig();
    set(config);
  },
}));

export type { AiProvider };
