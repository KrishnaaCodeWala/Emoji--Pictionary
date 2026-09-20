-- Optional: delete rooms older than 24h (players/messages cascade).
-- Run once in the Supabase SQL editor. Requires the pg_cron extension
-- (Database -> Extensions -> enable pg_cron) on plans that support it.

create extension if not exists pg_cron;

select cron.schedule(
  'emoji-pictionary-cleanup',
  '0 * * * *',
  $$ delete from rooms where created_at < now() - interval '24 hours' $$
);

-- Without pg_cron you can run the delete manually:
-- delete from rooms where created_at < now() - interval '24 hours';
