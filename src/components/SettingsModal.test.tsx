// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";
import { useAiStore } from "../store/aiStore";
import { useEditorStore } from "../store/editorStore";
import { insertTextAtSelection } from "../lib/inputOps";

const { saveAiConfigMock, testAiConnectionMock } = vi.hoisted(() => ({
  saveAiConfigMock: vi.fn(),
  testAiConnectionMock: vi.fn(),
}));

const { rebuildMenuMock } = vi.hoisted(() => ({
  rebuildMenuMock: vi.fn(),
}));

vi.mock("../lib/ai", async () => {
  const actual = await vi.importActual<typeof import("../lib/ai")>("../lib/ai");
  return {
    ...actual,
    saveAiConfig: saveAiConfigMock,
    testAiConnection: testAiConnectionMock,
  };
});

vi.mock("../lib/menu", () => ({ rebuildMenu: rebuildMenuMock }));

describe("SettingsModal", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    rebuildMenuMock.mockResolvedValue(undefined);
    useEditorStore.setState({ lang: "zh" });
    useAiStore.setState({
      provider: "anthropic",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "",
      isGenerating: false,
      error: null,
    });
    saveAiConfigMock.mockResolvedValue({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      apiKey: "sk-test",
    });
    testAiConnectionMock.mockResolvedValue(undefined);
  });

  it("focuses Base URL when opened and saves the provider settings", async () => {
    const onClose = vi.fn();
    render(<SettingsModal open onClose={onClose} />);

    const baseUrl = screen.getByDisplayValue("https://api.openai.com/v1");
    await waitFor(() => expect(document.activeElement).toBe(baseUrl));

    // Fill fields
    fireEvent.change(baseUrl, { target: { value: "https://api.anthropic.com" } });
    fireEvent.change(screen.getByDisplayValue("gpt-4o-mini"), { target: { value: "claude-3-5-sonnet" } });
    fireEvent.change(screen.getByPlaceholderText("粘贴 API Key"), { target: { value: "sk-test" } });

    // Submit the form directly
    const form = document.querySelector("form");
    expect(form).toBeTruthy();
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(saveAiConfigMock).toHaveBeenCalledWith({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      apiKey: "sk-test",
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

    insertTextAtSelection(screen.getByPlaceholderText("粘贴 API Key") as HTMLInputElement, "sk-test");
    const form = document.querySelector("form");
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(saveAiConfigMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test" }));
  });

  it("filters the settings page with the sidebar search", () => {
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "搜索设置..." }), { target: { value: "不存在" } });

    expect(screen.getByRole("heading", { name: "未找到设置" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "AI 服务" })).toBeNull();
  });

  it("shows the AI page when searching for commands by name", () => {
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "搜索设置..." }), { target: { value: "指令" } });

    expect(screen.getByRole("button", { name: "AI 服务" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "未找到设置" })).toBeNull();
  });

  it("changes the interface language from Appearance settings", async () => {
    const user = userEvent.setup();
    render(<SettingsModal open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "外观" }));
    await user.click(screen.getByRole("button", { name: "English" }));

    expect(useEditorStore.getState().lang).toBe("en");
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(rebuildMenuMock).toHaveBeenCalledOnce();
  });

});
