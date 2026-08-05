// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { getSelectedDomText, getSelectedText, getTextInputPasteTarget, insertTextAtSelection, trackTextInputFocus } from "./inputOps";

describe("insertTextAtSelection", () => {
  it("replaces the selected input range and emits an input event", () => {
    const input = document.createElement("input");
    input.value = "https://old.example";
    input.setSelectionRange(8, 11);
    const onInput = vi.fn();
    input.addEventListener("input", onInput);

    insertTextAtSelection(input, "new");

    expect(input.value).toBe("https://new.example");
    expect(input.selectionStart).toBe(11);
    expect(input.selectionEnd).toBe(11);
    expect(onInput).toHaveBeenCalledOnce();
  });

  it("reads the selected text for native-menu copy", () => {
    const input = document.createElement("input");
    input.value = "sk-secret-key";
    input.setSelectionRange(3, 9);

    expect(getSelectedText(input)).toBe("secret");
  });

  it("keeps the last focused settings field as the native-menu paste target", () => {
    const input = document.createElement("input");
    const menuButton = document.createElement("button");
    document.body.append(input, menuButton);

    trackTextInputFocus(input);
    menuButton.focus();

    expect(getTextInputPasteTarget()).toBe(input);

    trackTextInputFocus(menuButton);
    expect(getTextInputPasteTarget()).toBeNull();
    input.remove();
    menuButton.remove();
  });

  it("reads selected settings text without treating it as editor selection", () => {
    const dialog = document.createElement("div");
    dialog.className = "select-text";
    dialog.textContent = "API 地址说明";
    document.body.append(dialog);

    const range = document.createRange();
    range.selectNodeContents(dialog);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getSelectedDomText()).toBe("API 地址说明");
    dialog.remove();
    selection?.removeAllRanges();
  });
});
