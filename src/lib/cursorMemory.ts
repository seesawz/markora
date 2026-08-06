// 每个文件最近的光标位置与滚动位置,切换标签/文件时恢复(Obsidian 式会话记忆)
// 不进 zustand:每次击键都变,入 store 会触发无关组件重渲染
export interface EditorSpot {
  pos: number;
  scrollTop: number;
}

const spots = new Map<string, EditorSpot>();

export function rememberSpot(path: string, spot: EditorSpot): void {
  spots.set(path, spot);
}

export function recallSpot(path: string): EditorSpot | null {
  return spots.get(path) ?? null;
}

export function forgetSpot(path: string): void {
  spots.delete(path);
}
