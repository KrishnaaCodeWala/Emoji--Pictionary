'use client';
// TODO (Track C)
import type { AlbumChainRes } from '@/lib/types';
export interface AlbumViewerProps {
  album: AlbumChainRes | null;
  isHost: boolean;
  onNext: () => void;
  advancing?: boolean;
}
export default function AlbumViewer(_p: AlbumViewerProps) { return null; }
