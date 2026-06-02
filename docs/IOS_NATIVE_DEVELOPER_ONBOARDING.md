# Native iOS & handset developer onboarding — ReelDive

**Audience:** Consultants or engineers opening the repo cold who need **where things live**, **which rules apply**, **what to request**, and **how URLs and env differ from typical Expo tutorials**.

Primary product context stays in **[`HQ.md`](../HQ.md)** and **[`docs/depts/product.md`](depts/product.md)**. TV-only layout law is **`docs/depts/tv.md`** (Android TV ten-foot UI). Handset-focused guardrails live in **`docs/depts/ios-rules.md`**.

---

## 1. What you are cloning

| Item | Detail |
|------|--------|
| **Product name** | **ReelDive** |
| **Local folder name** | May still appear as **StreamScape** — see **`HQ/streamscape-remnants-map.md`** |
| **Stack** | **Expo** (workflow + config plugins), **Expo Router** (`app/`), **React Native**, **TypeScript**, **Supabase**, hybrid **Stream Finder + TMDB** data |
| **Surfaces from one repo** | **Web**, **iOS/Android handsets**, **Android TV** — shared routes; branching via **`Platform`**, **`lib/isTv.ts`**, and config |

**Toolchain alignment:** **`package.json`** does not define **`engines`**. Anchor to **`dependencies.expo`** (currently **~55.x**) / **`react-native`** (**0.83.x**) and match the Node version Expo SDK 55 documents for development, unless the team publishes a tighter policy elsewhere.

---

## 2. GitHub repos and URLs

| Role | Location |
|------|----------|
| **Primary app** | This repo (your git remote is authoritative for the team) |
| **Waitlist / marketing site** | **https://github.com/trevorseitz-ai/v0-reel-dive-landing-page** — live **https://getreeldive.com** (not bundled inside the Expo project) |

Handset App Store repo is **not** separate; native shell comes from **`expo prebuild`** / **EAS** when you integrate with Xcode.

---

## 3. Local setup

1. **Install deps:** **`npm install`** (runs **`patch-package`** on **`postinstall`**).
2. **Environment:** Copy **`.env.example`** → **`.env`**. The example file is authoritative for **names**; **[`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md)** (**Quick env checklist**) and **[§ 4](#4-secrets-environment-variables-and-non-public-information-to-request)** below explain **roles** and **who may share values**.
3. **Run:** **`npx expo start`** → press **`i`** for iOS Simulator, or **`npm run ios`** when you use a dev client / native rebuild workflow you own.

Detailed **URLs** live in **[§ 5](#5-operational-urls-web-native-serverless)** and the companion **[`docs/NATIVE_OPERATIONAL_URLS.md`](NATIVE_OPERATIONAL_URLS.md)**.

---

## 4. Secrets, environment variables, and non-public information to request

Assume **everything below is gated** unless your engagement letter grants access—request explicitly from Engineering / Ops / Security.

### 4.1 Shipped in client bundles (**`EXPO_PUBLIC_*`**)

These are embedded in released **iOS/Android/Web** binaries. Treat **values** like **semi-public**: anyone can extract them from IPA/APK bundles. Prefer **narrow-scoped keys** where the provider supports it (**TMDB**, **RapidAPI** apps, Supabase **anon** only).

| Variable | Request from / notes |
|----------|---------------------|
| **`EXPO_PUBLIC_SUPABASE_URL`** | Supabase project URL (**https**, not localhost for device QA). |
| **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** | Supabase **anon** key only (**RLS** must protect data — never service role here). |
| **`EXPO_PUBLIC_TMDB_API_KEY`** | TMDB read token/key for client-side **`fetch`** (screens + enrichment paths). Match whatever **Bearer** convention the codebase uses. |
| **`EXPO_PUBLIC_RAPIDAPI_KEY`** | RapidAPI subscription(s): **Streaming Availability** and any **Film & Show** tier you subscribed to (**same hub account** avoids 403 mismatches — see **`lib/streaming-rapid.ts`** logs). |
| **`EXPO_PUBLIC_RAPIDAPI_HOST`** | Film & Show **`X-RapidAPI-Host`** string (often **`*.rapidapi.com`**). **`docs/API-ENDPOINTS.md`** also mentions **`EXPO_PUBLIC_RAPIDAPI_FILMSHOW_HOST`** — search **`lib/`** if unsure which env name ships in your branch. |
| **`EXPO_PUBLIC_RAPIDAPI_FILMSHOW_TOP_PATH`** *(optional)* | Defaults to **`/top-100-items`** in **`lib/film-show-rapid-discover.ts`**. |

**Nice-to-have (optional UX):**

| Variable | Purpose |
|---------|---------|
| **`EXPO_PUBLIC_OMDB_API_KEY`** | OMDb ratings (**`lib/ratings.ts`**). |

### 4.2 Server-only / workstation-only (never **`EXPO_PUBLIC_`** — do **not** put in shipped app)

These enable **hosted API routes**, **sync jobs**, migrations, audits, and dashboards. Typical owners: backend lead / infra / Supabase admins.

| Variable | Purpose |
|---------|---------|
| **`TMDB_API_KEY`** | **`app/api/*+api.ts`** server routes (**movie**, **discover**, **search**, **providers**) — Vercel or local API runtime. Often same credential as **`EXPO_PUBLIC_TMDB_API_KEY`** if policy allows—**coordinate with ops**. |
| **`RAPIDAPI_KEY`** | **`api/streaming.ts`** Vercel serverless (**browser** hides key vs **`EXPO_PUBLIC_RAPIDAPI_KEY`** native path — see API doc). |
| **`SUPABASE_SERVICE_ROLE_KEY`** | **Bypasses RLS** — **`scripts/sync-schema.js`**, Stream Finder **`npm run sync:stream-finder`**, **`migrate-waitlist.js`**, and server utilities. |
| **`SUPABASE_URL`** | Same HTTPS project URL as **`EXPO_PUBLIC_SUPABASE_URL`**; used by **`dotenv`**-loaded scripts. |
| **`STREAM_FINDER_KEY`** | Authenticated **`/api/movies`** + provider audits — **`npm run sync:stream-finder`**, **`inspect:stream-finder-payload`**, **`audit:stream-finder-providers`**. |
| **`STREAM_FINDER_MOVIES_URL`** *(optional)* | Override default Stream Finder base (see **`docs/API-ENDPOINTS.md`**). |

### 4.3 CI / QA host env (not read by the Expo runtime)

| Variable | Purpose |
|---------|---------|
| **`MAESTRO_TEST_USER_EMAIL`**, **`MAESTRO_TEST_USER_PASSWORD`** | Maestro flows — pass **`-e`** or shell export; **`docs/depts/qa.md`**. Never commit passwords. |
| **`RESEND_API_KEY`**, **`REPORT_EMAIL`**, **`RESEND_FROM`** *(optional)* | **`npm run report:qa`** email — **`scripts/generate-qa-report.ts`**. |

### 4.4 Non-env items to request access to

| Asset | Why |
|-------|-----|
| **Apple Developer Program** membership + roles | Certificates, identifiers, provisioning, TestFlight/App Store Connect. |
| **Expo** org + **EAS** project linkage | Repo includes a minimal **[`eas.json`](../eas.json)** template — run **`eas init`** / link project IDs per team policy (**`eas whoami`**). |
| **Supabase dashboard** (staging + prod if split) | Auth users, logs, RPCs, **`get_schema_details`** for **`scripts/sync-schema.js`**. |
| **TMDB**, **RapidAPI**, **Stream Finder** dashboards | Rotate keys, confirm subscription surfaces and quotas. |
| **Vercel** (or host) | Production **web origin** for **`/api/*`** and **`vercel.json`** routing — see §5. |
| **Staging vs production matrix** | Ask whether **Supabase / env files / web origin** differ per environment. |

---

## 5. Operational URLs (web, native, serverless)

**Canonical deep dive:** **[`docs/NATIVE_OPERATIONAL_URLS.md`](NATIVE_OPERATIONAL_URLS.md)**.

### 5.1 Mental model

1. **Metro** serves the **JS bundle** in dev — it is **not** your production REST host for **`/api/*`**.
2. **Production web** (typically **Vercel**, see **`vercel.json`**) serves **static export** plus **serverless** handlers for **`/api/*`** paths defined under **`app/api/`** and **`api/streaming.ts`**.
3. **Native apps** talk to **Supabase**, **TMDB**, **RapidAPI**, etc. **directly** using **`EXPO_PUBLIC_*`** where coded. If any feature calls first-party **`/api/...`** without a host, that only works on **web same-origin** — on device you need the **absolute operational web origin** from the team (e.g. **`https://<vercel-app>.vercel.app/api/movie`**).

### 5.2 Request these explicit strings from infra

| Deliverable | Example shape |
|-------------|----------------|
| **Production web base URL** | `https://<deployment>.vercel.app` or custom domain |
| **Staging web base URL** *(if any)* | Separate origin for TestFlight + staging Supabase |
| **Supabase project URL** | Already in **`EXPO_PUBLIC_SUPABASE_URL`** — confirm **prod vs staging** |

### 5.3 Related implementation files

| Area | Path |
|------|------|
| **Vercel routing** | **`vercel.json`** — SPA rewrite excludes **`/api/*`** |
| **Expo API routes** | **`app/api/*+api.ts`** |
| **Vercel-only streaming proxy** | **`api/streaming.ts`** |
| **HTTP index** | **`docs/API-ENDPOINTS.md`** |

---

## 6. EAS / Expo build pipeline

| File | Role |
|------|------|
| **[`eas.json`](../eas.json)** | **Template** **`build`** and **`submit`** profiles (**`development`**, **`preview`**, **`production`**) — run **`eas build:configure`** / **`eas init`** and align **Apple credentials** with your org. Replace defaults with team **project IDs** / **credential strategy** when known. |

**`package.json`** scripts target **`expo run:ios`** locally; **`eas build -p ios`** is the usual path for **cloud** reproducible binaries when the team adopts it.

---

## 7. Dashboard & account access checklist

Use this when onboarding paperwork requires an explicit RACI-style list:

- [ ] **Git** — clone + branch policy for this monorepo  
- [ ] **`.env`** — all rows in **`§ 4`** your role needs (**client-only** vs **server** vs **CI**)  
- [ ] **Operational URLs** — **`§ 5`** + **`docs/NATIVE_OPERATIONAL_URLS.md`** filled in internally  
- [ ] **Apple Developer / App Store Connect** — **`com.reeldive.app`** access  
- [ ] **Expo / EAS** — submit/build permissions  
- [ ] **Supabase** — project + **`service_role`** only if running sync/schema scripts  
- [ ] **Vercel** (or host) — env + domain for **`/api/*`**  
- [ ] **RapidAPI + TMDB + Stream Finder** — subscription + key rotation rights  
- [ ] **Maestro / QA** — test user in Supabase Auth per **`docs/depts/qa.md`**  

---

## 8. Workflow and team process (short)

| Practice | Detail |
|---------|--------|
| **HQ as lobby** | **`HQ.md`** — phase, milestones, pointers to dept offices |
| **Department “offices”** | **`docs/depts/`** — product, web, tv, shared, qa, marketing, creative |
| **Engineering norms** | **[`.cursorrules`](../.cursorrules)** — API source mandate, TV office law, Supabase rules, hands-off protocol for agents |
| **AI / architect prompts** | **`docs/REELDIVE_LLM_ONBOARDING_PROMPT.md`**, **`docs/REELDIVE_PRELAUNCH_CLAUDE_PROMPT.md`** |
| **Developer flight manual** | **`README_DEV.md`** — architecture, Stream Finder, waitlist, schema sync scripts |
| **Commits** | Human or architect-driven; do not assume auto-commits from consultants |

---

## 9. App identity (iOS-relevant)

| Key | Value / path |
|-----|--------------|
| **Display name** | ReelDive (`app.json` → `expo.name`) |
| **Slug** | `reeldive` |
| **iOS bundle ID** | **`com.reeldive.app`** |
| **URL scheme** | **`reeldive`** (`app.json` → `expo.scheme`) — universal links / **associated domains** are Apple-side configuration (Product / Marketing / infra) |
| **Tablet** | **`supportsTablet`: `true`** |
| **Theme** | **`userInterfaceStyle`: `dark`** |
| **Orientation** | **`app.json`**: `"landscape"`; **`app/_layout.tsx`**: **`expo-screen-orientation`** locks **`LANDSCAPE`** on native (including iOS). See **`docs/depts/ios-rules.md`**. |

---

## 10. APIs and integrations (index)

**Canonical index:** **[`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md)** — first-party **`/api/*`**, **Supabase**, **TMDB**, **RapidAPI**, **Stream Finder**, **OMDb**, quick env checklist.

**High-level roles:**

| Layer | Role |
|-------|------|
| **Stream Finder → Supabase** | Mirrored catalog and provider availability; default Discover at scale (~**1,206** titles / **16** providers at last HQ checkpoint) |
| **TMDB** | Images, detail, **filtered** discover when user applies filters — not the unfiltered default curator per Product |
| **RapidAPI** | Streaming availability + Film & Show style top lists per **[`.cursorrules`](../.cursorrules)** / API doc |
| **Supabase** | Auth, profiles, watchlists, media tables — schema **`docs/database_schema.md`** |

**Scripts (operators):** `npm run sync:stream-finder`, `node scripts/sync-schema.js` (service role), `npm run check:env-security`, `npm run report:qa`.

---

## 11. Database

| Topic | Location |
|-------|----------|
| **Schema reference** | **`docs/database_schema.md`** (regenerated via **`scripts/sync-schema.js`** + RPC) |
| **Client** | **`lib/supabase.ts`** (native: **AsyncStorage**) |
| **Server / scripts** | **`lib/supabase-server.ts`**, sync + migration scripts |
| **RLS** | Assume enabled; use **anon** key in app; **never** read **`auth.users`** from client — use **`profiles`** per **[`.cursorrules`](../.cursorrules)** |

---

## 12. Layout and navigation (handset vs TV)

### 12.1 Handset / web adaptive layout (your default reference for “iPhone”)

- **`lib/viewport-utils.ts`**
  - **`bucketViewportWidth(raw)`** — 10px discrete buckets so **`useWindowDimensions()`** jitter (Safari chrome, rotations) does not thrash grids.
  - **`discoverPosterGridColumns(bucketWidth)`** — **≥900 → 6**, **≥600 → 4**, else **3** columns.
- **Discover** combines Stream Finder paging, TMDB enrichment, and TV-specific branches in **`app/(tabs)/discover.tsx`** (`isTvTarget()` gates TV grid row componentry and **`getItemLayout`** stride).
- **Shared primitives:** **`components/MovieRow.tsx`**, **`docs/depts/shared.md`**.

### 12.2 Android TV (reference only)

- Fixed poster **140×210**, five columns, 20px gap, sidebar **128px**, discover vertical stride **286px** — **`docs/depts/tv.md`**, **`docs/tv_layout_rules.md`**.

### 12.3 Tab shell and order

**Standard order:** Home → Search → Watchlist → Watched → Discover → Profile (**Profile** is the anchor).

Implementation: **`app/(tabs)/_layout.tsx`** — swaps between **bottom tabs** (handset-shaped) vs **`TvSidebarTabBar`** when **`isTvTarget()`** is true.

### 12.4 Critical: `isTvTarget()` vs iOS Simulator

Because **`app.config.ts`** propagates **`android.isTV`** from **`app.json`** into **`expo.extra.isTV`**, **`isTvTarget()`** may evaluate **true on iOS handset builds** unless the team splits profiles. **`docs/depts/ios-rules.md`** explains the implications (sidebar shell, TV branching). Inspect **`Constants.expoConfig?.extra`** early when layouts look wrong on phone.

### 12.5 Heads-up — confirm with Product / build profiles

1. **Dedicated iPhone/Android-phone shell vs unified TV manifest:** If handset must always use **bottom tabs** rather than **`TvSidebarTabBar`**, the team typically needs separate **Expo/EAS flavors** so **`extra.isTV`** is **false** on phone builds — **`eas.json`** + **`app.config.ts`** / manifests.  
2. **Landscape vs portrait on iPhone:** Today the project is **landscape-first** — **`docs/depts/ios-rules.md` §2**. Confirm with Product / Marketing / QA before Store screenshots.

---

## 13. Key file map

| Area | Path |
|------|------|
| **Router & screens** | `app/` (`(tabs)/`, `login.tsx`, `movie/[id].tsx`, …) |
| **TV detection** | `lib/isTv.ts`, `app.config.ts` |
| **Viewport / grid tiers** | `lib/viewport-utils.ts`, `components/MovieRow.tsx` |
| **Discover logic** | `app/(tabs)/discover.tsx`, `lib/stream-finder-supabase.ts`, `lib/film-show-rapid-discover.ts` |
| **Auth / DB client** | `lib/supabase.ts` |
| **Stream Finder sync** | `lib/services/stream-finder-sync.ts` |
| **Config** | `app.json`, `app.config.ts`, `eas.json` |
| **Android-only plugins** | `plugins/withAndroid*.js` (no-op on iOS but document cross-platform reads) |

---

## 14. Assets (bundled branding)

Primary paths under **`assets/`** (referenced from **`app.json`**):

| File | Typical use |
|------|--------------|
| `icon.png` | App icon |
| `splash-icon.png` | Splash |
| `favicon.png` | Web |
| `android-icon-foreground.png`, `background.png`, `monochrome.png` | Android adaptive icon |
| `tv-banner.png` | Android TV banner |
| `ReelDive-Logo1.png`, `ReelDive-Logo2.PNG`, `reeldive-sonar-reel-hero-mark.png` | In-app branding (e.g. TV sidebar mark) |

Store screenshots and Apple-specific marketing collateral are owned by **`docs/depts/marketing.md`** / HQ checklist rows.

---

## 15. Testing and quality gates

| Tool | Detail |
|------|--------|
| **Maestro** | **`testing/maestro/`**, **`npm run test:smoke-maestro`** — **`docs/depts/qa.md`** |
| **Env scan** | `npm run check:env-security` |
| **QA digest** | `npm run report:qa` |

---

## 16. Related documents (read in this order)

1. **`HQ.md`** — ecosystem map  
2. **`README_DEV.md`** — hybrid architecture narrative  
3. **`docs/NATIVE_OPERATIONAL_URLS.md`** — **operational origins** (`/api/*`, Vercel, native vs web)  
4. **`docs/depts/product.md`** — roadmap, Discover Phase 1, hybrid data rule  
5. **`docs/API-ENDPOINTS.md`** — all HTTP integrations + env checklist  
6. **`docs/database_schema.md`** — live schema  
7. **`docs/depts/ios-rules.md`** — iOS-specific constraints  

If anything in this onboarding conflicts **`docs/depts/tv.md`**, TV doc wins **for Android TV surfaces only**—not for iPhone layouts.
