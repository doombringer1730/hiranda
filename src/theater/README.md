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
- **Database**: `watch_sessions` / `watch_messages` and their policies, and
  the realtime config sync uses, belong to the Theater. Change them only on
  purpose, in a Theater-focused change.
