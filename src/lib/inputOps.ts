export type TextInputElement = HTMLInputElement | HTMLTextAreaElement;

let lastFocusedTextInput: TextInputElement | null = null;

function isTextInput(element: EventTarget | null): element is TextInputElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

export function trackTextInputFocus(target: EventTarget | null): void {
  lastFocusedTextInput = isTextInput(target) ? target : null;
}

export function getTextInputPasteTarget(): TextInputElement | null {
  if (isTextInput(document.activeElement)) return document.activeElement;
  if (lastFocusedTextInput?.isConnected && !lastFocusedTextInput.disabled && !lastFocusedTextInput.readOnly) {
    return lastFocusedTextInput;
  }
  return null;
}

export function getSelectedText(input: TextInputElement): string {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? start;
  return input.value.slice(start, end);
}

export function getSelectedDomText(): string | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const anchor = selection.anchorNode;
  const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
  if (anchorElement?.closest(".cm-editor")) return null;

  const text = selection.toString();
  return text.length > 0 ? text : null;
}

export function insertTextAtSelection(input: TextInputElement, text: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const nextValue = input.value.slice(0, start) + text + input.value.slice(end);
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, nextValue);
  const cursor = start + text.length;
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
