'use client';
// Read-only canvas: draws `value` snapshot and replays live strokes.
import { useEffect, useRef } from 'react';
import type { StrokeEvent } from '@/lib/types';
import { CANVAS_W, CANVAS_H, CANVAS_BG } from '@/lib/constants';
import { floodFill, hexToRgba } from '@/lib/floodFill';

export interface CanvasViewProps { value: string; strokes: StrokeEvent[]; className?: string }

function applyStroke(ctx: CanvasRenderingContext2D, s: StrokeEvent, activeStrokes: Map<string, { x: number; y: number }>) {
  if (s.kind === 'clear') {
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    activeStrokes.clear();
    return;
  }
  if (s.kind === 'undo') {
    // Ignored: the drawer always follows an undo with a fresh snapshot.
    return;
  }
  if (s.kind === 'fill') {
    const pt = s.points[0];
    if (!pt) return;
    const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    floodFill(img, Math.round(pt.x), Math.round(pt.y), hexToRgba(s.color), 32);
    ctx.putImageData(img, 0, 0);
    return;
  }

  // 'segment' (default when kind is omitted)
  const points = s.points;
  if (points.length === 0) return;
  ctx.strokeStyle = s.tool === 'eraser' ? CANVAS_BG : s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const last = activeStrokes.get(s.id);
  ctx.beginPath();
  if (last) {
    ctx.moveTo(last.x, last.y);
    for (const p of points) ctx.lineTo(p.x, p.y);
  } else {
    const [first, ...rest] = points;
    ctx.moveTo(first.x, first.y);
    if (rest.length === 0) {
      ctx.lineTo(first.x + 0.01, first.y + 0.01);
    } else {
      for (const p of rest) ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
  activeStrokes.set(s.id, points[points.length - 1]);
}

export default function CanvasView({ value, strokes, className }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const appliedRef = useRef(0);
  const lastValueRef = useRef('');
  const activeStrokesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  // Draw the snapshot whenever `value` changes.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (!value) {
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const c = ctxRef.current;
      if (!c) return;
      c.fillStyle = CANVAS_BG;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
    };
    img.src = value;
  }, [value]);

  // Replay strokes incrementally: track how many have been applied in a ref, updated here.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (strokes.length < appliedRef.current) {
      // The buffer was reset (new round); resync from the start.
      appliedRef.current = 0;
      activeStrokesRef.current.clear();
    }
    for (let i = appliedRef.current; i < strokes.length; i++) {
      applyStroke(ctx, strokes[i], activeStrokesRef.current);
    }
    appliedRef.current = strokes.length;
  }, [strokes]);

  return (
    <div className={className} data-strokes={strokes.length}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: '100%', aspectRatio: '4 / 3', background: CANVAS_BG }}
        className="rounded-xl border border-border"
      />
    </div>
  );
}
