export const TOAST_EVENT = "markora:toast";

export function showErrorToast(action: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: `${action}失败：${detail}` }));
}
