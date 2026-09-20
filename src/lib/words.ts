// ~120 emoji-friendly nouns for the drawing round.
export const WORDS: string[] = [
  'pizza', 'rainbow', 'snowman', 'robot', 'ghost', 'alien', 'dragon', 'unicorn',
  'castle', 'rocket', 'airplane', 'car', 'bicycle', 'train', 'boat', 'ship',
  'submarine', 'balloon', 'umbrella', 'anchor', 'compass', 'telescope', 'camera', 'guitar',
  'piano', 'drum', 'trumpet', 'violin', 'microphone', 'headphones', 'crown', 'ring',
  'diamond', 'gem', 'key', 'lock', 'candle', 'lightbulb', 'flashlight', 'magnet',
  'clock', 'hourglass', 'calendar', 'gift', 'balloon animal', 'kite', 'flag', 'trophy',
  'medal', 'target', 'dice', 'puzzle', 'chess', 'cards', 'book', 'newspaper',
  'letter', 'envelope', 'scissors', 'paintbrush', 'palette', 'pencil', 'crayon', 'magnifying glass',
  'telescope glass', 'globe', 'map', 'mountain', 'volcano', 'island', 'beach', 'desert',
  'forest', 'tree', 'cactus', 'flower', 'sunflower', 'rose', 'tulip', 'mushroom',
  'leaf', 'seed', 'sun', 'moon', 'star', 'cloud', 'lightning', 'tornado',
  'snowflake', 'fire', 'wave', 'droplet', 'rainbow flag', 'sunrise', 'sunset', 'planet',
  'saturn', 'comet', 'meteor', 'astronaut', 'satellite', 'ufo', 'dog', 'cat',
  'mouse', 'rabbit', 'fox', 'bear', 'panda', 'koala', 'tiger', 'lion',
  'elephant', 'giraffe', 'zebra', 'monkey', 'gorilla', 'kangaroo', 'penguin', 'owl',
  'eagle', 'parrot', 'flamingo', 'peacock', 'chicken', 'duck', 'turkey', 'bee',
  'butterfly', 'ladybug', 'spider', 'snail', 'octopus', 'crab', 'fish', 'shark',
  'whale', 'dolphin', 'seahorse', 'snake', 'turtle', 'frog', 'lizard', 'dinosaur',
  'hamburger', 'hotdog', 'taco', 'sushi', 'donut', 'cupcake', 'cake', 'icecream',
  'cookie', 'chocolate', 'candy', 'popcorn', 'pretzel', 'sandwich', 'pancake', 'waffle',
  'apple', 'banana', 'grapes', 'watermelon', 'strawberry', 'pineapple', 'lemon', 'cherry',
  'carrot', 'corn', 'pepper', 'broccoli', 'avocado', 'potato', 'egg', 'cheese',
];

/** Pick a random word, optionally avoiding the previous one. */
export function pickWord(exclude?: string | null): string {
  const pool = exclude ? WORDS.filter((w) => w !== exclude) : WORDS;
  const source = pool.length > 0 ? pool : WORDS;
  return source[Math.floor(Math.random() * source.length)] ?? WORDS[0];
}
