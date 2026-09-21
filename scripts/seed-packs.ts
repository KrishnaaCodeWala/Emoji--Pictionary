// scripts/seed-packs.ts
// Run this with `npx tsx scripts/seed-packs.ts` to populate the DB with word packs.
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PACKS } from '../src/lib/constants'; // Note: Adjust import if running from different dir

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const admin = createClient(url, key);

async function main() {
  console.log('Seeding packs...');

  const packsDir = path.join(process.cwd(), 'data', 'packs');
  
  for (const pack of PACKS) {
    const packFile = path.join(packsDir, `${pack.id}.json`);
    if (!fs.existsSync(packFile)) {
      console.error(`Pack file not found: ${packFile}`);
      continue;
    }

    const words: string[] = JSON.parse(fs.readFileSync(packFile, 'utf-8'));
    console.log(`Processing pack '${pack.id}' (${words.length} words)...`);

    const batch = words.map(w => ({
      id: crypto.randomUUID(),
      kind: 'word',
      title: w,
      aliases: [],
      year: null,
      genres: [],
      poster_url: null,
      popularity: 1,
      pack: pack.id
    }));

    // Chunk the inserts
    const chunkSize = 50;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      const { error } = await admin.from('prompts').insert(chunk);
      if (error) {
        console.error(`Error inserting chunk for pack ${pack.id}:`, error.message);
      }
    }
    console.log(`Done pack '${pack.id}'.`);
  }

  console.log('Finished seeding packs.');
}

main().catch(console.error);
