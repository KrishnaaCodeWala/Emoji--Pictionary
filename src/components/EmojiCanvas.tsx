export interface EmojiCanvasProps {
  emojis: string;
}

export default function EmojiCanvas({ emojis }: EmojiCanvasProps) {
  return (
    <div className="flex min-h-40 w-full items-center justify-center rounded-lg border border-white/10 bg-black/20 p-4">
      {emojis ? (
        <p className="break-all text-center text-4xl leading-relaxed sm:text-5xl">{emojis}</p>
      ) : (
        <p className="text-center text-sm text-white/40">Waiting for the artist...</p>
      )}
    </div>
  );
}
