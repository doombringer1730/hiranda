# Hiranda Phase 7 — Multi-Couple Platform

## Decisions

- **Userbase:** Just us + 1–2 more couples we know personally (small, controlled rollout)
- **Access control:** Invite link only — existing system stays as-is, no approval queue needed
- **Profile pages:** Private — requires login to view (`/profile/[username]`)
- **Profile fields:** display name, avatar, username slug, together since date — no bio
- **Thumbnails:** TMDB auto-fill only when picking from Real-Debrid / TorBox search — not Jellyfin
- **Session edit/delete:** Yes — edit title + thumbnail URL; delete requires typing the title to confirm
- **Username:** Set once, cannot be changed — warn the user clearly before they submit
- **Themes:** Per-couple theme stored on the `couple` table; applied server-side to avoid flash

---

## Build Order

| # | Feature | Why first |
|---|---------|-----------|
| 1 | RLS fix + cascade deletes | Broken right now — sync is dead and accounts can't be deleted |
| 2 | Themes | Stored on couple table, easy to add schema alongside step 1 |
| 3 | Profiles schema (username, avatar) + settings UI | Foundation for everything below |
| 4 | TMDB thumbnails on session create | Makes the watch history visual |
| 5 | Private profile pages `/profile/[username]` | Needs avatar + username to exist first |
| 6 | Session edit + delete UI | Polish — lowest risk |

---

## 1. RLS Fix + Cascade Deletes

**Problem A — sync is broken:**
The Phase 7 RLS migration was applied (couple-membership subqueries on all tables), but the `couple` table has no SELECT policy. So the `exists (select 1 from couple ...)` subquery always returns empty — nobody can see their partner's data.

**Problem B — can't delete accounts:**
The `couple` table's `user1_id` / `user2_id` foreign keys have no `ON DELETE` action, so deleting an auth user fails if they're still referenced in the couple row. (`profiles` already has cascade delete from the original schema — no change needed there.)

**SQL to run in Supabase:**

```sql
-- Fix A: let users read their own couple row (unblocks all the subqueries)
create policy "Users can read their own couple"
  on couple for select
  using (user1_id = auth.uid() or user2_id = auth.uid());

-- Fix A: tighten profiles to couple-scoped reads (replaces the open "using (true)" policy)
drop policy if exists "Users can view all profiles" on profiles;
create policy "Users in the same couple can read profiles"
  on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from couple
      where (user1_id = auth.uid() or user2_id = auth.uid())
        and (user1_id = profiles.id or user2_id = profiles.id)
    )
  );

-- Fix B: set null on couple FKs so deleting an auth user doesn't block
-- (if constraint names differ in your DB, check with \d couple in psql)
alter table couple
  drop constraint if exists couple_user1_id_fkey,
  add constraint couple_user1_id_fkey
    foreign key (user1_id) references auth.users(id) on delete set null;

alter table couple
  drop constraint if exists couple_user2_id_fkey,
  add constraint couple_user2_id_fkey
    foreign key (user2_id) references auth.users(id) on delete set null;
```

---

## 2. Themes

**Per-couple** — both people share the same theme, stored on the `couple` row.

**Available themes:**

| Key | Name | Vibe |
|-----|------|------|
| `coffee` | Jazz Coffee Shop | Current default — warm amber on dark roast |
| `midnight` | Midnight | Near-black with cool blue-grey accents |
| `rose` | Rose Garden | Warm rose/blush on soft dark |
| `forest` | Forest | Deep green on dark earth |
| `ocean` | Ocean | Cool teal/slate on deep navy |

**Schema:**
```sql
alter table couple add column if not exists theme text default 'coffee' not null;
```

**How it works in the app:**
- App layout reads `couple.theme` server-side
- Sets `data-theme="[key]"` on `<html>`
- `globals.css` defines CSS variable overrides per theme
- No flash because it's applied in the server component before the page renders

**Settings:** Theme picker in settings — visual swatches, updates the couple row immediately.

---

## 3. Profiles Schema + Settings UI

**Schema:**
```sql
alter table profiles add column if not exists username text unique;
alter table profiles add column if not exists avatar_url text;
```

**Storage:** New Supabase Storage bucket `avatars` (public).

**Settings additions:**
- Username field — one-time set, warn "This can't be changed" before submit, disable field after saved
- Avatar upload — store at `avatars/[user_id].jpg`

**Username can be set from the Supabase Table Editor** for existing accounts without going through the app UI.

---

## 4. Watch Session Thumbnails

**Schema:**
```sql
alter table watch_sessions add column if not exists thumbnail_url text;
```

**Auto-fill on create:**
- Real-Debrid / TorBox search → save TMDB poster URL (`https://image.tmdb.org/t/p/w500{poster_path}`) when the user picks a title
- All other session types (upload, URL, local, Jellyfin) → no auto-fill; user can add one manually via the edit sheet

**Session card UI:** Show thumbnail as a poster on the left side of each card when available.

---

## 5. Private Profile Pages

**Route:** `/profile/[username]` — redirects to `/login` if not authenticated.

**Page shows:**
- Avatar + display name
- Together since date
- Partner's avatar + display name (linked to their profile)

---

## 6. Session Edit + Delete

**Edit flow:**
- `•••` menu on each session card opens an edit sheet
- Editable fields: title, thumbnail URL (paste a poster link)
- Save button patches the `watch_sessions` row

**Delete flow:**
- Delete button inside the edit sheet, styled in muted red
- Tap Delete → confirmation modal:
  - "This permanently deletes **[title]** and cannot be undone."
  - Text input: type the session title to confirm (case-sensitive)
  - Delete button disabled until input matches exactly
- On confirm → delete row, redirect to `/watch`
