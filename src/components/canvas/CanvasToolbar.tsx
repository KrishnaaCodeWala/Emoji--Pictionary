'use client';
// TODO (Track B)
export interface CanvasToolbarProps {
  tool: 'brush' | 'eraser' | 'fill';
  color: string;
  size: number;
  onTool: (t: 'brush' | 'eraser' | 'fill') => void;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  disabled?: boolean;
}
export default function CanvasToolbar(_p: CanvasToolbarProps) { return null; }
