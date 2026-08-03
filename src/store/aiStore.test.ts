import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStore } from "./aiStore";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

describe("aiStore", () => {
  beforeEach(() => {
    useAiStore.setState({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKeyConfigured: true,
      enabled: true,
      isGenerating: false,
      error: null,
    });
    invokeMock.mockReset();
  });

  it("disables completion when a config without an API key is applied", () => {
    useAiStore.getState().setConfig({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKeyConfigured: false,
    });

    expect(useAiStore.getState().apiKeyConfigured).toBe(false);
    expect(useAiStore.getState().enabled).toBe(false);
  });

  it("keeps completion enabled when a config still has an API key", () => {
    useAiStore.getState().setConfig({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      apiKeyConfigured: true,
    });

    expect(useAiStore.getState().enabled).toBe(true);
    expect(useAiStore.getState().provider).toBe("anthropic");
  });
});
