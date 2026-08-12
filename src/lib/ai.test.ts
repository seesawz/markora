import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeAi,
  normalizeAiText,
} from "./ai";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

describe("AI response normalization", () => {
  it("removes a complete Markdown code fence", () => {
    expect(normalizeAiText("```ts\nconst answer = 42;\n```")).toBe("const answer = 42;");
  });

  it("trims surrounding whitespace without changing content", () => {
    expect(normalizeAiText("  hello\nworld  ")).toBe("hello\nworld");
  });
});

describe("AI invoke wrapper", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invokes the native completion command with the provider config", async () => {
    invokeMock.mockResolvedValue("generated text");

    await expect(completeAi({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      prompt: "写一段话",
    })).resolves.toBe("generated text");

    expect(invokeMock).toHaveBeenCalledWith("complete_ai", {
      request: {
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com",
        model: "claude-3-5-sonnet",
        prompt: "写一段话",
      },
    });
  });
});
