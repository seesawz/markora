export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
}
