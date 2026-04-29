# 🚀 Product & Features Office

## Product roadmap

### Discover Phase 1: Cross-Platform Parity — **COMPLETED**

- **Scope:** Discover default landing and curated feeds aligned across **Web, TV, and native** (shared [`app/(tabs)/discover.tsx`](../../app/%28tabs%29/discover.tsx) with platform-appropriate skins).
- **Outcome:** Featured / “Top”-style landing experiences no longer drift by surface; technical detail lives in [Web](web.md) and [TV](tv.md) offices.

### Hybrid data model — **project standard**

For all **Featured**, **Top**, and equivalent curated rails:

- **RapidAPI (“Film & Show”):** **Curation and ordering** — authoritative list membership and ranking for the hybrid experience.
- **TMDB:** **Metadata only** — posters, imagery, IDs, and enrichment; **not** a replacement curated source for default landings unless the user applies filters that deliberately invoke TMDB Discover.

Operational implementation is centralized via [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts) and mirrored in departmental docs (`web.md`, `tv.md`).

### Technical Constraints

| Area | Requirement |
|:-----|:-------------|
| **Mobile web viewport** | Layout and performance targets **390px–430px** widths (phone Safari / mobile browsers). Dense **3-column** poster grid **≤768px** (see breakpoints in [`web.md`](web.md#responsive-layout-standards)). Avoid driving layout off raw fractional `window.innerWidth`; use **`bucketViewportWidth`** (see [`shared.md`](shared.md)). |
| **Default Discover landing** | Remains RapidAPI-forward + TMDB enrich; TMDB **`/discover`** is for **filtered** queries only once the user changes year / genre / monetization — see roadmap constraints in [`web.md`](web.md#data-architecture-sync). |

---

## TV Technical Architecture

- **Navigation:** Left-rail UI via [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx).
- **Focus management:** Custom bridge in [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) plus native tags from [`hooks/useTvNativeTag.ts`](../../hooks/useTvNativeTag.ts) to steer spatial navigation.
- **TV-first components:** [`components/HomeTvMovieRow.tsx`](../../components/HomeTvMovieRow.tsx) drives horizontal media rows with window-based poster sizing math.
