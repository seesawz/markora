// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusBar } from "./StatusBar";
import { useAiStore } from "../store/aiStore";

describe("StatusBar AI toggle", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAiStore.setState({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKeyConfigured: false,
      enabled: false,
      isGenerating: false,
      error: null,
    });
  });

  it("opens settings instead of enabling when no API key is configured", () => {
    const onOpenSettings = vi.fn();
    render(<StatusBar onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByTitle("开启或关闭 AI 续写"));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(useAiStore.getState().enabled).toBe(false);
  });

  it("toggles completion on when an API key is already configured", () => {
    useAiStore.setState({ apiKeyConfigured: true });
    render(<StatusBar onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByTitle("开启或关闭 AI 续写"));

    expect(useAiStore.getState().enabled).toBe(true);
  });
});
