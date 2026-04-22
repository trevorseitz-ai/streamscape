# 🏛️ Streamscape Headquarters — Lobby

> **Central directory.** Open a **department office** below for focused work, or use shared references. This file stays lightweight; deep context lives in `docs/depts/` and `docs/`.

---

## 📍 Current Phase

| Area | Status |
| :--- | :--- |
| **Android TV UI** | Refining Discover/Home layouts; follow `docs/tv_layout_rules.md`. |
| **Backend** | Supabase auth, profiles, watchlists; schema in `docs/database_schema.md`. |
| **Cross-platform** | Expo (TV + Web); platform guards and focus rules per `.cursorrules`. |

_Update this table when priorities shift._

---

## 🚧 Active Work-in-Progress

- **Completed:** Validated TV/Web architecture and automated the Waitlist-to-Auth migration pipeline.
- **Current Focus:** Ensuring D-pad navigation "Focus Bridge" works across all Home screen rows.
- **Next Step:** Deciding between refining the TV UI components or implementing "Provider Filtering" logic.

---

## 🗺️ Platform Map (ReelDive ecosystem)

Three product surfaces; each can ship on its own URL or store listing.

| Branch | What it is |
| :--- | :--- |
| **Waitlist Portal** | **https://getreeldive.com** — signup, positioning, and handoff to the app. Independent of the main Expo app origin (see Verified Ecosystem Map below). |
| **ReelDive Web** | Browser-based **management** experience: account, libraries, discovery, and admin-style workflows on desktop/tablet. |
| **ReelDive TV** | **Android TV** lean-back client — Expo/React Native, D-pad focus, sidebar navigation, `docs/tv_layout_rules.md`. |

_Add concrete URLs and repos here when they are finalized._

---

## Verified Ecosystem Map

Authoritative notes on how the pieces connect in this repo and in production.

- **Waitlist (frontend):** External portal at [getreeldive.com](https://getreeldive.com). No direct database write access to the waitlist from the main app; the app links out to that site.
- **ReelDive App (shared core):** Single **Expo Router** project: **Web** and **TV** are served from one `app/` directory (shared routes and components; platform guards where needed).
- **Authentication:** Centralized on **Supabase**. **Web** persists the session with **localStorage**; **TV / native** use **AsyncStorage** (via `lib/supabase.ts`).

---

## 🏢 Department Offices

Work in **one office at a time** so context stays clean. In Cursor, `@` the office file you’re in.

| Office | File | Focus |
| :--- | :--- | :--- |
| **Marketing & Brand** | [docs/depts/marketing.md](docs/depts/marketing.md) | Copy, positioning, acquisition, store listings, email. |
| **Product & Features** | [docs/depts/product.md](docs/depts/product.md) | Roadmap, specs, UX flows, prioritization. |
| **3D Design & Creative** | [docs/depts/creative.md](docs/depts/creative.md) | Blender, STL, visual/3D asset pipeline. |
| **Web App** | [docs/depts/web.md](docs/depts/web.md) | ReelDive Web: React/Expo web, responsive UI, browser UX. |

---

## 🗄️ Data & Schema

- **Live database layout (auto-generated):** [docs/database_schema.md](docs/database_schema.md)  
  _Regenerate with `node scripts/sync-schema.js` when the RPC is set up._

---

## 📐 Shared engineering docs

- **TV layout rules:** [docs/tv_layout_rules.md](docs/tv_layout_rules.md)
- **User / waitlist migration:** [docs/user_migration.md](docs/user_migration.md)

---

## 🔗 Command center (external)

_(Replace placeholders with real URLs.)_

- **Supabase:** [Dashboard]
- **Deploy (Vercel / Expo):** [Hosting]
- **Design assets:** [Figma / Drive]
