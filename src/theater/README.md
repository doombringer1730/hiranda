# The Theater sandbox

Watch-together sync (the player, parties, the browser extension's time
endpoint) is delicate, so it is fenced off from the rest of Hiranda.

- **Routes** live in `src/app/(theater)/` — `/watch`, `/watch/[id]`,
  `/party/[id]`, `/api/time`. The `(theater)` group has its own layout, so the
  app's nav, hub switcher and page transitions never render here.
- **Code** lives in `src/theater/`: private Supabase clients (`supabase/`),
  the streaming catalog (`catalog/`) and Theater-only UI (`ui/`). It is open
  to every couple; there is no passcode any more.
- **The fence** (eslint.config.mjs, enforced in CI):
  - Theater code may not import `@/lib/*`, `@/components/*` or `@/app/*`.
    Need something? Copy it in here.
  - App code may import only `@/theater/public` (nothing lives there
    today). Links to `/watch` are plain URLs.
- **Database**: `watch_sessions` / `watch_messages` / `watch_queue` and their
  policies, and the realtime config sync uses, belong to the Theater. Change
  them only on purpose, in a Theater-focused change.
- **YouTube** (`catalog/youtube.ts`): trending rows, category chips and
  search, from the YouTube Data API. Needs `YOUTUBE_API_KEY` (server-only);
  without it the YouTube section simply doesn't show. Free quota is 10,000
  units a day: a list costs 1, a search 100, so lists are cached 30 minutes
  and searches a day.
- **Up next** (`watch/[id]/up-next.tsx`, `queue-actions.ts`, migration 043):
  a shared queue in YouTube sessions. Sync payloads carry the current video
  and when it was picked, so a newer pick always wins.
- **"Ask … to join"** calls `/api/watch-ping`, an app-side route (it needs the
  push code, which the Theater can't import). A URL, not an import, so the
  fence holds.
