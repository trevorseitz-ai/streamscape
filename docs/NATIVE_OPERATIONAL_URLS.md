# Native & web operational URLs — ReelDive

Companion to **`docs/IOS_NATIVE_DEVELOPER_ONBOARDING.md`** (same directory as this file). This file is the **canonical reference** for which **origins** and **path prefixes** the app and tooling expect in each environment.

---

## 1. Three different “hosts” in your head

| Layer | What it is | Typical origin |
|-------|------------|----------------|
| **A. Metro / dev client** | JavaScript bundle + HMR | `http://<your-lan-ip>:8081` (or USB tunnel) — **not** where production `/api/*` lives |
| **B. Production web app (Vercel)** | Static **Expo web export** + **serverless** routes | Your deployed site, e.g. **`https://<project>.vercel.app`** or custom domain — see **`vercel.json`** |
| **C. Third-party APIs** | Supabase, TMDB, RapidAPI, Stream Finder | Full HTTPS URLs driven by **`EXPO_PUBLIC_*`** or server env — **[`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md)** |

Native **iOS/Android** binaries do **not** embed “the Vercel site” unless you configure a **`EXPO_PUBLIC_*`** base URL somewhere in code for that purpose. Many features call third parties **directly** (Supabase, TMDB keys in the client bundle). **`/api/*`** routes are primarily the **hosted web** deployment’s responsibility.

---

## 2. First-party routes: `app/api/*+api.ts` (same-origin on web only)

Implementations live under **`app/api/`** (`*+api.ts` pattern).

| Relative path | Role (summary) |
|---------------|----------------|
| **`/api/movie`** | Movie hydrate / TMDB enrichment (server-side TMDB key) |
| **`/api/search`** | Admin-style ingest |
| **`/api/discover`** | Discover pipeline / sync |
| **`/api/providers`** | TMDB US provider metadata JSON |
| **`/api/watchlist-reorder`** | Watchlist order RPC |

On **web production**, these are served at **`https://<your-vercel-host>/api/...`** because **`vercel.json`** exempts **`/api/*`** from the SPA rewrite.

On **native dev**, if any code calls **`/api/...` as a relative URL**, that resolves to **Metro** (wrong). Native code that needs these handlers must use an **absolute base URL** you obtain from the team (your **operational web origin**), e.g. **`https://<vercel-host>/api/movie?...`**.

---

## 3. Vercel serverless: `api/streaming.ts` (not under `app/api/`)

**[`api/streaming.ts`](../api/streaming.ts)** is a **Vercel function** (RapidAPI Streaming Availability proxy). Its public path on the deployed site is **`/api/streaming`** (per **[`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md)**). Native usually calls RapidAPI **directly** via **`lib/streaming-rapid.ts`** instead; web may use the proxy to keep **`RAPIDAPI_KEY`** server-side.

---

## 4. Supabase (always a full URL)

**`EXPO_PUBLIC_SUPABASE_URL`** must be the project **`https://<ref>.supabase.co`** URL. **Physical devices** cannot use **`http://localhost`** for Supabase if your stack lives only on your laptop.

---

## 5. Stream Finder (sync scripts & audits)

Default catalog host is documented in **[`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md)**; override with **`STREAM_FINDER_MOVIES_URL`**. **`STREAM_FINDER_KEY`** is **server-only** and required for **`npm run sync:stream-finder`**, **`npm run inspect:stream-finder-payload`**, **`npm run audit:stream-finder-providers`**.

---

## 6. What to ask Product / infra for (“operational URLs” checklist)

Fill these in internally; they are **not** secrets per se but are **required context** for iOS/Android/Web parity:

| Question | Why it matters |
|----------|----------------|
| What is **production web origin**? (Vercel default + any custom domains) | Any native caller of **`https://…/api/*`** |
| Is there **staging** with a separate origin + Supabase project? | Avoid polluting prod data during TestFlight |
| Where is **privacy policy / support** URL for App Store submission? | Marketing / legal checklist |

---

*When this file conflicts with **`docs/API-ENDPOINTS.md`**, prefer **API-ENDPOINTS** for exact path names and env names, and update this narrative to match.*
