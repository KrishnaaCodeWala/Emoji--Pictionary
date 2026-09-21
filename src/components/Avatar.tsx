// v5 Wave 1 Track C: Reusable avatar display component.
import type { Player } from '@/lib/types';

export interface AvatarProps {
  /** The emoji avatar string, or null to show initials fallback. */
  avatar: string | null | undefined;
  /** Player nickname — used for initials fallback and aria-label. */
  nickname?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-base',
  md: 'h-9 w-9 text-xl',
  lg: 'h-12 w-12 text-2xl',
};

export default function Avatar({ avatar, nickname, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const label = nickname ?? 'Player';

  return (
    <span
      aria-label={`${label} avatar`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface select-none ${sizeClass} ${className}`}
    >
      {avatar ? (
        <span aria-hidden>{avatar}</span>
      ) : (
        <span className="text-xs font-bold text-muted-foreground" aria-hidden>
          {label.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** Convenience: build Avatar props from a Player. */
export function avatarFromPlayer(p: Player): AvatarProps {
  return { avatar: p.avatar, nickname: p.nickname };
}
