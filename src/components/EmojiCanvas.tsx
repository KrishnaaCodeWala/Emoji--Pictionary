import { isImageContent } from '@/lib/canvasContent';

export interface EmojiCanvasProps {
  emojis: string;
}

export default function EmojiCanvas({ emojis }: EmojiCanvasProps) {
  return (
    <div
      className={`flex min-h-40 w-full items-center justify-center rounded-lg border bg-surface p-4 ${
        emojis ? 'border-border' : 'border-dashed border-border'
      }`}
    >
      {isImageContent(emojis) ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL snapshot, not a static asset
        <img src={emojis} alt="drawing" className="max-h-full max-w-full object-contain" />
      ) : emojis ? (
        <p className="break-all text-center text-4xl leading-relaxed sm:text-5xl">{emojis}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Waiting for the artist to start drawing…</p>
      )}
    </div>
  );
}
