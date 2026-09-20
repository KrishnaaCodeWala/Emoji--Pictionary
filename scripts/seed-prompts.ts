// Upsert data/catalog.seed.json into the prompts table using the service role.
// Run: npm run seed:prompts   (or npx tsx scripts/seed-prompts.ts)
// Reads .env.local manually (no dotenv dependency) so this stays a zero-dep script.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

interface SeedEntry {
  kind: 'movie' | 'series' | 'game';
  title: string;
  aliases: string[];
  year: number | null;
  genres: string[];
  poster_url: string | null;
  popularity: number;
  source_id: string;
}

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    console.warn('.env.local not found at', envPath);
    return;
  }
  const contents = readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seedPath = resolve(process.cwd(), 'data/catalog.seed.json');
  const raw = readFileSync(seedPath, 'utf8');
  const entries = JSON.parse(raw) as SeedEntry[];

  console.log(`Loaded ${entries.length} entries from data/catalog.seed.json`);

  const counts: Record<string, number> = { movie: 0, series: 0, game: 0 };
  for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  console.log('By kind:', counts);

  const rows = entries.map((e) => ({
    kind: e.kind,
    title: e.title,
    aliases: e.aliases ?? [],
    year: e.year ?? null,
    genres: e.genres ?? [],
    poster_url: e.poster_url ?? null,
    popularity: e.popularity ?? 0,
    source: 'seed',
    source_id: e.source_id,
  }));

  const BATCH_SIZE = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await admin
      .from('prompts')
      .upsert(batch, { onConflict: 'source,source_id', count: 'exact' });
    if (error) {
      console.error('Upsert error at batch starting index', i, error.message);
      process.exit(1);
    }
    upserted += count ?? batch.length;
    console.log(`Upserted batch ${i / BATCH_SIZE + 1}: ${batch.length} rows`);
  }

  console.log(`Done. Upserted ${upserted} rows total (${entries.length} entries in seed file).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
