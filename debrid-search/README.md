# Private debrid search

The Real-Debrid / TorBox search that used to live in Hiranda's Theater, as a
separate, password-protected site. Search TMDB for a movie or show, pick an
episode, and get the streams already cached on your debrid account through
Torrentio. Each one can be played in the page, copied (to paste into VLC,
Infuse, or a Hiranda "link" watch session), or opened in a new tab.

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
| `TORRENTIO_URL` | no | A different Torrentio instance. Defaults to `https://torrentio.strem.fun`. |

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
