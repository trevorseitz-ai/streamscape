# README_DEV — Developer flight manual

Quick orientation for engineers joining **StreamScape / ReelDive**: one codebase, multiple surfaces, TV-specific focus rules, and Supabase behind the scenes.

---

## Project vision

**ReelDive** is a subscription-aware discovery and watchlist experience: search and browse film and TV with filters that respect what you actually pay for, then curate what to watch next. The product ships as a **single universal Expo app** — same router and shared screens for **Web** and **Android TV**, with platform-specific UI and input paths where lean-back usage demands it.

---

## The hybrid architecture

All product routes live under the shared **`app/`** tree (Expo Router). Components and screens branch on **`isTvTarget()`** from [`lib/isTv.ts`](lib/isTv.ts) (`Platform.isTV` and `expo.extra.isTV`) so TV builds get sidebar layouts, D-pad–friendly controls, and spacing tuned for ten-foot UI, while Web stays pointer- and keyboard-oriented. Phone and tablet behavior reuse the same files with guards rather than a forked repo.

---

## The “special sauce” (TV navigation)

TV is not “mobile with a bigger screen.” Focus is **explicit**, not left to default React Native auto-focus alone.

- **Focus bridge:** [`lib/tv-search-focus-context.tsx`](lib/tv-search-focus-context.tsx) coordinates cross-region focus (e.g. search vs. rows) so the remote has predictable entry and exit points.
- **Spatial hints:** Focusable views use **`nextFocus*` props** (and related TV focus APIs) so the D-pad moves between the left rail, horizontal rows, and detail targets in a defined order — see also [`hooks/useTvNativeTag.ts`](hooks/useTvNativeTag.ts) and [`components/TvSidebarTabBar.tsx`](components/TvSidebarTabBar.tsx).

Layout and row math for TV home rows are documented in [`docs/tv_layout_rules.md`](docs/tv_layout_rules.md); horizontal rows on Home use [`components/HomeTvMovieRow.tsx`](components/HomeTvMovieRow.tsx).

---

## Infrastructure and backend

- **Database:** **Supabase** (managed **PostgreSQL**), with Row Level Security for user-scoped data. App code talks to Supabase through the JS client; schema reference: [`docs/database_schema.md`](docs/database_schema.md) (regenerated via tooling below).
- **Auth:** **Shared** Supabase Auth across Web and native. The app client is [`lib/supabase.ts`](lib/supabase.ts): **Web** persists sessions in **localStorage**; **TV / native** use **AsyncStorage** so tokens survive app restarts on device.
- **Waitlist:** Signup and marketing funnel live **outside** this app at **[getreeldive.com](https://getreeldive.com)**. The main app **does not** insert into the `waitlist` table; it links out. Moving waitlisted users into Auth uses the service-role script (see below and [`docs/user_migration.md`](docs/user_migration.md)).

---

## Tooling and automation

- **[`scripts/sync-schema.js`](scripts/sync-schema.js)** — Calls the Supabase RPC **`get_schema_details`** (service role in `.env`) and refreshes **`docs/database_schema.md`** so the doc matches the live public schema.
- **[`scripts/migrate-waitlist.js`](scripts/migrate-waitlist.js)** — Uses **`SUPABASE_SERVICE_ROLE_KEY`** to read pending **`waitlist`** rows, **`inviteUserByEmail`**, and update status. Operational steps: [`docs/user_migration.md`](docs/user_migration.md).

---

## The AI-collaboration system

Cursor and other AI assistants are steered by **human-maintained context** in-repo:

- **[`HQ.md`](HQ.md)** — Lobby: current phase, ecosystem map, verified architecture notes, active WIP, and links into deeper docs.
- **[`docs/depts/`](docs/depts/)** — Department “offices” (product, web, marketing, creative) with focused briefs so prompts stay scoped.

When you change architecture or process, update **HQ** and the relevant **dept** file so the next session (human or AI) starts from the same source of truth.

---

## See also

- TV layout rules: [`docs/tv_layout_rules.md`](docs/tv_layout_rules.md)
- Cursor / team conventions: [`.cursorrules`](.cursorrules)
