-- 007: Coins (spendable currency) + per-user XP goal.
--
-- XP stays a pure, only-grows score (drives leagues). Coins are earned
-- alongside XP and spent in the shop (later). Health is computed from the
-- day's attempts, so it needs no table.

alter table study_attempts add column if not exists coins integer not null default 0;
alter table profiles add column if not exists xp_goal integer;
