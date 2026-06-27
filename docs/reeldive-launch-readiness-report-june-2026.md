# ReelDive Launch Readiness Report

**June 2026 · Handoff edition**

Written so someone new can walk in tomorrow and understand where the project stands, what works, what does not, and what must happen before launch.

**Report date:** June 7, 2026  
**Code checkpoint:** branch `web-tv-parity-6-4`, commit `cfb2dd7`  
**Status:** Not launched. Web and Android TV are close on engineering; go-to-market, store, and QA sign-off are not done.

---

## How to use this document

This is the **master launch report**. It pulls together Product, Engineering, Web, TV, Mobile, QA, Marketing, and Backend in one place.

Until those splits happen, **treat this file as the single source of truth for launch readiness.**

**Update (June 2026):** Department sections below are **also copied** into each office file. Use this document for the **full picture**; use office files for **day-to-day work** in that area.

| Section in this report | Office file |
| :--- | :--- |
| Product & roadmap | [`docs/depts/product.md`](depts/product.md) — [Launch readiness](depts/product.md#launch-readiness-june-2026) |
| Web readiness | [`docs/depts/web.md`](depts/web.md) — [Launch readiness](depts/web.md#launch-readiness-june-2026) |
| Android TV readiness | [`docs/depts/tv.md`](depts/tv.md) — [Launch readiness](depts/tv.md#launch-readiness-june-2026) |
| Mobile / iOS rules | [`docs/depts/ios-rules.md`](depts/ios-rules.md) — [Launch readiness](depts/ios-rules.md#launch-readiness-june-2026) |
| Backend & data | [`docs/infrastructure.md`](infrastructure.md) — [Launch readiness](infrastructure.md#launch-readiness-june-2026) |
| QA & testing | [`docs/depts/qa.md`](depts/qa.md) — [Launch readiness](depts/qa.md#launch-readiness-june-2026) |
| Marketing & GTM | [`docs/depts/marketing.md`](depts/marketing.md) — [Launch readiness](depts/marketing.md#launch-readiness-june-2026) |

**Other useful references:** [`HQ.md`](../HQ.md) · [`reeldive_state.md`](../reeldive_state.md) · [`assistant.md`](../assistant.md) · [`docs/infrastructure.md`](infrastructure.md)

---

## The story in one page

**What ReelDive is**

ReelDive helps people **find** movies and shows across streaming services. It is **not** a player. Users browse a curated catalog, build a watchlist, mark titles as watched, rate them with 1–5 stars, see where to stream, and on TV can jump out to Netflix, Disney+, and similar apps. One Expo app powers the website, Android TV, and (technically) phone builds.

**Where we are**

Phase 1 — getting Discover stable on Web, mobile, and TV — is **done**. Phase 2 — ratings, movie-detail polish, trailers, store prep — is **in progress**. We have not announced a public ship date. Marketing docs say **Web + Android TV** are the launch surfaces; **phone app stores are TBD**.

**The honest headline**

The product **mostly works** on Web and Android TV in development. We are **not ready to flip the switch** until we: submit to Google Play, QA on a real TV, merge our active branch to `main`, fix or document a watched-data bug, capture marketing screenshots, and decide whether the website opens fully or stays on “Coming soon.”

**Top five blockers**

1. No signed Android TV app submitted to Google Play yet.  
2. No full QA pass on a physical Android TV device.  
3. Active feature work still on branch `web-tv-parity-6-4`, not merged to `main`.  
4. Marketing lacks product screenshots and an approved ship date.  
5. Two different database paths for “watched” status — needs a fix or a clear launch waiver.

---

## Project map (for a new owner)

**Main app repo** — this repository (`StreamScape`, product name ReelDive)

**Waitlist site** — [getreeldive.com](https://getreeldive.com)  
Separate repo: [v0-reel-dive-landing-page](https://github.com/trevorseitz-ai/v0-reel-dive-landing-page)

**App identity** — `com.reeldive.app`, version `1.0.0` (not in stores yet)

**Backend** — Supabase (auth, profiles, watchlist, watched shelf, Stream Finder mirror). Schema: [`docs/database_schema.md`](database_schema.md)

**Web hosting** — Vercel (static export plus `/api/*` routes)

**Catalog** — Stream Finder mirrored into Supabase. Last documented sync: April 30, 2026 — about **1,206 movies**, **16 streaming providers**. Refresh with `npm run sync:stream-finder`.

**Secrets** — Copy [`.env.example`](../.env.example) to `.env`. Never commit `.env`.

### First commands on day one

```bash
npm install
npm run web              # browser
npm run android          # TV — start ReelDive_TV emulator first
npm run check:env-security
npm run simulate:trailer-tv
npm run test:trailer-maestro   # needs emulator + EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1 in .env
npm run sync:stream-finder
```

---

## Product & roadmap

### Phases

**Phase 1 — Discovery & Stability — COMPLETE**

We shipped a shared six-tab app (Home, Search, Watchlist, Watched, Discover, Profile) on Web, mobile browsers, and Android TV. Default Discover reads from Stream Finder in Supabase, not raw TMDB lists. Layout stability fixes (viewport bucketing) stopped mobile web from thrashing. Profile “My Services” prunes to the 16 synced providers.

**Phase 2 — User utility & bug squashing — IN PROGRESS**

Recently shipped:

- Personal **1–5 star ratings** on the Watched tab  
- **16:9 trailer player** on Web and TV (fixed a stretch bug on TV)  
- Movie detail parity: cast, IMDb/RT/Metacritic chips when cached, provider logos  
- **TV Search focus bridge** (sidebar → suggestions / result poster; keyboard-stable typing)  
- **Movie detail two-row actions** (Watchlist + Watched, then full-width **Discover More Like This**)  
- **Signed-out TV Home → login** (no in-tab blackout); Maestro dev bypass for Home/Discover browse  
- **`expo-dev-client`** for physical TV Metro dev workflow  
- Maestro automated test for the trailer flow on TV emulator  

Still open:

- Google TV store submission  
- Physical TV human sign-off (Search D-pad, movie detail actions, trailer on real panel)  
- Watched data model cleanup  
- Deep linking across all 16 providers  
- Separate phone vs TV Android builds  

**Monetization — PLANNED ONLY**

Spec exists (1-month trial, then free tier, 2-week retention grace) but **nothing is built**. Do not promise paid features in launch copy.

**Public launch — NOT SHIPPED**

Engineering on Web + Android TV is largely ready. Launch is blocked by store, QA, marketing assets, and a handful of product decisions.

### What users can do today (by surface)

| Capability | Web | Android TV | Phone* |
| :--- | :---: | :---: | :---: |
| Sign in / sign up | Yes | Yes | Yes |
| Browse Discover (~1.2k titles) | Yes | Yes | Yes |
| Filter Discover (TMDB) | Yes | Yes | Yes |
| Search | Yes | Yes | Yes |
| Watchlist | Yes | Yes | Yes |
| Watched shelf + star ratings | Yes | Yes | Yes |
| Movie detail, cast, trailers | Yes | Yes | Yes |
| “Watch on” / open streamer app | Partial | Best | Partial |
| Play video inside ReelDive | No | No | No |
| Paywall | No | No | No |

\*Phone builds compile but are **not** a launch target. The Android config is TV-first today.

### Known product issue (launch-critical)

When a user toggles “watched” from some global flows, data goes to **`watched_history`**. The Watched tab and ratings use **`user_library`**. A user could mark something watched in one place and not see it (or its rating) in the other. **Fix this or document a waiver before launch.**

---

## Web readiness

**Overall: Yellow — close, needs QA and a go-live decision**

### What’s in good shape

The website is the most mature surface. Responsive Discover grid (3, 4, or 6 columns by width), stable mobile Safari behavior, full auth, watchlist, watched ratings, movie detail with 16:9 trailers, and Profile / My Services all work. API routes on Vercel support enrichment. Account state syncs with TV through Supabase.

### What’s missing or risky

- **Pre-launch vs full open:** Docs say the live URL may show “Coming soon” until Marketing sets a ship date. That gate may not be fully implemented in code — confirm before launch.  
- **Automated browser tests:** Maestro covers native; there is no Playwright/Cypress suite for Web.  
- **Production check:** Verify env vars and CSP on Vercel before pointing traffic.

### Before Web goes live

Manually test on Chrome and Safari (desktop and phone widths): sign in, load Discover at full catalog size, watchlist and watched with ratings, movie detail and trailer, Profile save. Decide with Marketing: full app or coming-soon shell.

**→ Future home:** [`docs/depts/web.md`](depts/web.md) — see [Launch readiness (June 2026)](depts/web.md#launch-readiness-june-2026)

---

## Android TV readiness

**Overall: Yellow on product, Red on store — best experience, not yet submitted**

### What’s in good shape

This is where most lean-back UX investment went: fixed 140×210 poster grid, 5 columns, D-pad navigation on major tabs, Watched ratings with a TV-friendly modal, 16:9 trailers (recently fixed and covered by an automated emulator test), and “Watch on” intents to installed streamer apps. Release builds can talk to TMDB directly when Vercel APIs are unavailable.

### What’s missing or risky

- **Google Play:** No signed AAB uploaded. No listing screenshots, copy, or content rating done.  
- **Physical device QA:** Trailer test passed on emulator only. Real Sony/TCL/Google TV boxes behave differently for focus and app intents. **Code shipped** for Home + Search focus bridge and movie detail two-row actions — **human sign-off on hardware pending**.  
- **TV-only config bleeds to phone:** `android.isTV: true` in app config means phone APKs get TV chrome until build flavors split.

### Before TV goes live

Build and sideload a **release** AAB on a real Google TV device. Run the full D-pad walkthrough (include **Search** sidebar → suggestions and **movie detail** action rows). Test top streamers (Netflix, Disney+, Prime, Max, Hulu). Complete Play Console listing.

**→ Future home:** [`docs/depts/tv.md`](depts/tv.md) — see [Launch readiness (June 2026)](depts/tv.md#launch-readiness-june-2026)

---

## Mobile (iPhone & Android phone) readiness

**Overall: Red — not a launch surface**

The same codebase runs on phones, but we have **not** treated handset as a product. Global landscape lock hurts phone UX. Android builds use TV mode. There is no App Store or Play Store plan, no handset-specific QA, and Marketing explicitly says **do not promise phone store dates**.

Before any handset launch you would need: separate EAS build profiles, portrait-friendly layout, store assets, and a dated entry in the marketing bible.

**→ Future home:** [`docs/depts/ios-rules.md`](depts/ios-rules.md) — see [Launch readiness (June 2026)](depts/ios-rules.md#launch-readiness-june-2026)

---

## Backend & data

**Overall: Green for current scope — production Supabase in use**

Auth, profiles, watchlists, and `user_library` (watched + ratings) run on Supabase with RLS. Migrations live in `supabase/migrations/` only — do not hand-edit production. Recent migration adds `personal_rating` on `user_library`.

Stream Finder sync keeps the catalog mirror fresh. TMDB enriches posters and powers filtered Discover. RapidAPI supports per-title streaming availability. OMDb populates external rating chips when keyed.

Before launch: run a fresh sync, confirm ~1,206 titles / 16 providers, verify all migrations applied through `20260605161700_user_library_personal_rating.sql`.

**→ Office home:** [`docs/infrastructure.md`](infrastructure.md) — [Launch readiness (June 2026)](infrastructure.md#launch-readiness-june-2026)

---

## QA & testing

**Overall: Yellow — some automation, no CI, manual sign-off incomplete**

### Testing already done

| What | How | Result |
| :--- | :--- | :--- |
| Secret scan in repo | `npm run check:env-security` | Script works |
| Trailer layout math | `npm run simulate:trailer-tv` | Pass (June 2026) |
| Trailer flow on TV emulator | `npm run test:trailer-maestro` | Pass (June 2026) |
| Discover at ~1k rows | Phase 1 validation | Pass in prod posture |
| Mobile web layout stability | Viewport bucketing | Pass; documented |

### Testing not done (gaps)

- No GitHub Actions CI in the repo  
- Full smoke test (`npm run test:smoke-maestro`) not verified green — needs login credentials and a missing test ID on Discover  
- No Web browser E2E  
- No unit test suite  
- Maestro on **release** APK with real auth (dev bypass is off in production)  
- Physical Android TV sign-off  
- Formal checklist for new Watched ratings feature  

### Manual testing still required before launch

**Account:** Sign up, sign in, sign out on Web and TV. Session survives restart. Same account sees same watchlist on both.

**Discover:** Grid loads. ~16 providers, ~1,206 titles after sync. Filters work.

**Watchlist & Watched:** Add, remove, reorder. Rate from Watched tab. Stats update. Resolve the watched_history vs user_library behavior.

**Movie detail:** Both ID types work. Cast navigates when TMDB id exists. Trailer is 16:9 on real TV and Web. “Watch on” opens apps on physical TV.

**TV-only:** Full D-pad path. Login with TV keyboard. Release build without Metro dev server.

**Web-only:** Mobile Safari 390–430px. Desktop 6-column grid.

**Store:** Release AAB installs cleanly. Permissions acceptable to Play policy.

Master checklist lives in [`docs/depts/qa.md`](depts/qa.md).

**→ Future home:** [`docs/depts/qa.md`](depts/qa.md) — see [Launch readiness (June 2026)](depts/qa.md#launch-readiness-june-2026)

---

## Marketing & go-to-market

**Overall: Yellow on strategy, Red on execution assets**

### Do we have a plan?

**Yes.** Substantial documentation exists:

- **[Marketing Bible](depts/marketing.md)** — positioning, voice, four platforms, visual rules  
- **[12-week pre-launch action plan](marketing/reeldive-prelaunch-marketing-action-plan.md)** — week-by-week tickets (W1–W12), KPIs, risks  
- **[FAQ draft](marketing/FAQ.md)** — must stay aligned with getreeldive.com  
- **Waitlist site** — live at getreeldive.com (separate repo)

**Launch doctrine (do not violate):**

- ReelDive is **discovery**, not playback  
- **Web + Android TV** launch together at product launch  
- **Phone stores: TBD** — do not advertise App Store / Play handset dates  
- **No public ship date yet** — no countdown copy until Product writes a date into marketing.md  

The 12-week plan is a **complete spec**. Most W1–W2 operational tasks (spreadsheet, channel inventory, FAQ audit, analytics on landing) appear **not started**.

### Do we have assets?

**Partial.**

**In the repo (`assets/`):** App icon, splash, favicon, Android adaptive icons, TV store banner, brand logos, hero mark for login/TV.

**Missing for launch:**

- Web Discover screenshots (desktop, 6-column, “Hollywood premium” look)  
- Android TV Discover screenshots (5-column grid per TV layout rules)  
- Promo video / social cuts (2.39:1 framing per brand spec)  
- Final Play Store and web marketing copy  
- Press kit / one-pager  
- Confirmed waitlist email tooling (ESP, UTM — open questions in action plan §A.6)

Planned folder for captures: `assets/marketing/` (does not exist yet).

### What marketing still needs

1. Answer nine **clarifying questions** in the action plan (UTM rules, email provider, landing analytics, social handles, press list, beta pipeline, legal reviewer, etc.)  
2. Run **Week 1–2 tickets** — ops sheet, FAQ parity audit vs live site, analytics check on getreeldive.com  
3. **Capture product screenshots** with founder sign-off on aesthetic  
4. **Set ship date** in marketing.md when Product approves — only then enable countdowns  
5. **Play Store listing pack** — descriptions, TV screenshots, feature graphic  
6. **Founder approval** on every customer-facing artifact (nothing ships as “NOT APPROVED”)  

**→ Future home:** [`docs/depts/marketing.md`](depts/marketing.md) — see [Launch readiness (June 2026)](depts/marketing.md#launch-readiness-june-2026)

---

## What must happen to launch

Work in this order. Track completion in your issue tracker; this list is the intent.

### Must-have (P0) — block launch until done

1. Merge `web-tv-parity-6-4` into `main` and tag a release candidate  
2. Full QA on a **physical** Android TV (use checklist above)  
3. Build and upload a **signed Android TV AAB** to Google Play (internal or beta track)  
4. Complete **Play Console listing** — copy, screenshots, banner, content rating, data safety  
5. Secure **release signing** (EAS or Play App Signing; keystore not in git)  
6. **Production environment** on Vercel and Supabase with rotated keys  
7. Green **`check:env-security`** on the RC branch  
8. Green **Maestro smoke** on release APK with a test user  
9. **Fix or formally waive** the watched_history / user_library split  
10. **Ship date** in marketing.md OR explicit “soft launch” without countdown  
11. **FAQ parity** between docs/marketing/FAQ.md and getreeldive.com  
12. **Web go-live decision** — full app vs Coming soon — implemented in code if needed  

### Should-have (P1) — credible v1.0; can waive individually with written note

13. Physical TV sign-off — Search focus bridge, movie detail actions, trailer 16:9  
14. GitHub Actions — at least env-security on every PR  
15. Wire `discover-smoke-poster` test ID for Maestro smoke  
16. Handset vs TV EAS build split  
17. Pre-launch Stream Finder sync + count verification  
18. OMDb production key and rating backfill plan  
19. Marketing screenshots in `assets/marketing/`  
20. Privacy policy and Terms links in app and store  

### Can wait (P2) — post-launch or explicit deferral

21. Paywall / subscriptions  
22. Deep links for all 16 providers on iOS/Web  
23. Watchlist cross-device conflict rules  
24. Handset App Store / Play public launch  
25. Apple TV (tvOS)  
26. Nightly automated QA email in CI  
27. Re-rate stars from movie detail screen  

---

## Proof we are ready to launch

Collect these in a **Launch Readiness folder** (Drive, Notion, or GitHub Release assets) before announcing GA.

### Engineering

- RC git tag and short changelog  
- `qa-audit-summary.json` from `npm run report:qa` showing PASS  
- Screenshot or log of `check:env-security` exit 0  
- Signed AAB file name and versionCode  
- Production Vercel URL (pinned deployment)  
- List of applied Supabase migrations  
- Stream Finder sync report (title count, provider count, date)  
- **Known issues / waivers** one-pager (Focus Bridge, watched split, OEM gaps)  

### QA

- Signed copy of [`docs/depts/qa.md`](depts/qa.md) checklist for the RC  
- Maestro logs for smoke + trailer on **release** build  
- Physical TV test notes: device model, Android version, pass/fail per area  
- Photo or note confirming 16:9 trailer on real panel  

### Marketing & GTM

- Ship date memo in marketing.md  
- FAQ parity sign-off (doc matches live site)  
- Final store listing copy  
- Screenshot set: Web Discover, TV Discover, movie detail, Watched ratings  
- Sentinel checklist passed (no playback claims, no chatbot pitch, no handset store promises)  
- Waitlist / launch email ready if you are emailing the list  

### Legal

- Privacy policy URL live and linked in app + store  
- Google Play Data safety form completed  
- Copy reviewed for streamer trademark boundaries (see FAQ)  

---

## Risks to watch

| Risk | Why it matters | What to do |
| :--- | :--- | :--- |
| Watched data split | Users see inconsistent “watched” state | P0 fix or waiver |
| No CI | Regressions merge silently | Add GitHub Actions minimum |
| Emulator-only TV QA | Focus and intents differ on hardware | Test on real Google TV |
| Release TV without Vercel | Some paths use `/api/*` on Web only | Sideload release AAB early |
| Marketing over-claims | Legal / trust risk | FAQ + Sentinel review |
| Phone build = TV UI | Accidental handset ship | Do not publish phone APK until split |
| Catalog drift | Stale availability | Sync before launch |

---

## Recommended next 30 days

1. Open PR and merge `web-tv-parity-6-4` → `main`  
2. Physical TV QA + release AAB → Play internal track  
3. Marketing captures + Play listing assets  
4. Decide and fix watched data model  
5. Add CI for env-security  
6. Focus Bridge or signed waiver  
7. Execute marketing plan Weeks 1–2  
8. Plan EAS flavors for phone vs TV  

---

## Document maintenance

Regenerate or revise this report when:

- `main` absorbs a major branch  
- Google Play submission status changes  
- Marketing sets a public ship date  
- A launch surface ships or is explicitly deferred  

**Canonical path:** `docs/reeldive-launch-readiness-report-june-2026.md`  
**Product office pointer:** [`docs/depts/product.md`](depts/product.md)

*Last updated: June 7, 2026*
