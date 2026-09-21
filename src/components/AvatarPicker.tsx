'use client';
// v5 Wave 1 Track C: Avatar picker — simplified to 5 animals.
import { AVATARS } from '@/lib/constants';

export interface AvatarPickerProps {
  value: string | null;
  onChange: (avatar: string) => void;
  className?: string;
}

export default function AvatarPicker({ value, onChange, className = '' }: AvatarPickerProps) {
  return (
    <div className={`flex flex-col gap-2 shrink-0 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0 text-center sm:text-left">
        Pick your avatar
      </p>
      
      <div className="flex justify-center sm:justify-start gap-2">
        {AVATARS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="option"
            aria-selected={value === emoji}
            onClick={() => onChange(emoji)}
            className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl text-xl sm:text-2xl transition-all duration-150 select-none border-2 ${
              value === emoji
                ? 'border-primary bg-primary/10 scale-110 shadow-md'
                : 'border-transparent bg-surface hover:border-border hover:bg-surface-muted hover:scale-105'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
