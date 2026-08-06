import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ponytail: shadcn/ui 标准的 className 合并工具
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 拆出 Markdown 扩展名:展示/重命名只暴露主文件名,扩展名自动保留 */
export function splitFileName(name: string): { base: string; ext: string } {
  const match = name.match(/\.(md|markdown)$/i);
  if (!match) return { base: name, ext: "" };
  return { base: name.slice(0, -match[0].length), ext: match[0] };
}
