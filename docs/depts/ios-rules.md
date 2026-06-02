# iOS / native handset — engineering rules

Companion to **[`IOS_NATIVE_DEVELOPER_ONBOARDING.md`](../IOS_NATIVE_DEVELOPER_ONBOARDING.md)** (secrets, operational URLs). Operational URL matrix: **[`docs/NATIVE_OPERATIONAL_URLS.md`](../NATIVE_OPERATIONAL_URLS.md)**. This file captures **constraints and pitfalls** specific to Apple platforms; global product/API mandates live in **[`.cursorrules`](../../.cursorrules)**, **`HQ.md`**, **[`docs/API-ENDPOINTS.md`](../API-ENDPOINTS.md)**.

---

## 1. What “iOS” means in this repo

- **One codebase:** **Expo Router** (`app/`). There is **no separate native Swift UIKit/SwiftUI app repo** for ReelDive—native shell is produced by **Expo prebuild** + React Native unless you extract a bare workflow intentionally.
- **Not Android TV docs by default:** Handset layout and grids follow **`lib/viewport-utils.ts`** + shared screens; **Android TV dimensions and discover stride** are frozen in **`docs/depts/tv.md`** — do **not** apply TV poster sizes (140×210, 286px stride) to iPhone layouts.

---

## 2. Orientation and chrome

- **`app.json`** sets **`orientation`: `"landscape"`** for the Expo project.
- **`app/_layout.tsx`** locks **`expo-screen-orientation`** to **`LANDSCAPE`** on **all native non-web** targets (includes iOS Simulator and device builds).
- **Implication:** Treat the handset experience as **landscape-first**. If Product later requires portrait-first iPhone, that is a coordinated change across **`app.json`**, **`app/_layout.tsx`**, and QA (Maestro / screenshots)—not an isolated iOS toggle.

---

## 3. Safe area and hierarchy

- Root uses **`SafeAreaProvider`** (**`react-native-safe-area-context`**) where applicable; tab shell and screens compose under it. Respect **safe areas** for modals, full-bleed video, and any new native overlays—especially in landscape where top/bottom insets vary by device.

---

## 4. Sessions, storage, and Supabase

- **Native persistence:** Supabase sessions use **`AsyncStorage`** (see **`lib/supabase.ts`**) unlike web **`localStorage`**.
- **RLS:** Assume **Row Level Security** on public tables; client uses the **anon** key only.
- **Never** query **`auth.users`** from the client; use **`profiles` / project tables** documented in **`docs/database_schema.md`**.

---

## 5. Environment variables and secrecy

- **Client-bundled keys** must use **`EXPO_PUBLIC_*`** only; they are visible in shipped binaries—design and PR review accordingly.
- **Forbidden in repo:** Service role keys, private RapidAPI secrets not meant for bundles, **`STREAM_FINDER_KEY`**, etc. Use **`.env.example`** as the checklist; **`npm run check:env-security`** flags risky literals under **`app/`**, **`lib/`**, **`components/`**, **`scripts/`**, etc.

---

## 6. Data-source doctrine (Discover / Top lists)

- **Curated feeds, Top-style rails, trending collections:** Align with **`docs/depts/product.md`** and **[`.cursorrules`](../../.cursorrules)** — RapidAPI Film & Show / hub usage and **TMDB role** are specified there; avoid introducing **TMDB `/discover` or `/trending`** as the primary curator for those surfaces without Product + HQ sign-off.
- **Stream Finder ↔ Supabase** remains the backbone for mirrored catalog scale (see **`HQ.md`** hybrid data pillar).

---

## 7. `isTvTarget()` — critical config interaction

- **`lib/isTv.ts`** — **`isTvTarget()`** is **true** when **`Platform.isTV`** *or* **`expoConfig.extra.isTV`** is true (web excluded).
- **`app.config.ts`** sets **`extra.isTV`** from **`EXPO_PUBLIC_TV` / `EXPO_TV`** *or* from **`android.isTV`** in **`app.json`**. The repo currently sets **`android.isTV`: `true`** in **`app.json`**, which forces **`extra.isTV: true`** for **exported config on every platform**, including **iOS**.
- **Impact:** **`isTvTarget()` may be true on iPhone builds**, so **`app/(tabs)/_layout.tsx`** may choose **`TvSidebarTabBar`** rather than bottom tabs—or mix TV-scoped layout branches—until Product/Expo/EAS splits **TV vs handset** manifests (for example handset-only **`android.isTV: false`** in a branch or **`app.config`** profile).
- When debugging layout on Simulator, **`Constants.expoConfig?.extra`** and **`Platform.isTV`** should be among the first logs you check.

---

## 8. Store and marketing boundaries

- **Bundle identifier:** **`com.reeldive.app`** (`app.json` → **`ios.bundleIdentifier`**).
- **Supports tablet:** **`supportsTablet`: `true`** in **`app.json`**.
- **App Store timing / copy:** **`docs/depts/marketing.md`** — handset storefront dates are **TBD** versus web + Android TV posture; defer public launch promises to Marketing + Product docs.

---

## 9. Native modules and Xcode workflow

- **Repo may omit `ios/`** until **`npx expo prebuild --platform ios`** or **EAS Build** generates it; treat **`app.json`** / **`app.config.ts`** as source of truth for bundle ID, icons, splash, scheme.
- Prefer **`expo run:ios`** / **`npm run ios`** after prebuild when you need **native debugger + Instruments**.

---

## 10. Testing

- **Maestro:** Flows live under **`testing/maestro/`**; **`docs/depts/qa.md`** documents credentials (**never commit passwords**).
- **`npm run report:qa`** aggregates env security + smoke tests per QA office doc.
