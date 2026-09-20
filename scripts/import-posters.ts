/**
 * Fill prompts.poster_url from Wikipedia lead images (keyless). Idempotent: only rows with a
 * null poster_url are touched unless --force is passed.
 *
 * Run: npx tsx scripts/import-posters.ts [--force] [--limit N] [--kind movie|series|game]
 *
 * Why Wikipedia: TMDB/RAWG need API keys; the MediaWiki API does not, and every well-known
 * title has an article whose infobox image is the poster / cover art. Those images are
 * non-free on Wikipedia, so `pilicense=any` is required or the API hides them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type Kind = 'movie' | 'series' | 'game';
interface PromptRow { id: string; kind: Kind; title: string; aliases: string[]; year: number | null; poster_url: string | null }

const USER_AGENT = 'EmojiPictionary/1.0 (https://emoji-pictionary.vercel.app; hobby party game)';
const DELAY_MS = 120;

function loadEnv(): Record<string, string> {
  const file = path.join(process.cwd(), '.env.local');
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchTerms(p: PromptRow): string[] {
  const y = p.year ? ` ${p.year}` : '';
  const suffix = p.kind === 'movie' ? 'film' : p.kind === 'series' ? 'TV series' : 'video game';
  const names = [p.title, ...(p.aliases ?? []).filter((a) => a.length > 3)];
  const terms: string[] = [];
  for (const n of names) terms.push(`${n}${y} ${suffix}`, `${n} ${suffix}`);
  terms.push(p.title);
  return terms;
}

interface WikiPage { title: string; thumbnail?: { source: string } }

async function wikiLookup(term: string): Promise<WikiPage | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=3' +
    `&gsrsearch=${encodeURIComponent(term)}` +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=500&pilicense=any&format=json';
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage & { index: number }> } };
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages[0] ?? null;
}

/** Accept the hit only if the page title and prompt title (or an alias) clearly refer to the same thing. */
function titlesMatch(prompt: string, page: string, aliases: string[] = []): boolean {
  if (aliases.some((al) => al.length > 3 && titlesMatch(al, page))) return true;
  const a = normalize(prompt);
  const b = normalize(page.replace(/\s*\(([^)]*(film|series|game|show|franchise)[^)]*)\)$/i, ''));
  if (a === b) return true;
  if (b.startsWith(a) || a.startsWith(b)) return true;
  // subtitle variants: "Spider-Man: No Way Home" vs "Spider-Man No Way Home"
  const aw = a.split(' ');
  const bw = b.split(' ');
  const overlap = aw.filter((w) => bw.includes(w)).length;
  return overlap >= Math.min(aw.length, bw.length) && overlap >= 2;
}

function cleanUrl(u: string): string {
  return u.split('?')[0];
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const kindIdx = args.indexOf('--kind');
  const kind = kindIdx >= 0 ? (args[kindIdx + 1] as Kind) : null;

  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let q = sb.from('prompts').select('id,kind,title,aliases,year,poster_url').order('popularity', { ascending: false });
  if (!force) q = q.is('poster_url', null);
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data as PromptRow[]).slice(0, limit);
  console.log(`${rows.length} prompts to process`);

  let found = 0;
  let missed = 0;
  const misses: string[] = [];
  for (const [i, p] of rows.entries()) {
    let poster: string | null = null;
    let matchedPage = '';
    for (const term of searchTerms(p)) {
      try {
        const page = await wikiLookup(term);
        if (page?.thumbnail?.source && titlesMatch(p.title, page.title, p.aliases ?? [])) {
          poster = cleanUrl(page.thumbnail.source);
          matchedPage = page.title;
          break;
        }
      } catch (e) {
        console.warn(`  ${p.title}: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    if (poster) {
      const { error: upErr } = await sb.from('prompts').update({ poster_url: poster }).eq('id', p.id);
      if (upErr) console.warn(`  update failed for ${p.title}: ${upErr.message}`);
      else found++;
    } else {
      missed++;
      misses.push(`${p.kind}: ${p.title}${p.year ? ` (${p.year})` : ''}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${rows.length} done (found ${found}, missed ${missed}) last: ${p.title} -> ${matchedPage || 'none'}`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`Done. posters found: ${found}, missed: ${missed}`);
  if (misses.length) console.log('Missed:\n  ' + misses.join('\n  '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
