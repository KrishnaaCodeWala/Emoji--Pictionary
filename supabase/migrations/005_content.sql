-- v5 Wave 2: Content (Word Packs & Difficulty). Run once in the Supabase SQL editor (after 004_party.sql).

-- ---- prompts: add pack support ----
alter table prompts add column if not exists pack text;
create index if not exists prompts_kind_pack_idx on prompts (kind, pack);

-- (Optional) If you want the old classic words to stay pure and not rely on DB,
-- they don't need to be in the `prompts` table since they're in src/lib/words.ts.
-- But if we seed packs, they'll have kind = 'word' and pack = 'something'.
