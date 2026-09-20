'use client';
// TODO (Track D)
import type { GameMode, RoomSettings } from '@/lib/types';
export interface ModePickerProps {
  mode: GameMode;
  settings: RoomSettings;
  /** false => read-only summary for non-hosts */
  editable: boolean;
  onChange: (mode: GameMode, settings: RoomSettings) => void;
}
export default function ModePicker(_p: ModePickerProps) { return null; }
