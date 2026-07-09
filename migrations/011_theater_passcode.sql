-- 011: passcode-gated "Theater" (the watch/sync + streaming-source features).
-- Stores a hash of the couple's shared passcode; unlock is a session cookie.
alter table couple add column if not exists theater_passcode_hash text;
