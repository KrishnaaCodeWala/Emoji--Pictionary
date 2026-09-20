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
      {emojis ? (
        <p className="break-all text-center text-4xl leading-relaxed sm:text-5xl">{emojis}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Waiting for the artist to start drawing…</p>
      )}
    </div>
  );
}
