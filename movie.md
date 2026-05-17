# Phase 6 — Movie Feature (Enhanced Watch Together)

## Vision

A universal, synced movie experience. Pick anything — a USB drive, a direct link, your Raspberry Pi media server — start a session, and watch in perfect sync with floating overlay chat and emoji reactions.

---

## Answers

| Question | Answer |
|----------|--------|
| Location | Both — same house sometimes, apart sometimes |
| Chat style | Overlay chat — appears over video, fades out |
| Media source | Raspberry Pi as personal media server |

---

## Architecture Overview

### Source Types (all supported)

| Type | How | Use case |
|------|-----|----------|
| **Upload** | Existing Supabase TUS upload | One-time upload for any file |
| **Direct URL / HLS** | Paste any `.mp4` or `.m3u8` URL | Raspberry Pi stream, file server, CDN link |
| **Local file / USB** | Browser File API — reads from disk without uploading | Same-room watching from a shared USB drive |

### Sync Engine
Supabase Realtime channel per session. Broadcasts:
- `state` — `playing` | `paused`
- `position` — float (seconds)
- `source_type` — `upload` | `url` | `local`
- `source_url` — for upload/url types
- `source_hint` — filename hint for local (so the guest knows which file to pick)

### Player Stack
- **HLS.js** — enables `.m3u8` HLS stream support in all browsers (required for Jellyfin/Pi)
- **Custom player** — themed to match Hiranda's jazz coffee shop aesthetic (no heavy library dependency)

### Overlay Chat
- Messages appear as subtle text at the bottom of the video
- Stack up, fade out after ~6 seconds
- Emoji reactions float up from the bottom and fade (like Twitch/YouTube reactions)
- Stored per session in `watch_messages` table, delivered via Supabase Realtime

---

## Raspberry Pi Setup Guide

### Install Jellyfin (recommended — fully free, no account)

```bash
# On your Pi (Raspberry Pi OS)
curl https://repo.jellyfin.org/install-jellyfin.sh | sudo bash
```

Jellyfin runs on port `8096`. Access at `http://[pi-local-ip]:8096`.

### Remote Access — Tailscale (free, no port forwarding)

Tailscale creates a private mesh network between your devices. Your Pi gets a stable private IP (e.g. `100.x.x.x`) that works anywhere in the world.

```bash
# On Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Install Tailscale on your phone/laptop too (tailscale.com/download)
```

Once connected, access Jellyfin from anywhere at `http://100.x.x.x:8096`.

### Getting a stream URL from Jellyfin

1. Open your Jellyfin library, pick a movie
2. Click the three dots → **Play** → right-click the video → **Copy video URL**
3. Or use the Jellyfin API: `http://[ip]:8096/Videos/[item-id]/stream.mp4?static=true&api_key=[key]`
4. Paste that URL into Hiranda's "Play from URL" field

For HLS streams (adaptive bitrate, better for slow connections):
`http://[ip]:8096/Videos/[item-id]/master.m3u8?api_key=[key]`

---

## Database Changes

### Extend `watch_sessions`
```sql
alter table watch_sessions
  add column source_type text check (source_type in ('upload', 'url', 'local')) default 'upload',
  add column source_url text,
  add column source_hint text;
```

### New `watch_messages`
```sql
create table watch_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references watch_sessions on delete cascade not null,
  user_id uuid references auth.users not null,
  body text,
  emote text,
  video_position_seconds float,
  created_at timestamptz default now()
);

alter table watch_messages enable row level security;

create policy "Authenticated users can read watch messages"
  on watch_messages for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert watch messages"
  on watch_messages for insert with check (auth.role() = 'authenticated');
```

---

## SQL to Run in Supabase

```sql
-- Extend watch_sessions
alter table watch_sessions
  add column if not exists source_type text check (source_type in ('upload', 'url', 'local')) default 'upload',
  add column if not exists source_url text,
  add column if not exists source_hint text;

-- Watch messages
create table if not exists watch_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references watch_sessions on delete cascade not null,
  user_id uuid references auth.users not null,
  body text,
  emote text,
  video_position_seconds float,
  created_at timestamptz default now()
);

alter table watch_messages enable row level security;

create policy "Authenticated users can read watch messages"
  on watch_messages for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert watch messages"
  on watch_messages for insert with check (auth.role() = 'authenticated');
```

---

## Build Plan

### 1. Session creation (`/watch/page.tsx`)
- Source picker: Upload / Play from URL / Local file
- For URL: paste field (accepts `.mp4`, `.m3u8`, or any direct video link)
- For local: file picker (reads from disk/USB, no upload)
- For upload: existing TUS flow

### 2. Player (`/watch/[id]/watch-player.tsx`)
- Install `hls.js` — auto-detect HLS URLs, fall back to native for MP4
- Custom styled player controls (themed to Hiranda)
- Sync engine extended to handle all source types
- For local files: guest sees "Select your copy of [filename]" prompt

### 3. Overlay chat
- Supabase Realtime subscription on `watch_messages` channel
- Messages appear at bottom of video, stack up, fade out after 6s
- Input bar below the player (or a small pop-up input)
- Timestamp shows video position when message was sent

### 4. Emoji reactions
- Fixed set of 6–8 emotes (🍿 ❤️ 😂 😱 👏 💀 🔥 😭)
- Click → floats up from bottom of video, fades out in ~3s
- Stored as `emote` in `watch_messages` (same table, no `body`)
- Other person sees the float animation in real time

### 5. Caching
- HLS.js handles segment caching internally for URL sources
- Browser caches video responses naturally for same URLs
- No extra work needed for the common case

---

## What This Enables

- **Home together**: plug in a USB drive, both open the file locally, sync just the position — zero upload
- **Apart**: paste the Jellyfin URL from your Pi (via Tailscale), both stream from the same server
- **Fallback**: upload a file to Supabase if the Pi isn't available
- **Always**: overlay chat + reactions while the movie plays

---

*Last updated: 2026-05-17*
