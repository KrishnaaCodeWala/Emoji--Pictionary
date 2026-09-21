// ~120 emoji-friendly nouns for the drawing round, broken into difficulty.
export const WORDS_EASY: string[] = [
  'pizza', 'rainbow', 'snowman', 'robot', 'ghost', 'alien', 'dragon', 'unicorn',
  'castle', 'rocket', 'airplane', 'car', 'bicycle', 'train', 'boat', 'ship',
  'balloon', 'umbrella', 'camera', 'guitar', 'piano', 'drum', 'crown', 'ring',
  'diamond', 'key', 'lock', 'candle', 'clock', 'gift', 'kite', 'flag', 'book',
  'letter', 'scissors', 'pencil', 'mountain', 'volcano', 'island', 'beach', 
  'tree', 'flower', 'sun', 'moon', 'star', 'cloud', 'lightning', 'fire', 'wave',
  'dog', 'cat', 'mouse', 'rabbit', 'fox', 'bear', 'tiger', 'lion', 'elephant',
  'giraffe', 'monkey', 'penguin', 'owl', 'eagle', 'chicken', 'duck', 'bee',
  'butterfly', 'spider', 'fish', 'shark', 'whale', 'dolphin', 'snake', 'turtle', 
  'frog', 'dinosaur', 'hamburger', 'hotdog', 'taco', 'donut', 'cupcake', 'cake',
  'icecream', 'cookie', 'chocolate', 'candy', 'popcorn', 'sandwich', 'pancake', 
  'apple', 'banana', 'grapes', 'watermelon', 'strawberry', 'pineapple', 'lemon', 
  'cherry', 'carrot', 'corn', 'potato', 'egg', 'cheese',
];

export const WORDS_NORMAL: string[] = [
  'submarine', 'anchor', 'compass', 'telescope', 'trumpet', 'violin', 'microphone', 
  'headphones', 'gem', 'lightbulb', 'flashlight', 'magnet', 'hourglass', 'calendar', 
  'balloon animal', 'trophy', 'medal', 'target', 'dice', 'puzzle', 'chess', 'cards', 
  'newspaper', 'envelope', 'paintbrush', 'palette', 'crayon', 'magnifying glass',
  'globe', 'map', 'desert', 'forest', 'cactus', 'sunflower', 'rose', 'tulip', 
  'mushroom', 'leaf', 'seed', 'tornado', 'snowflake', 'droplet', 'rainbow flag', 
  'sunrise', 'sunset', 'planet', 'saturn', 'comet', 'meteor', 'astronaut', 'satellite', 
  'ufo', 'panda', 'koala', 'zebra', 'gorilla', 'kangaroo', 'parrot', 'flamingo', 
  'peacock', 'turkey', 'ladybug', 'snail', 'octopus', 'crab', 'seahorse', 'lizard',
  'sushi', 'pretzel', 'waffle', 'pepper', 'broccoli', 'avocado',
];

export const WORDS_HARD: string[] = [
  'telescope glass', 'oxymoron', 'metaphor', 'paradox', 'irony', 'schadenfreude',
  'existentialism', 'nihilism', 'solipsism', 'epistemology', 'ontology',
];

export const WORDS: string[] = [...WORDS_EASY, ...WORDS_NORMAL, ...WORDS_HARD];

/** Pick a random word, optionally avoiding the previous one. */
export function pickWord(exclude?: string | null, difficulty?: 'easy' | 'normal' | 'hard', customWords?: string[]): string {
  if (customWords && customWords.length > 0) {
    const customPool = exclude ? customWords.filter((w) => w !== exclude) : customWords;
    if (customPool.length > 0) return customPool[Math.floor(Math.random() * customPool.length)];
  }

  let basePool = WORDS;
  if (difficulty === 'easy') basePool = WORDS_EASY;
  else if (difficulty === 'hard') basePool = WORDS_HARD;
  else if (difficulty === 'normal') basePool = WORDS_NORMAL;

  const pool = exclude ? basePool.filter((w) => w !== exclude) : basePool;
  const source = pool.length > 0 ? pool : basePool;
  return source[Math.floor(Math.random() * source.length)] ?? WORDS[0];
}
