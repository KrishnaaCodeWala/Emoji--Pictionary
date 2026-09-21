'use client';
// v5 Wave 1 Track C: Avatar picker — grid of 48 curated emojis, paginated.
import { AVATARS } from '@/lib/constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export interface AvatarPickerProps {
  value: string | null;
  onChange: (avatar: string) => void;
  className?: string;
}

export default function AvatarPicker({ value, onChange, className = '' }: AvatarPickerProps) {
  const [page, setPage] = useState(0);
  const avatarsPerPage = 24;
  const totalPages = Math.ceil(AVATARS.length / avatarsPerPage);
  
  const handlePrev = () => setPage((p) => (p - 1 + totalPages) % totalPages);
  const handleNext = () => setPage((p) => (p + 1) % totalPages);
  
  const currentAvatars = AVATARS.slice(page * avatarsPerPage, (page + 1) * avatarsPerPage);

  return (
    <div className={`flex flex-col gap-2 shrink-0 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0 text-center sm:text-left">
        Pick your avatar
      </p>
      
      <div className="flex items-center gap-1 sm:gap-2">
        <button 
          type="button" 
          onClick={handlePrev}
          aria-label="Previous avatars"
          className="p-1 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-full transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div
          className="grid gap-1.5 sm:gap-2 flex-1 justify-items-center"
          style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
          role="listbox"
          aria-label="Avatar picker"
        >
          {currentAvatars.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={value === emoji}
              onClick={() => onChange(emoji)}
              className={`flex aspect-square w-full max-w-[2.5rem] items-center justify-center rounded-xl text-lg sm:text-xl transition-all duration-150 select-none border-2 ${
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

        <button 
          type="button" 
          onClick={handleNext}
          aria-label="Next avatars"
          className="p-1 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-full transition-colors shrink-0"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Page ${i + 1}`}
              onClick={() => setPage(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === page ? 'w-4 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
