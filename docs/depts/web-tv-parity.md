# Web ↔ TV parity & crossover

**Path:** `docs/depts/web-tv-parity.md`  
**Purpose:** One place for **Product** and **Marketing** to see what **ReelDive Web** and **Android TV** share, how they differ, and what **not** to promise publicly.  
**Detail offices:** [Web](web.md) · [TV](tv.md) · [TV layout rules](../tv_layout_rules.md) · [Shared](shared.md) · [Product](product.md) · [Public FAQ drafts](../marketing/FAQ.md)

---

## 1. Shared foundation (both surfaces)

| Area | What is shared |
| :--- | :--- |
| **Codebase & routes** | Single **Expo Router** app: shared **`app/(tabs)/`** screens (**Home → Search → Watchlist → Watched → Discover → Profile**). Auth via **`/login`**; no separate **Account** tab. |
| **Backend** | **Supabase** (auth, **`profiles`**, watchlists, **`user_library`** (Watched shelf + ratings), legacy **`watched_history`**, etc.) per [`docs/database_schema.md`](../database_schema.md). |
| **Discovery data** | **Stream Finder → Supabase mirror** drives default **Discover** curation, availability, and **Profile → My services** (provider catalog from **`GET /api/providers`**, pruning on sync). **TMDB** enriches imagery; filtered Discover can call TMDB Discover—see [Web data architecture](web.md#data-architecture-sync). |
| **Hybrid mandate** | Default unfiltered landing stays **Stream Finder–ordered**; TMDB is **not** a drop-in replacement for that ordering. |
| **High-traffic screen** | **`app/(tabs)/discover.tsx`** is **one implementation** shared by browser and TV; surface-specific layout branches apply inside. |

---

## 2. What both Web and TV can do (Phase 1 scope)

These capabilities are **intended to be available** on both **Web** and **Android TV** for the same signed-in user (subject to normal bugs, feature flags, and staged rollouts):

| Capability | Notes |
| :--- | :--- |
| **Browse Home / rails** | Curated rows; TV uses lean-back rows and focus; Web uses pointer/scroll. |
| **Search** | Shared route; **TV** uses **D-pad** focus and native keyboard/IME behavior per [TV office](tv.md). |
| **Watchlist & Watched** | Same underlying data; presentation tuned per surface. **Watched shelf + 1–5 personal ratings** on **`user_library`** — rate from Watched rows or when **Add to Watched** on movie detail ([`components/StarRating.tsx`](../../components/StarRating.tsx)). |
| **Discover** | Same **Stream Finder** default feed + filters; **grid math differs** (see §4). |
| **Profile** | **My services**, provider tiles, save flows—**shared** stack; **TV** layout & focus rules—see **[TV office — Profile](tv.md)**. |
| **Title / availability discovery** | See where titles stream (badges/logos from mirror + fallbacks)—**not** in-player streaming of third-party catalogs. |

**Product framing (copy-safe):** ReelDive is a **discovery and availability** surface. It **does not** replace paid **subscriber/streamer apps** for playback entitlement, and it is **not** a universal **in-app playback** product for catalog titles.

---

## 3. Shared user state (“crossover”)

When the **same account** is used on **Web** and **TV**:

| Shared | Mechanism |
| :--- | :--- |
| **Identity & session** | Supabase Auth; **Web** persists via **browser storage**, **native/TV** via **AsyncStorage** (see [`HQ.md`](../../HQ.md)). |
| **Profile & preferences** | e.g. **enabled_services** / synced provider selections constrained to **`stream_finder_providers`** after sync—details in [Profile & My services — auto-pruning](web.md#profile--my-services--auto-pruning). |
| **Watchlist / Watched / library** | **`user_library`** is the Watched list + **`personal_rating`** authority (stats header included). **`watched_history`** still written by the global watched toggle — cleanup queued in [Product roadmap](product.md). **Cross-device UX** (ordering, latency, Phase 2 watchlist semantics) evolves per Product. |

Agents should assume **conceptual parity** (“one account everywhere”) unless **Product** documents an intentional exception.

---

## 4. Limitations & differences (by surface)

### 4.1 Web-specific

| Topic | Limitation / distinction |
| :--- | :--- |
| **Layout engine** | **Responsive** grids: **`bucketViewportWidth`** + **`discoverPosterGridColumns`** (**3 / 4 / 6** tiers by width). Raw **`window` width churn** risks render loops—see [Mobile Web Stability](web.md#mobile-web-stability-standards). |
| **Input model** | Pointer, keyboard, scroll; **no** D-pad spatial focus ring semantics. |
| **Document shell** | Viewport/meta behavior rides on **`app/+html.tsx`** — required for sane mobile breakpoints. |

### 4.2 Android TV–specific

| Topic | Limitation / distinction |
| :--- | :--- |
| **Poster grid** | **Fixed** **140×210** posters, **5** columns, **20px** horizontal gap—**never** derive TV poster width from **`windowWidth` / fluid row division**. Authority: [`docs/depts/tv.md`](tv.md) & [`docs/tv_layout_rules.md`](../tv_layout_rules.md). |
| **Discover TV scroll** | Uniform row lists use **`DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX` = `286`** for **`getItemLayout` / snap** when applicable—do not substitute legacy fractional strides. |
| **Input model** | **D-pad** focus, lean-back readability, overscan-safe margins—**focus scaling** requires parent padding so borders are not clipped. |
| **Performance** | Paged **`Stream Finder` reads**, conservative poster tiers, **`expo-image`** caching on TV grids—see [Discover primary feeds — pagination & posters](tv.md). |
| **Native changes** | Many manifest/network changes require **`npm run tv:clean`** rebuild discipline—see [TV troubleshooting](tv.md). |

### 4.3 Neither surface is…

Synced visitor FAQs (draft ↔ live site): **`docs/marketing/FAQ.md`** ↔ **`getreeldive.com`** — see **`docs/depts/marketing.md`**.

Use this block in **FAQ / external** copy when tightening expectations:

- **Not an in-player “watch everything here” playback app** for third-party catalogs.  
- **Not a substitute** for subscribing to Netflix, Prime Video, Disney+, Max, etc.  
- **A discovery hub** → **helps users decide**—then hands off to the appropriate **streamer apps / sites**.

---

## 5. Quick reference links

| Need | Doc |
| :--- | :--- |
| Web breakpoints, buckets, Discover | [Web office](web.md) |
| TV grid, sidebar order, Discover stride, emulation | [TV office](tv.md) |
| TV spacing & scroll law | [`docs/tv_layout_rules.md`](../tv_layout_rules.md) |
| Shared viewport helpers | [Shared components](shared.md) |
| Roadmap & milestones | [Product office](product.md) · [State audit](../../reeldive_state.md) · [Infrastructure map](../infrastructure.md) |
| QA / smoke matrix | [QA office](qa.md) |
| Public FAQ drafts (dual with site) | [`docs/marketing/FAQ.md`](../marketing/FAQ.md) |

---

_Update this file when a capability becomes Web-only, TV-only, or when GTM posture changes materially._
