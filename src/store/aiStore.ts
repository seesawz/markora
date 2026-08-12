import { create } from "zustand";
import { getAiConfig, type AiConfig, type AiProvider } from "../lib/ai";

interface AiState extends AiConfig {
  isGenerating: boolean;
  error: string | null;
  setConfig: (config: AiConfig) => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  loadConfig: () => Promise<void>;
}

const defaultConfig: AiConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
};

export const useAiStore = create<AiState>((set) => ({
  ...defaultConfig,
  isGenerating: false,
  error: null,

  setConfig: (config) => set(config),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  loadConfig: async () => {
    const config = await getAiConfig();
    set(config);
  },
}));

export type { AiProvider };
