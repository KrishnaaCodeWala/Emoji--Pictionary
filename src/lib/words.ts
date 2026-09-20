// TODO (Track A)
export const WORDS: string[] = ['pizza'];
export function pickWord(exclude?: string | null): string {
  const pool = WORDS.filter((w) => w !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? WORDS[0];
}
