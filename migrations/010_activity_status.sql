-- 010: transient activity status (e.g. "quizzing") shown on presence cards.
alter table profiles add column if not exists activity text;
alter table profiles add column if not exists activity_at timestamptz;
