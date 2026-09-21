'use client';
import { useEffect, useRef, useState } from 'react';
import type { StrokeEvent } from '@/lib/types';
import {
  CANVAS_W,
  CANVAS_H,
  CANVAS_BG,
  CANVAS_BRUSHES,
  CANVAS_COLORS,
  CANVAS_SNAPSHOT_DEBOUNCE_MS,
  STROKE_BATCH_MAX_POINTS,
} from '@/lib/constants';
import { floodFill, hexToRgba } from '@/lib/floodFill';
import CanvasToolbar from './CanvasToolbar';

export interface DrawCanvasProps {
  /** snapshot data URL to restore from (e.g. after reload); '' = blank */
  value: string;
  /** identity used in broadcast events */
  playerId: string;
  round: number;
  onStroke?: (s: StrokeEvent) => void;
  /** called with a PNG data URL on pointer-up (debounced), fill, undo and clear */
  onSnapshot: (dataUrl: string) => void;
  disabled?: boolean;
  className?: string;
}

const BATCH_MS = 33;

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DrawCanvas({ value, playerId, round, onStroke, onSnapshot, disabled, className }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);
  const strokeIdRef = useRef('');
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef('');

  const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');
  const [color, setColor] = useState<string>(CANVAS_COLORS[0]);
  const [size, setSize] = useState<number>(CANVAS_BRUSHES[1]);
  const [canUndo, setCanUndo] = useState(false);

  // Init the canvas: white background.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  // Restore/clear when `value` changes from outside (not one we just produced ourselves).
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (value === lastSnapshotRef.current) return;
    if (!value) {
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      lastSnapshotRef.current = '';
      return;
    }
    const img = new Image();
    img.onload = () => {
      const c = ctxRef.current;
      if (!c) return;
      c.fillStyle = CANVAS_BG;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      lastSnapshotRef.current = value;
    };
    img.src = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    };
  }, []);

  function takeSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    lastSnapshotRef.current = dataUrl;
    onSnapshot(dataUrl);
  }

  function scheduleSnapshot() {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      snapshotTimerRef.current = null;
      takeSnapshot();
    }, CANVAS_SNAPSHOT_DEBOUNCE_MS);
  }

  function pushUndo() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    setCanUndo(undoStackRef.current.length > 0);
  }

  function flushBatch() {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (pointsRef.current.length === 0) return;
    const pts = pointsRef.current;
    pointsRef.current = [];
    onStroke?.({
      playerId,
      round,
      id: strokeIdRef.current,
      tool: tool === 'eraser' ? 'eraser' : 'brush',
      color,
      size,
      points: pts,
      kind: 'segment',
    });
  }

  function scheduleFlush() {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushBatch();
    }, BATCH_MS);
  }

  function toLogicalPoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? CANVAS_W / rect.width : 1;
    const scaleY = rect.height > 0 ? CANVAS_H / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function strokeSegment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = tool === 'eraser' ? CANVAS_BG : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const pt = toLogicalPoint(e);

    if (tool === 'fill') {
      pushUndo();
      const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      floodFill(img, Math.round(pt.x), Math.round(pt.y), hexToRgba(color), 32);
      ctx.putImageData(img, 0, 0);
      onStroke?.({ playerId, round, id: genId(), tool: 'brush', color, size, points: [pt], kind: 'fill' });
      takeSnapshot();
      return;
    }

    pushUndo();
    drawingRef.current = true;
    strokeIdRef.current = genId();
    lastPointRef.current = pt;
    pointsRef.current = [pt];
    strokeSegment(pt, { x: pt.x + 0.01, y: pt.y + 0.01 });
    scheduleFlush();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const pt = toLogicalPoint(e);
    const last = lastPointRef.current;
    if (last) strokeSegment(last, pt);
    lastPointRef.current = pt;
    pointsRef.current.push(pt);
    if (pointsRef.current.length >= STROKE_BATCH_MAX_POINTS) {
      flushBatch();
    } else {
      scheduleFlush();
    }
  }

  function endStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    flushBatch();
    lastPointRef.current = null;
    scheduleSnapshot();
  }

  function handleUndo() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const prev = undoStackRef.current.pop();
    setCanUndo(undoStackRef.current.length > 0);
    if (prev) {
      ctx.putImageData(prev, 0, 0);
    } else {
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    onStroke?.({ playerId, round, id: genId(), tool: 'brush', color, size, points: [], kind: 'undo' });
    takeSnapshot();
  }

  function handleClear() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    pushUndo();
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    onStroke?.({ playerId, round, id: genId(), tool: 'brush', color, size, points: [], kind: 'clear' });
    takeSnapshot();
  }

  return (
    <div className={`flex w-full flex-col gap-2 ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: '100%', aspectRatio: '4 / 3', touchAction: 'none', background: CANVAS_BG }}
        className="rounded-xl border border-border"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      />
      <CanvasToolbar
        tool={tool}
        color={color}
        size={size}
        onTool={setTool}
        onColor={setColor}
        onSize={setSize}
        onUndo={handleUndo}
        onClear={handleClear}
        canUndo={canUndo}
        disabled={disabled}
      />
    </div>
  );
}
