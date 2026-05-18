# Hiranda + Real-Debrid (Stremio-style streaming)

## What This Adds

A new "Search" tab on the Watch page. Type a movie title, pick a quality, start a synced session. No URLs to copy, no files to manage — content streams directly from Real-Debrid's CDN at gigabit speed.

Cost: ~$4/month for Real-Debrid. Only the host needs an account.

---

## How It Works (the stack)

```
User types title
    → TMDB API (free) — title → IMDB ID + poster
    → Torrentio API (free, configured with RD key) — IMDB ID → stream list
    → User picks quality (1080p, 4K, etc.)
    → Direct HTTP URL from Real-Debrid CDN
    → Hiranda watch session created → both users stream
```

**Torrentio** is a Stremio addon that indexes torrent sources and integrates with debrid services. When you pass it a Real-Debrid API key, it returns direct playable HTTP URLs instead of magnet links — no torrenting on your end, just fast CDN streams.

**No separate RD unrestrict call needed** — Torrentio handles it. The configured URL embeds the API key and returns ready-to-play links.

---

## What Needs to Be Built

### 1. Database — `couple` table
Add one column:
```sql
alter table couple
  add column if not exists real_debrid_api_key text;
```

### 2. Settings Page (`/settings`)
Add a new section below Jellyfin:

```
Real-Debrid
Connect your Real-Debrid account to search and stream movies directly.
[ API key field ] [ Save ]
```

- Save to `couple.real_debrid_api_key` via new `saveRealDebridSettings()` server action in `settings/actions.ts`
- Follow identical pattern to the existing Jellyfin settings section

### 3. New Component — `real-debrid-browser.tsx`
Mirror of `jellyfin-browser.tsx`. Lives at `src/app/(app)/watch/real-debrid-browser.tsx`.

**UI flow:**
1. Search input → user types movie title
2. Hit enter → TMDB search → show poster grid of results
3. User clicks a result → Torrentio fetches streams for that IMDB ID
4. Stream picker appears — list of qualities (4K, 1080p, 720p, etc.) with file size
5. User picks one → `createWatchSessionFromUrl()` → redirect to session

**API calls:**
```
TMDB search:
GET https://api.themoviedb.org/3/search/movie?query={title}&api_key={TMDB_KEY}
→ returns IMDB ID, poster path, title, year

Torrentio (with RD):
GET https://torrentio.strem.fun/realdebrid={RD_KEY}/stream/movie/{imdbId}.json
→ returns array of streams, each with a direct .url and .title (quality info)

For TV series:
GET https://torrentio.strem.fun/realdebrid={RD_KEY}/stream/series/{imdbId}:{season}:{episode}.json
```

**Stream title parsing** — Torrentio titles look like:
`[YTS] Movie.Name.2023.2160p.BluRay... 👤 150`
Parse for: resolution (4K/2160p/1080p/720p), source (BluRay/WEB), size.

### 4. Watch Page (`/watch/page.tsx`)
- Add `'stream'` to the `Tab` type
- Load `real_debrid_api_key` from couple table alongside jellyfin keys (already in the `useEffect`)
- Add new tab button: `{ id: 'stream', label: 'Search', icon: <Search size={14} /> }`
- Render `<RealDebridBrowser>` or `<RealDebridNotConfigured>` when tab === 'stream'

---

## File Changes Summary

| File | Change |
|------|--------|
| Supabase | Add `real_debrid_api_key` column to `couple` |
| `settings/actions.ts` | Add `saveRealDebridSettings()` action (fix duplicate `saveJellyfinSettings` while here) |
| `settings/page.tsx` | Add Real-Debrid section |
| `settings/settings-client.tsx` | Add `type="realdebrid"` case |
| `watch/real-debrid-browser.tsx` | New component (main work) |
| `watch/page.tsx` | Add 'stream' tab, load RD key, render browser |

---

## API Keys Needed

| Service | Cost | Where to get |
|---------|------|-------------|
| Real-Debrid | ~$4/mo | real-debrid.com → My Account → API token |
| TMDB | Free | themoviedb.org → Settings → API |

TMDB key: store as `NEXT_PUBLIC_TMDB_API_KEY` in `.env.local` and Vercel env vars.
RD key: stored per-couple in Supabase (same as Jellyfin key pattern).

---

## Existing Code to Reuse

- `createWatchSessionFromUrl()` — already exists in `watch/actions.ts`, handles URL sessions
- `saveJellyfinSettings()` pattern — copy for RD settings action
- `JellyfinNotConfigured` component pattern — copy for RD not-configured state
- `Tab` type and tab rendering — extend, don't replace
- Watch player handles any direct HTTP URL already — no player changes needed

---

## TV Show Support (Phase 2)

Movies work cleanly (one IMDB ID → one stream). TV needs season/episode selection — a separate picker step. Save this for after movies are working.

---

## Known Constraints

- **RD key is embedded in the Torrentio URL** — this is client-side visible. Acceptable for a private 2-person app; not suitable for multi-tenant. Noted.
- **Torrentio availability** — public instance, occasionally slow. Can self-host if needed.
- **CORS** — Torrentio and TMDB both allow browser-side fetch. No server proxy needed.
- **Content availability** — RD caches the most popular stuff. Obscure titles may return no streams.

---

## Build Order

1. Supabase column + settings action
2. Settings UI section
3. `real-debrid-browser.tsx` — TMDB search first, then stream picker
4. Wire into Watch page as new tab
5. Test: search → pick quality → session starts → both users stream in sync

---

*Created: 2026-05-18*
