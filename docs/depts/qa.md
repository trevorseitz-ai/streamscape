# ✅ QA Office (Triple-Platform Quality)

## Test account credentials (Maestro)

**Never commit real passwords.** Use a **dedicated Supabase Auth test user** (least privilege, disposable) for Maestro only.

### Variables

| Variable | Used by | Purpose |
| -------- | ------- | ------- |
| **`MAESTRO_TEST_USER_EMAIL`** | [`testing/maestro/auth-flow.yaml`](../../testing/maestro/auth-flow.yaml) | Chained into `inputText` as `${MAESTRO_TEST_USER_EMAIL}`. |
| **`MAESTRO_TEST_USER_PASSWORD`** | Same | `${MAESTRO_TEST_USER_PASSWORD}` on the login screen (see [`app/login.tsx`](../../app/login.tsx) `maestro-login-*` testIDs). |

### Local setup

1. Create a test user in **Supabase → Authentication** (or your invite flow) with a strong random password.
2. Export in the shell **before** running Maestro, **or** pass inline with **`-e`** (recommended for CI secrets):

   ```bash
   maestro test \
     -e MAESTRO_TEST_USER_EMAIL="qa+yourapp@example.com" \
     -e MAESTRO_TEST_USER_PASSWORD='use-single-quotes-if_special_chars' \
     testing/maestro/smoke-test.yaml
   ```

3. Maestro resolves **`${MAESTRO_TEST_USER_EMAIL}`** / **`${MAESTRO_TEST_USER_PASSWORD}`** from process environment / **`-e`** flags (see [Parameters and constants](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants)). These are **not** read from the Expo app’s **`.env`** — they exist only on the host running the CLI.
4. Optional: add the same names to **`.env.local`** (gitignored) and `source` it in your shell; **do not** add **`MAESTRO_TEST_USER_*`** to **`.env`** if that file is ever bundled or shared.

### Flows

- **Login only:** `maestro test … testing/maestro/auth-flow.yaml`
- **Full smoke:** `npm run test:smoke-maestro` (must forward **`-e`** credentials the same way).
- **Trailer (no login):** `npm run test:trailer-maestro` uses [`auth-bypass.yaml`](../../testing/maestro/auth-bypass.yaml) when **`EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1`** is in **`.env`** (dev builds only — see below).

### Dev auth bypass (Maestro / local E2E)

For flows that do not need a signed-in user (e.g. **movie detail + trailer**), skip the TV login wall:

1. Add to **`.env`**: **`EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1`**
2. **Restart Metro** (`npm run android` or reload after env change).
3. Run flows that use [`auth-bypass.yaml`](../../testing/maestro/auth-bypass.yaml) instead of [`auth-flow.yaml`](../../testing/maestro/auth-flow.yaml).

**Safety:** [`lib/maestroBypass.ts`](../../lib/maestroBypass.ts) gates on **`__DEV__`** — inactive in release/store builds even if the env var is set at build time.

**Smoke / Profile flows** still need real credentials (`auth-flow.yaml`) because they assert signed-in UI.

---

## Mission

**Autonomous validation** of the **ReelDive** ecosystem across **Web**, **mobile (iOS / Android)**, and **Android TV**—repeatable gates that protect **Phase 1** stability and **v1.0.0** readiness without manual-only coverage.

> **Office status:** **Operational** (Phase 1 / v1.0.0). Reporting driver: [`scripts/generate-qa-report.ts`](../../scripts/generate-qa-report.ts) — **`npm run report:qa`**.

Supporting context: **`HQ.md`** (release checklist), [**`product.md`**](product.md), [**`web-tv-parity.md`**](web-tv-parity.md), [**`web.md`**](web.md), [**`tv.md`**](tv.md), [**`shared.md`**](shared.md).

---

## Test matrix

| Axis | Goal | Repo / tooling | Pass criteria (v1.0.0) |
|:-----|:-----|:---------------|:--------------------------|
| **Functional** | End-to-end tab shell + Discover + Profile on a native build. | [Maestro](https://maestro.mobile.dev/) — [`testing/maestro/smoke-test.yaml`](../../testing/maestro/smoke-test.yaml) (includes [`auth-flow.yaml`](../../testing/maestro/auth-flow.yaml)); run **`npm run test:smoke-maestro`** with **`MAESTRO_TEST_USER_*`** set. | Flow completes without timeout; **`discover-smoke-poster`** appears; **`My Services`** visible after **Profile**. Device **`applicationId`** matches **`smoke-test.yaml`** (**`com.reeldive.app`**). |
| **Trailer (TV/Web)** | Movie detail **Watch trailer** modal — **16:9** geometry + open/close on device. | **`npm run simulate:trailer-tv`** (offline); **`npm run test:trailer-maestro`** + [`trailer-tv.yaml`](../../testing/maestro/trailer-tv.yaml) (device; **`EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1`**). | Simulation: all viewports **16:9**; Maestro: modal + player frame + Play + Close; no login required in dev bypass mode. |
| **Security** | No secret literals merged into **`app/`** / libs / scripts. | [`scripts/check-env-security.ts`](../../scripts/check-env-security.ts); run **`npm run check:env-security`**. | Exit code **0**; findings must be **`process.env` / CI-secret** sourced only. Client keys remain **`EXPO_PUBLIC_*`** from env at build time (see **`.env.example`**). |
| **Layout** | Adaptive Discover density + stable viewport math across surfaces. | **`discoverPosterGridColumns`** + **`bucketViewportWidth`** (**10px**) in **`lib/viewport-utils.ts`** (re-exported from **`MovieRow`**); parity rules in **`web.md`** / **`tv.md`**. | **3 / 4 / 6** tiers at canonical breakpoints (**&lt;600 → 3**, **600–899 → 4**, **≥900 → 6**); layouts do not thrash from fractional **`useWindowDimensions()`** jitter. |
| **Data integrity** | Stream Finder mirror in Supabase matches production scale expectations. | Sync: **`npm run sync:stream-finder`**; read path **`lib/stream-finder-supabase.ts`**. Validate row counts (`stream_finder_movies`) vs checkpoint (HQ **STREAM_FINDER_SYNC** block targets **~1,200+** titles; **16** providers roster). | Discover default landing hydrates without persistent empty grids when network + RLS permit; QA records **movie count + provider count** vs last successful sync banner in **`HQ.md`**. |
| **Store readiness** | Lean-back / TV + handset Play policy alignment. | **D-pad / focus bridge** (`lib/tv-search-focus-context.tsx`, **`TvSidebarTabBar`**, **`tv.md`**). Android IME: **`expo.android.softwareKeyboardLayoutMode: "pan"`** → **`adjustPan`** ([**`app.json`**](../../app.json), **`shared.md`**). | No invalid **`windowSoftInputMode`** strings; TV navigation survives smoke path; Marketing owns screenshots / listings. |

---

## Manual / extended QA pointers

- **Web:** Mobile Safari width bucketing & mount guards — [**`web.md`**](web.md#mobile-web-stability-standards).
- **TV:** Focus graph rules (`tvNextFocus*`, sidebar escape) — [**`tv.md`**](tv.md#spatial-engine-routing--focus-graphs).
- **Regression scale:** Discover at **~1k+** mirrored rows stays scroll-smooth (**`product.md`** / **`web.md`**).

### Trailer modal — aspect ratio verification

**Status:** **Fix shipped** (June 2026). Legacy bug: player height was **`~60%` of window height`** while width filled the modal (**~2.96:1** on Android TV). Current: **16:9** via [`lib/trailerLayout.ts`](../../lib/trailerLayout.ts). Detail: [**`tv.md` — Trailer modal**](tv.md#trailer-modal--aspect-ratio).

**Metadata:** **TMDB** sends YouTube **`key`** + **`size`** / **`official`** (not display AR). **YouTube** adaptive quality follows iframe viewport size; no embed API to force 1080p.

| Check | Pass criteria |
| :--- | :--- |
| **Geometry** | Trailer picture is **16:9** — circles/logos in frame look round, not horizontally squashed. |
| **Ultrawide / 4K TV** | Black **pillarbox** on sides is OK; video content must not stretch to fill non-16:9 box. |
| **Play gate (TV)** | D-pad **Play** overlay covers the **same 16:9 region** as the video, not the full modal. |
| **Web parity** | Same title on browser — visually matches TV framing (allow minor browser chrome). |
| **Close control** | Close (×) remains focusable; no focus trap outside the player after fix. |

**Test titles:** Pick at least one TMDB-backed movie and one TMDB-id-only path; open **Watch trailer** from movie detail on **physical Android TV** (emulator + device if possible). Maestro fixture: **`reeldive://movie/550`** (Fight Club).

**Code touchpoints:** `lib/trailerLayout.ts`, `lib/tmdb-trailer.ts`, `components/TrailerPlayer.tsx`, `app/movie/[id].tsx`, `lib/maestroBypass.ts`.

**Automated checks**

| Layer | Command | Pass criteria |
| :--- | :--- | :--- |
| **Layout simulation** | `npm run simulate:trailer-tv` | All viewport profiles **16:9**; Android TV legacy stretch **~2.96:1** vs fixed **~1.78:1**; Fight Club picks official **1080p** key. |
| **Maestro E2E (device)** | `npm run test:trailer-maestro` (**`EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1`** in `.env`, dev build) | Auth bypass → **`reeldive://movie/550`** → **`maestro-movie-watch-trailer`** → modal **`maestro-trailer-player-frame`** → **`maestro-trailer-play`** → **`maestro-trailer-close`**. Flow: [`testing/maestro/trailer-tv.yaml`](../../testing/maestro/trailer-tv.yaml). **Verified passing** on **ReelDive_TV** emulator (June 2026). |

**Maestro testIDs:** `maestro-movie-watch-trailer`, `maestro-trailer-modal`, `maestro-trailer-player-frame`, `maestro-trailer-play`, `maestro-trailer-close`.

---

## Autonomous audit pipeline

> **Status:** **Operational.** In-repo aggregation + Resend HTML digest: **`npm run report:qa`**. Mirror these steps in **GitHub Actions** for the nightly schedule and artifact upload.

### Schedule (GitHub Actions)

Target: **daily at 08:00 UTC** — cron **`0 8 * * *`**. That moment is **04:00** in **US Eastern** while **EDT** is in effect (roughly March–November); during **EST** it is **03:00** Eastern. Keep **`schedule` in UTC** in workflow YAML and treat this block as the contract for “low-traffic” overnight US coverage.

### Workflow steps (reference)

1. **Checkout** default branch (`main`).
2. **`npm ci`**
3. **Nightly digest (recommended single command):** **`npm run report:qa`** — runs **`check:env-security`** then **`test:smoke-maestro`**, writes **`qa-audit-summary.json`**, and sends the Resend HTML digest when **`RESEND_API_KEY`** and **`REPORT_EMAIL`** are set. Requires **Maestro + device/emulator** and **`MAESTRO_TEST_USER_*`** in the job environment (from **GitHub Actions** secrets). Application id must match **`com.reeldive.app`** (see [`testing/maestro/smoke-test.yaml`](../../testing/maestro/smoke-test.yaml)).
4. **PR / lean gate (optional):** **`npm run check:env-security`** only — no emulator spend.

Upload **`qa-audit-summary.json`** (and Maestro logs if captured) as **workflow artifacts** (e.g. **30** day retention).

### Reporting (`qa-audit-summary.json` + Resend)

The generator writes **`timestamp`**, **`commit`**, **`appVersion`**, **`reportStatus`** (**`PASS`** only if both gates exit **0**), **`check_env_security`**, and **`maestro_smoke`** (each with **`ok`**, **`exitCode`**, **`durationMs`**). Email is sent on **PASS or FAIL** whenever **`RESEND_API_KEY`** and **`REPORT_EMAIL`** are set, so failures still reach on-call.

| Variable | Purpose |
| -------- | ------- |
| **`RESEND_API_KEY`** | [Resend](https://resend.com/) API key (`Authorization: Bearer …`). |
| **`REPORT_EMAIL`** | Recipient(s); comma-separated list allowed. |
| **`RESEND_FROM`** | Optional **From** (default **`ReelDive QA <onboarding@resend.dev>`** until a domain is verified in Resend). |

### Troubleshooting

- **Android TV — Maestro cannot tap Log in / submit hidden:** The lean-back IME often covers **`maestro-login-submit`**. Auth flow uses Maestro **`- back`** after password entry, then **`extendedWaitUntil`** on **`maestro-login-submit`** so the button is visible before tap (there is no **`waitMs`** command in Maestro) — see [`testing/maestro/auth-flow.yaml`](../../testing/maestro/auth-flow.yaml). The login screen also uses a **`ScrollView`** with **`keyboardShouldPersistTaps="handled"`** ([`app/login.tsx`](../../app/login.tsx)).

### CI prerequisites

- **Maestro** + Android emulator or hardware (or cloud substitute) for smoke.
- Secrets: **`MAESTRO_TEST_USER_*`**, and for email **`RESEND_API_KEY`**, **`REPORT_EMAIL`** (and **`RESEND_FROM`** when not using the default sender).
- Optional: build job that supplies **`EXPO_PUBLIC_*`** if smoke runs on a fresh compile.

---

## Related commands

```bash
npm run check:env-security
npm run report:qa           # security + smoke + qa-audit-summary.json + optional Resend email
npm run test:auth-maestro   # Login-only Maestro flow (still needs MAESTRO_TEST_USER_*)
npm run test:smoke-maestro  # Credentials via maestro CLI -e or exported env — see Test account credentials above
```
