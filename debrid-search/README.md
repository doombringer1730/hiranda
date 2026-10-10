# Private debrid search

The Real-Debrid / TorBox search that used to live in Hiranda's Theater, as a
separate, password-protected site. Search TMDB for a movie or show, pick an
episode, and get the streams already cached on your debrid account through
Torrentio. Each one can be watched together (synced, with chat), played in
the page, copied (for VLC or Infuse), or opened in a new tab.

It is a standalone Next.js app and shares nothing with Hiranda. Keep it that
way: **don't link to it from Hiranda**. The iPhone app loads the Hiranda site,
so nothing debrid can appear there (see `../APPSTORE.md`).

## Deploy (Vercel)

1. Vercel → **Add New → Project** → import this repo again as a *new* project.
2. Set **Root Directory** to `debrid-search`. The framework is detected as
   Next.js.
3. Add the environment variables below, then deploy.
4. Optional: in the project's **Settings → Deployment Protection**, turn on
   Vercel Authentication as a second lock.

| Variable | Required | What it is |
| --- | --- | --- |
| `SITE_PASSWORD` | yes | The password for the login page. Without it the site answers 503. Changing it signs everyone out. |
| `TMDB_API_KEY` | yes | TMDB v3 API key (the same one Hiranda uses works). |
| `REALDEBRID_API_KEY` | one of these | From https://real-debrid.com/apitoken |
| `TORBOX_API_KEY` | one of these | From your TorBox settings. With both set, results are merged. |
| `SUPABASE_URL` | for watch together | A Supabase project URL, used only for Realtime. |
| `SUPABASE_ANON_KEY` | for watch together | That project's anon (publishable) key. |
| `TORRENTIO_URL` | no | A different Torrentio instance. Defaults to `https://torrentio.strem.fun`. |

## Watch together

**Watch together** on a stream opens a room (`/watch/<id>?…`) and **Invite**
copies its link. Whoever opens it signs in with the site password (the
link survives the login), picks a name, and lands in sync. Play, pause and
seek follow whoever did them, and there's a live viewer list, chat and emotes.
The room's link carries the stream plus up to five backups. If a link dies,
everyone moves on to the next one together.

The sync is Hiranda's Theater algorithm (`app/watch/[room]/room.tsx`):
heartbeats every 4s plus instant play/pause/seek actions, a rolling-median
clock offset against `/api/time` so a playing position is projected forward
by its travel time, and corrections when drift passes 1.5s (0.8s for
actions). A newcomer stays quiet until it has heard from the room, so it
never drags everyone back to 0:00.

It runs on Supabase Realtime **broadcast and presence only**: no tables, no
auth, nothing stored. Chat disappears on reload. Use a new free Supabase
project for it, not Hiranda's, so the two stay unconnected. Realtime's
default "allow public access" setting must stay on. The keys reach the
browser only on the signed-in room page, never in the public JS.

## How it works

- `proxy.ts` sends anyone without a valid session cookie to `/login`. The
  cookie is an HMAC of `SITE_PASSWORD`, httpOnly, and lasts 30 days.
- `app/actions.ts` (server) does the TMDB lookups, so the TMDB key never reaches
  the browser. Every action checks the session again.
- Torrentio's Cloudflare blocks many server IPs, so the **browser** fetches the
  streams (`lib/torrentio.ts`), as the old Hiranda search did. The server
  gives a signed-in browser the Torrentio URLs. Those URLs, like the stream links
  Torrentio returns, contain your debrid key, so only share the password with
  people you'd give the key to.
- "Browser-safe only" hides MKV files and AC3/DTS/TrueHD/Atmos audio, which
  browsers can't play. Turn it off to see everything, then use Copy link with
  an external player.
- Every page sends `noindex` and `robots.txt` disallows everything.

## Local

```bash
cd debrid-search
npm install
SITE_PASSWORD=… TMDB_API_KEY=… REALDEBRID_API_KEY=… npm run dev
```
