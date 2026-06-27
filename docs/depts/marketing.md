# ReelDive Marketing Bible & Core Protocol
**Path:** `docs/depts/marketing.md`  
**Version:** 2.0.0 (4-Platform Omni-Channel Update)  
**Target Audience:** Autonomous Marketing Agents & Central Mesh Database  

> **Launch readiness:** [Launch readiness (June 2026)](#launch-readiness-june-2026) · Master report: [`docs/reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md)

---

## Launch readiness (June 2026)

**Overall: Yellow on strategy, Red on execution assets**

**Checkpoint:** `web-tv-parity-6-4` @ `cfb2dd7` · **Report date:** June 7, 2026

### Do we have a plan?

**Yes.** This bible, [`docs/marketing/reeldive-prelaunch-marketing-action-plan.md`](../marketing/reeldive-prelaunch-marketing-action-plan.md) (12-week W1–W12), [`docs/marketing/FAQ.md`](../marketing/FAQ.md), and live [getreeldive.com](https://getreeldive.com) (separate repo).

**Launch doctrine (do not violate):**

- ReelDive is **discovery**, not playback  
- **Web + Android TV** launch together at product launch  
- **Phone stores: TBD** — no App Store / Play handset dates in copy  
- **No public ship date yet** — no countdown until Product adds a date below ([Announced ship date](#announced-ship-date--movie-ticket-cadence))

The 12-week plan is a **complete spec**. Most **W1–W2** ops tasks (spreadsheet, channel inventory, FAQ audit, landing analytics) appear **not started**.

### Do we have assets?

**Partial.**

**In repo (`assets/`):** App icon, splash, favicon, Android adaptive icons, TV banner, brand logos, hero mark.

**Missing for launch:**

- Web Discover screenshots (desktop, 6-column, Hollywood-premium)  
- Android TV Discover screenshots (5-column per [`tv.md`](tv.md))  
- Promo video / social cuts (2.39:1 per [§3 Visual Identity](#3-visual-identity--cinematic-brand-aesthetics))  
- Final Play Store and web marketing copy  
- Press kit / one-pager  
- Waitlist email tooling (ESP, UTM — open questions in action plan §A.6)

Planned capture folder: **`assets/marketing/`** (does not exist yet).

### What marketing still needs

1. Answer **nine clarifying questions** in prelaunch action plan §A.6 (UTM, ESP, analytics, social handles, press list, beta pipeline, legal reviewer, etc.)  
2. Execute **Week 1–2 tickets** — ops sheet, FAQ parity audit vs getreeldive.com, landing analytics  
3. **Capture product screenshots** with founder aesthetic sign-off  
4. **Set ship date** in this file when Product approves — only then enable countdowns  
5. **Play Store listing pack** — descriptions, TV screenshots, feature graphic  
6. **Founder approval** on every customer-facing artifact  

### Marketing-owned launch tasks

| Priority | Task |
| :--------: | :--- |
| P0 | Play Console listing copy + TV screenshots + feature graphic |
| P0 | FAQ parity: [`docs/marketing/FAQ.md`](../marketing/FAQ.md) ↔ getreeldive.com |
| P0 | Ship date in this bible OR soft-launch memo (no countdown) |
| P1 | Product screenshots in `assets/marketing/` |
| P1 | Privacy policy / ToS links for Web + store |
| P1 | Sentinel checklist on all outbound copy |

### Proof deliverables (Marketing & GTM)

- Ship date memo in this file  
- FAQ parity sign-off  
- Final store listing copy  
- Screenshot set: Web Discover, TV Discover, movie detail, Watched ratings  
- Sentinel pass (no playback, chatbot, or handset store claims)  
- Waitlist / launch email ready if emailing the list  

---

## 1. Executive Summary & Core Positioning

### Mission
ReelDive is a premium, highly cinematic universal streaming aggregator application engineered to eliminate the friction of modern "streaming fatigue." By uniting fragmented content catalogs into a single, cohesive interface, ReelDive transforms media exploration from an administrative chore into an immersive discovery experience.

### The Four-Platform Evolution
Initially engineered as a specialized big-screen platform, ReelDive is scaling into a unified **Four-Platform Ecosystem** (these four surfaces are the **four platform pillars** in positioning and roadmap language):

> **Launch posture (authoritative for external copy):** **Web** and **Android TV** are **launch-ready** at product launch. **iOS** and **Android mobile** (handset App Store / Play listings) are **TBD**—agents must **not** promise same‑day handset store availability, ship dates, or “download on iOS/Android” **until Product updates this file**.

* **Android TV:** Foundational theater experience hub (**launch-ready**).
* **Web Application:** High-velocity desktop canvas discovery and curation portal (**launch-ready**).
* **iOS Mobile:** Premium pocket companion and haptic-fluid remote curation tool (**handset launch TBD**).
* **Android Mobile:** Fast, highly accessible pocket curation engine (**handset launch TBD**).

### Core Value Propositions
* **Omni-Channel Aggregation:** Centralized exploration, dynamic metadata syncing, and unified searching across all primary streaming platforms.
* **Native-Optimized Layouts:** Built from the ground up for individual interface constraints (from D-pad remote loops to trackpad sweeps and mobile touch gestures).
* **Cinematic UX Delivery:** Obsidian-dark immersive design framework treating movie art, cast directories, and video content with absolute aesthetic authority.

> ⚠️ **CRITICAL AGENT DIRECTIVE (BEHAVIORAL RESTRICTION):** ReelDive does **NOT** contain a customer-facing chatbot or conversational support widget. All autonomous agents are strictly prohibited from planning, pitching, writing, or referencing consumer-facing text inputs, chat widgets, or help-desk agents. AI automation is strictly restricted to internal backend metadata processing and automated marketing infrastructure.

### Pre-launch GTM narrative (authoritative framing)

Outbound work should prioritize **recognition**, **truthful problem/solution storytelling**, **what subscribers can realistically expect**, and **how to join the waitlist**. Build **audience and buzz** toward launch; defer **movie-style countdowns** until a ship date appears in this bible (below). Coordinate **single primary CTAs** with Growth—research and document them here when chosen.

**Claude Projects (standalone pre-launch action-plan prompt — no onboarding carry-over):** [`docs/REELDIVE_PRELAUNCH_CLAUDE_PROMPT.md`](../REELDIVE_PRELAUNCH_CLAUDE_PROMPT.md).

### Public FAQ — dual source

- **In-repo (LLM bundles, PR-reviewed):** [`docs/marketing/FAQ.md`](../marketing/FAQ.md) — canonical drafts and factual boundaries (e.g. **not playback**, **not streamer substitution**).
- **Live site (`getreeldive.com`):** Implemented in **`https://github.com/trevorseitz-ai/v0-reel-dive-landing-page`**. Maintain **FAQ parity**: when **`docs/marketing/FAQ.md`** or this bible changes materially, sync the landing repo.

### Waitlist landing — repository

Canonical **waitlist/marketing funnel** codebase: **`https://github.com/trevorseitz-ai/v0-reel-dive-landing-page`**. **`HQ.md`** links the live URL and maps it to ecosystem.

### Announced ship date — “movie ticket” cadence

- **Until a date exists here:** Agents must **not** invent **calendar dates**, countdowns tied to undocumented days, or “opens Friday” rhetoric in outbound copy.
- **When Product/Marketing adds a dated line below**, treat **countdown-eligible surfaces** per **`docs/depts/web.md`**: hosted **web app**, **getreeldive.com**, and other marketing creatives **where proportionate**.
- **`Announced ReelDive web / GA date (Marketing-owned):`** *(none documented — placeholder; add ISO or explicit “Coming [season/year] only” language when Marketing approves)*

---

## 2. The Four-Platform Cross-Playbook

Autonomous marketing agents must continuously emphasize **one product vision across four pillars**, while respecting **launch posture**: **near‑term outbound messaging and paid creative** anchor on **Web + Android TV**. **Do not** present **iOS / Android handset** launches as imminent or simultaneous unless this file explicitly says so.

**Web + TV factual crossover (avoid over-claim in copy):** See **[Web ↔ TV parity & crossover](web-tv-parity.md)** for shared capabilities vs TV-only/Web-only constraints—including **playback / streamer-substitution boundaries**.

### Platform Matrix Specifications

| Platform | Launch posture | Core Identity | Distinctive UX Touchpoint | Marketing Frame Hook |
| :--- | :--- | :--- | :--- | :--- |
| **Android TV** | **Launch-ready** | Foundational Theater Hub | 5-Column Grid Layout & Focus-Trapping Guards | "Your personal cinematic wall of art. Zero phantom clicks." |
| **Web App** | **Launch-ready** | High-Velocity Curation Engine | Infinite scrolling, instant canvas mapping | "Effortless desktop lookup. Build your night's lineup instantly." |
| **iOS Mobile** | **Handset launch TBD** | Premium Pocket Companion | Swipe gestures, clean system haptic flow | "Prestige control. Curate on the move, watch on the big screen." |
| **Android Mobile**| **Handset launch TBD** | Agile Accessibility Engine | Fast Material-derived layout, deep caching | "Instant pocket access. Your media library, always in perfect sync." |

---

## 3. Visual Identity & Cinematic Brand Aesthetics

Agents driving asset generation (Midjourney, Runway, Stable Diffusion), social templates, or promotional video mockups must strictly lock formatting choices to the following aesthetic rules:

* **Design Language:** "Hollywood Premium." Immersive, high-contrast dark modes dominated by obsidian and midnight tones (`#0b0d13`, `#07080d`).
* **Visual Accents:** Precision sonar-style lines, glowing bioluminescent elements, soft anamorphic flares, and sharp geometric structures.
* **Cinematic Framing:** Promotional display videos must utilize premium cinematic widescreen aspect ratios (**2.39:1** anamorphic widescreen style) over generic modern software presentation squares.
* **Explicit Exclusions:** Bright corporate pastel gradients, flat vector characters, uninspired SaaS dashboard mockups, and cluttered grid interfaces.

---

## 4. Brand Voice & Editorial Guidelines

The brand voice must completely bypass traditional corporate software hyperbole. ReelDive talks like a prestigious film archive or an advanced cinematic director—never like a sales-driven tech startup.

* **Do Use:** *Cinematic Canvas, Universal Discovery, Theater-Grade, Curated Library, Fluid Layout Grid, Curation Engine, Pocket Companion, Living Room Authority.*
* **Do Not Use:** *Disruptive, Game-changing, AI-powered assistant, Next-gen app, Content-broker, Paradigm-shift, Chat-bot, Sync-tool.*

---

## 5. Agent Mesh Architecture & Operational Protocols

To minimize memory drift and maximize coordination efficiency, external autonomous agents reading this file must store their direct processing instructions based on their assigned role:

### 1. The Archivist (Asset & Context Guardian)
* **Protocol:** Evaluates ongoing campaign copy blocks against past metrics to prevent platform drift. Validates that layout references match production standards—specifically checking that Android TV asset marketing showcases the signature **5-column** (**140×210**) spacing, and web assets reflect responsive **Discover** tiers—see **[Web ↔ TV parity & crossover](web-tv-parity.md)** before claiming parity or handset-only behaviors.

### 2. The Sentinel (Brand Safety & Compliance Gatekeeper)
* **Protocol:** Functions as a hard validation filter. Intercepts and completely blocks any incoming marketing output, automated update draft, or feature description that explicitly names or indirectly implies a customer-facing text chatbot.

### 3. Content Creation Engines (Copy, Layout, Video Prompts)
* **Protocol:** Ingests core positioning to execute fast, high-volume campaigns. Until handset launches are dated in this Bible, prioritize hooks that unite **desktop / browser ease** with **living-room theater delivery** (**Web + TV**); keep **mobile pocket** framing **aspirational** (roadmap pillar), not “available now on App Store / Play Store” unless Product confirms.

### 4. Evidence & clarification discipline (all roles)
* **Ground claims** in **`docs/`**, **`docs/marketing/FAQ.md`**, and **`HQ.md`**. If data needed for headlines, timelines, URLs, regulatory copy, CTAs, or pricing is **not** present—or conflicts between surfaces—**stop and request human clarification** before publishing. Relaxing Sentinel-class prohibitions requires **explicit human approval** documented in-repo.
