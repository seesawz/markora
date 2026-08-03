// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";
import { useAiStore } from "../store/aiStore";
import { insertTextAtSelection } from "../lib/inputOps";

const { saveAiConfigMock, testAiConnectionMock } = vi.hoisted(() => ({
  saveAiConfigMock: vi.fn(),
  testAiConnectionMock: vi.fn(),
}));

vi.mock("../lib/ai", async () => {
  const actual = await vi.importActual<typeof import("../lib/ai")>("../lib/ai");
  return {
    ...actual,
    saveAiConfig: saveAiConfigMock,
    testAiConnection: testAiConnectionMock,
  };
});

describe("SettingsModal", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    useAiStore.setState({
      provider: "anthropic",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKeyConfigured: false,
      enabled: false,
      isGenerating: false,
      error: null,
    });
    saveAiConfigMock.mockResolvedValue({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      apiKeyConfigured: true,
    });
    testAiConnectionMock.mockResolvedValue(undefined);
  });

  it("focuses Base URL when opened and saves pasted provider settings", async () => {
    const onClose = vi.fn();
    render(<SettingsModal open onClose={onClose} />);

    const baseUrl = screen.getByDisplayValue("https://api.openai.com/v1");
    await waitFor(() => expect(document.activeElement).toBe(baseUrl));
    const model = screen.getByDisplayValue("gpt-4o-mini");
    const apiKey = screen.getByPlaceholderText("粘贴 API Key");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "anthropic" } });
    fireEvent.change(baseUrl, { target: { value: "https://api.anthropic.com" } });
    fireEvent.change(model, { target: { value: "claude-3-5-sonnet" } });
    fireEvent.change(apiKey, { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(saveAiConfigMock).toHaveBeenCalledWith({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      apiKey: "sk-test",
      clearApiKey: false,
    });
  });

  it("tests the current settings without saving them", async () => {
    render(<SettingsModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("粘贴 API Key"), { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    await waitFor(() => expect(testAiConnectionMock).toHaveBeenCalledOnce());
    expect(saveAiConfigMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("连接成功");
  });

  it("keeps native-menu pasted API keys in the controlled settings field", async () => {
    const onClose = vi.fn();
    render(<SettingsModal open onClose={onClose} />);

    insertTextAtSelection(screen.getByPlaceholderText("粘贴 API Key"), "sk-test");
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(saveAiConfigMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test" }));
  });

  it("filters the settings page with the sidebar search", () => {
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "搜索设置" }), { target: { value: "不存在" } });

    expect(screen.getByRole("heading", { name: "未找到设置" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "AI 服务" })).toBeNull();
  });

  it("shows the AI page when searching for the completion feature by name", () => {
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "搜索设置" }), { target: { value: "续写" } });

    expect(screen.getByRole("button", { name: "AI 服务" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "未找到设置" })).toBeNull();
  });

  it("enables inline completion after an API Key is configured", () => {
    useAiStore.setState({ apiKeyConfigured: true });
    render(<SettingsModal open onClose={vi.fn()} />);

    const toggle = screen.getByRole("switch", { name: "开启 AI 续写" });
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(useAiStore.getState().enabled).toBe(true);
  });
});
