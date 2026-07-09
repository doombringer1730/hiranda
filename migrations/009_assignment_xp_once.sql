-- 009: award assignment XP only once (repeat turn-ins were re-awarding XP).
alter table assignments add column if not exists xp_awarded boolean not null default false;
-- backfill: any already-turned-in assignment counts as already awarded.
update assignments set xp_awarded = true where turned_in = true;
