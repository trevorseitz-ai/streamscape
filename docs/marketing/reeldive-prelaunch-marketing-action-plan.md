# ReelDive — Pre-Launch Autonomous Marketing Action Plan

**Owner role:** Founder (solo, marketing capacity ≈ 3–4 h/day)
**Geo / language:** USA + Canada, English only
**Budget:** $0 freelance / contractor spend
**Posture:** Pre-launch. Web + Android TV are the launch-ready surfaces per `docs/depts/marketing.md`; iOS / Android handset storefronts are **TBD**.
**Countdown status:** **LOCKED.** `docs/depts/marketing.md` → `Announced ReelDive web / GA date` is **not populated**. No dated countdowns, "opens Friday" rhetoric, or phantom calendar claims anywhere in this plan.
**Watermark convention:** Every illustrative external-facing snippet in this document is tagged `NOT APPROVED` and gated by `Human approval = Y`.

---

## A — Executive overview

### A.1 Thesis (doc-supported only)

ReelDive is a **cinematic streaming discovery experience** that reduces "where is this streaming?" friction by unifying fragmented catalog and availability metadata behind a single, premium, lean-back-and-desktop UX (`docs/marketing/FAQ.md`, `docs/depts/marketing.md`). Two surfaces are launch-ready at product launch — **Android TV** (the Foundational Theater Hub: 5-column fixed grid, focus-trapping D-pad navigation) and **Web** (the High-Velocity Curation Engine: responsive Discover, instant canvas mapping) per `docs/depts/marketing.md` → Platform Matrix Specifications. Engineering parity (one Expo Router codebase, shared Supabase auth/profiles/watchlist/watched state, shared Stream Finder–ordered Discover with TMDB enrichment) is documented in `docs/depts/web-tv-parity.md` and `HQ.md` (~1,206 mirrored titles, 16 providers).

ReelDive is explicitly **not** a playback app for third-party catalogs and **not** a substitute for Netflix / Prime Video / Disney+ / Max subscriptions (`docs/marketing/FAQ.md`, `docs/depts/web-tv-parity.md` §4.3). Marketing copy must hold that line — every external artifact in this plan reinforces it.

### A.2 Differentiation we may claim (and only this, until docs say otherwise)

1. **Hollywood-premium design language** — obsidian/midnight palette (`#0b0d13`, `#07080d`), 2.39:1 cinematic framing for promo video, sonar/anamorphic visual accents (`docs/depts/marketing.md` §3). We can claim aesthetic distinctiveness vs. SaaS-dashboard competitors.
2. **Theater-grade lean-back UX on Android TV** — 140×210 posters, 5 columns, 20px gaps, zero phantom clicks (`docs/depts/marketing.md`, `docs/tv_layout_rules.md`).
3. **One account across living-room and desktop** — shared Supabase session, shared watchlist / watched / profile state across Web and TV (`docs/depts/web-tv-parity.md` §3).
4. **Discovery and availability cues backed by a synced mirror** — Stream Finder–ordered Discover + TMDB imagery, intersected against the user's enabled services (`docs/depts/web-tv-parity.md` §1, `docs/depts/web.md` "Profile & My services — auto-pruning").

We do **not** claim "watch everything in one app," "AI-powered assistant," same-day handset storefront launches, or any movie-ticket countdown — all forbidden by `docs/depts/marketing.md` voice rules and launch posture.

### A.3 KPI ladder + simplest $0 baseline measurement

| Rank  | KPI                                                                             | $0 instrumentation (until tooling is approved)                                                                                                                                |
| :---- | :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Waitlist sign-ups** (attributable, via `https://getreeldive.com` per `HQ.md`) | UTM-tagged links → weekly export from landing-repo waitlist store (whatever the v0-reel-dive-landing-page repo exposes — see §A.6 Clarifying questions) → Google Sheet rollup |
| **2** | **Qualified traffic** (US/CA, English, ≥30s session OR scrolled past hero)      | Landing host native analytics (Vercel Analytics is free on hobby) + UTM rollup in Sheet                                                                                       |
| **3** | **Social engagement** (saves + shares + comments; _not_ likes/impressions)      | Native platform dashboards (X, IG, TikTok, LinkedIn, Reddit, YouTube) → manual weekly tally in Sheet                                                                          |
| **4** | **Partner / press mentions** (escalating weight in months 2→3+)                 | Google Alerts (free) + Brand24 free trial / manual scrape → Sheet                                                                                                             |

The Sheet is the single source of truth for the **Marketing Monday digest** (B.1 rhythm). It mirrors the QA-digest pattern from `docs/depts/marketing-autonomous.md` §3 ("scheduled job + artifact + optional Resend") in the cheapest possible form — a manual cron-in-your-calendar at first, automated later if/when the founder approves a tool from §C.

### A.4 Constraints recap

- **Time:** ≈ 3–4 h/day, 5 days/week → **15–20 h/week** marketing capacity. Plan caps weekly ticket effort at **18 h** to leave slack for reactive work.
- **Geo:** USA + Canada, English only.
- **Budget:** $0 freelance. Every tool proposal in §C must have a freemium or zero-cost tier or be marked `human setup required` with cost transparency.
- **Approvals:** Every customer-visible artifact carries `Human approval = Y`. No campaign asset, email, ad, social caption, DM script, influencer/press draft, or landing copy ships without explicit founder sign-off recorded in the weekly digest.

### A.5 Risks + mitigations

| #   | Risk                                                                                                                                                                              | Likelihood | Mitigation                                                                                                                                                                                                             |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Inadvertent countdown / date claim** before `Announced ReelDive web / GA date` is populated                                                                                     | M          | Pre-publish lint: every draft is grep'd for words `launch`, `release`, `date`, `Friday`, `countdown`, `coming [month]`, `available [date]` before approval. Violations = block.                                        |
| R2  | **Playback / streamer-replacement overclaim**                                                                                                                                     | M          | All external copy includes the §4.3 boilerplate ("not a playback app, not a substitute, a discovery hub") or paraphrase. Founder review per artifact.                                                                  |
| R3  | **Sentinel violation** (someone — agent, copywriter template, or founder under deadline — pitches a "chatbot," "AI assistant," "help widget," "live chat" as a marketing surface) | L–M        | Sentinel pre-flight checklist (B.2 Ticket "Sentinel lint") + ban from copy templates. Mesh per `docs/depts/marketing.md` §5.2.                                                                                         |
| R4  | **Handset GTM bleed** — IG/TikTok creative implies "download on iOS/Android"                                                                                                      | M          | Creative briefs explicitly scope to Web + Android TV until Product/Marketing dates handset stores. iOS / Android pillars remain _aspirational_ per `docs/depts/marketing.md` §5.3 "Content Creation Engines" protocol. |
| R5  | **Forbidden vocabulary** ("disruptive", "game-changing", "AI-powered assistant", "next-gen", "content-broker", "paradigm-shift", "chat-bot", "sync-tool") slips in                | M          | Same lint pass as R1. Cinematic vocabulary substitution list maintained in `marketing-digest.json` (or Sheet tab).                                                                                                     |
| R6  | **Founder burnout** at 3–4 h/day                                                                                                                                                  | M–H        | Weekly capacity cap = 18 h. Anything >18 h either defers or moves to **Future-capacity** owner with justification.                                                                                                     |
| R7  | **FAQ drift** between `docs/marketing/FAQ.md` and live `getreeldive.com`                                                                                                          | M          | Weekly "FAQ parity check" ticket (W2 onward) — 15-min diff between in-repo draft and live mirror; PR back to whichever is stale.                                                                                       |
| R8  | **Tooling lock-in or hidden costs**                                                                                                                                               | M          | §C decision criteria require export of all data + freemium tier verification before adoption.                                                                                                                          |
| R9  | **Aggregator / competitor ToS exposure** when referencing "streaming availability" of named services in copy                                                                      | L–M        | Hew to language vetted in `docs/marketing/FAQ.md`. No screenshot of competitor UIs in creative.                                                                                                                        |
| R10 | **Hallucinated CTAs / URLs** (any URL beyond `https://getreeldive.com` and the landing repo URL until Marketing documents otherwise)                                              | M          | Founder explicitly approves every link in every artifact.                                                                                                                                                              |

### A.6 Clarifying questions for the human (gaps blocking full execution)

These are tagged because Knowledge does **not** answer them — they must be answered before the corresponding tickets unlock.

1. **Waitlist instrumentation** — Does the `v0-reel-dive-landing-page` repo currently capture UTM parameters and store them with waitlist signups? If not, is opening a PR to add UTM persistence in-scope for `Landing repo` owner (instructions-only)? _(Blocks: clean attribution per KPI 1.)_
2. **Email service** — Is there an ESP already wired to the landing repo's waitlist endpoint, or is the waitlist write-only with no outbound sequence today? _(Blocks: W4 confirmation email + W6 lifecycle nurture.)_
3. **Privacy / consent posture** — What lawful basis is asserted at signup (single opt-in, double opt-in, jurisdiction notes)? Is the privacy policy on `getreeldive.com` current for US + Canada (CASL)? _(Blocks: any email beyond a transactional confirmation.)_
4. **Founder social handles** — Are there existing brand handles on X, Instagram, TikTok, YouTube, Reddit, LinkedIn? If yes, which are claimed but dormant vs. active? _(Blocks: B.2 W1 channel inventory ticket.)_
5. **Press list / founder network** — Any existing relationships with cord-cutter / streaming-press writers (Cord Cutters News, The Streamable, Variety streaming desk, Decider, Engadget cord-cutting, Tom's Guide streaming) or YouTube/podcast hosts in the cord-cutting niche? _(Blocks: month-2 KPI-4 escalation.)_
6. **Beta / early-access pipeline** — Is there a documented mechanism to invite waitlist members into an Android TV / Web beta cohort before GA, or is the waitlist purely informational until announcement? _(Blocks: W6+ "early access" messaging — defaults to informational-only until confirmed.)_
7. **Visual asset library** — Are there approved screenshots / hero shots of Android TV Discover and Web Discover that meet the 2.39:1 / Hollywood-Premium aesthetic spec (`docs/depts/marketing.md` §3), or does creative need to source-capture them in-repo? _(Blocks: any organic social with first-party product visuals.)_
8. **Legal review** — Who reviews any external mention of named streamers (Netflix, Max, Disney+, Prime Video, etc.) for ToS-safe phrasing? _(Blocks: high-volume social posting if no reviewer is named.)_
9. **Analytics on landing** — Is Vercel Analytics, Plausible, GA4, or PostHog already deployed on `https://getreeldive.com`? _(Blocks: KPI 2 baseline.)_

Until each item is answered, downstream tickets are marked **`BLOCKED — clarification N`** in §B.

---

## B — Weekly operating rhythm (12 weeks, default)

**Week 1 anchor:** Foundation, instrumentation, and the first approval-gated public copy block.
**Weekly capacity ceiling:** 18 h. **Daily rhythm anchor:** Mon = plan + ship Monday digest; Tue–Thu = production (drafts, captures, posts); Fri = review + queue next week; weekend = catch-up only if energy allows (no scheduled work).

**KPI emphasis schedule (cumulative-mention escalation per the prompt):**

| Period             | KPI 1 weight | KPI 2 weight | KPI 3 weight | KPI 4 weight                      |
| :----------------- | :----------- | :----------- | :----------- | :-------------------------------- |
| Month 1 (W1–W4)    | 50%          | 25%          | 20%          | **5%** (network seeding only)     |
| Month 2 (W5–W8)    | 40%          | 25%          | 20%          | **15%** (warm pitches start)      |
| Month 3+ (W9–W12+) | 35%          | 25%          | 20%          | **20%** (active pitching cadence) |

### B.1 Daily / weekly rhythm

| Day         | Time   | Activity                                                                                                            |
| :---------- | :----- | :------------------------------------------------------------------------------------------------------------------ |
| **Mon**     | 30 min | Pull weekend numbers into Sheet. Write Marketing Monday digest (KPIs 1–4, anomalies, what shipped, what's blocked). |
| **Mon**     | 2 h    | Review approval queue from prior week → ship approved artifacts to scheduler / draft folder.                        |
| **Mon**     | 30 min | Week plan: pick 2–3 highest-leverage tickets from this week's block.                                                |
| **Tue**     | 2–3 h  | Production block A (drafting / capturing).                                                                          |
| **Wed**     | 2–3 h  | Production block B (drafting / capturing).                                                                          |
| **Thu**     | 2–3 h  | Production block C (drafting / engagement / outreach).                                                              |
| **Fri**     | 1–2 h  | Self-review against R1–R10 lint. Queue next week's drafts in approval folder.                                       |
| **Fri**     | 30 min | Light engagement: reply to comments/DMs that arrived during the week. Founder discretion only — no auto-responders. |
| **Sat–Sun** | 0 h    | Default off.                                                                                                        |

Total scheduled: **~14–18 h/week.**

### B.2 Ticket tables

**Owner key:** `Founder` = founder hands-on; `Docs PR (this repo)` = founder opens PR against `docs/` for review (no merge by Claude); `Landing repo` = instructions-only commit guidance against `https://github.com/trevorseitz-ai/v0-reel-dive-landing-page` (founder merges); `Future-capacity` = deferred at $0 / 3–4h budget — explained per ticket.

**Effort bands:** `XS` = ≤30 min · `S` = 30–90 min · `M` = 90 min–3 h · `L` = 3–6 h · `XL` = 6–12 h (rare; should be split).

---

#### **Week 1 — Foundation & instrumentation**

| ID    | Deliverable                                                                                                                                                                                                                            | KPI link | Owner                                                                                          | Effort | Depends on       | Approval (Y/N)                                                                      | Done definition                                                                                                                                             |
| :---- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------- | :----- | :--------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| W1-01 | **Marketing operations Sheet** — tabs for `weekly-digest`, `waitlist-rollup`, `traffic`, `social-tally`, `mentions`, `forbidden-words-lint`, `approval-log`                                                                            | 1,2,3,4  | Founder                                                                                        | S      | —                | N (internal)                                                                        | Sheet exists; all 7 tabs created; first row pre-filled with W0 baseline (zeros are fine)                                                                    |
| W1-02 | **Channel inventory** — confirm or claim brand handles (X, IG, TikTok, YouTube, Reddit, LinkedIn). Document in HQ-style sheet tab; do **not** post yet.                                                                                | 3        | Founder                                                                                        | S      | Clarification #4 | N (internal)                                                                        | All six platforms have a row: handle, status (claimed/active/dormant/missing), bio audit pending                                                            |
| W1-03 | **Forbidden-words lint list** — codify `Do Not Use` from `docs/depts/marketing.md` §4 + countdown verbs from R1 in a single Sheet tab.                                                                                                 | All      | Founder                                                                                        | XS     | —                | N (internal)                                                                        | Lint list visible; founder commits to running `Cmd+F` against every draft before approval                                                                   |
| W1-04 | **Sentinel pre-flight checklist** — one-page checklist: ❑ No chatbot/widget/AI assistant pitch ❑ No playback claim ❑ No streamer-replacement claim ❑ No handset storefront claim ❑ No dated countdown ❑ Cites only docs-approved facts | All      | Founder                                                                                        | XS     | —                | N (internal)                                                                        | Checklist exists in Sheet; copied into every approval-queue item                                                                                            |
| W1-05 | **UTM convention doc** — `utm_source=<platform>`, `utm_medium=<organic                                                                                                                                                                 | email    | press>`, `utm_campaign=prelaunch-w<weeknum>-<topic>`, `utm_content=<asset-id>`. Internal only. | 1,2    | Founder          | XS                                                                                  | —                                                                                                                                                           | N (internal) | One-pager committed (or pinned in Sheet); every link template uses this from W2 onward |
| W1-06 | **Audit live `getreeldive.com`** vs. `docs/marketing/FAQ.md` and `docs/depts/marketing.md` — diff list of mismatches (FAQ text, hero copy, CTA labels). No edits yet — just findings.                                                  | 1,2      | Founder                                                                                        | M      | Knowledge        | N (internal; **human review advised** — findings may surface customer-facing fixes) | Diff written into `docs/marketing/FAQ-parity-audit-W1.md` PR (Docs PR owner: founder). Approval gate applies _to the eventual fixes_, not the audit itself. |
| W1-07 | **Landing analytics confirmation** — verify whether Vercel Analytics / Plausible / GA4 / PostHog runs on the live site (per Clarification #9); document; if none, propose adding Vercel Analytics (free) as a §C decision.             | 1,2      | Founder + Landing repo (instructions only)                                                     | S      | Clarification #9 | N (internal); becomes Y if landing change ships                                     | Confirmation captured in Sheet; if action required, ticket W2 `BLOCKED — clarification 9`                                                                   |
| W1-08 | **Founder POV draft #1 — internal only** — 600-word "Why I built ReelDive" essay grounded in problem framing from `docs/marketing/FAQ.md`. **Internal draft only this week**; queued for W2 approval.                                  | 3,4      | Founder                                                                                        | M      | W1-03,W1-04      | Y (will publish W2 if approved)                                                     | Draft saved in `drafts/` folder; watermarked `NOT APPROVED`; passes Sentinel + lint                                                                         |
| W1-09 | **Visual asset audit** — list of needed assets (Web Discover screenshot at desktop bucket; TV Discover capture mirroring 5×5 grid; obsidian-palette hero variants). No production yet.                                                 | 3        | Founder                                                                                        | S      | Clarification #7 | N (internal)                                                                        | List exists; flagged items routed to Product for first-party capture                                                                                        |
| W1-10 | **Sentinel-class review of this plan** — founder reads sections A–D end-to-end against `marketing.md` §5.2, signs off in `approval-log`.                                                                                               | All      | Founder                                                                                        | S      | —                | N (internal sign-off)                                                               | `approval-log` row: "Pre-launch plan W1–W12 reviewed against Sentinel mesh; approved YYYY-MM-DD"                                                            |

**W1 capacity:** ~10 h. Slack for unanticipated audit findings.

---

#### **Week 2 — First public copy + organic seeding**

| ID    | Deliverable                                                                                                                                                                                                                                | KPI link | Owner                                      | Effort | Depends on       | Approval (Y/N)                                            | Done definition                                                                                               |
| :---- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------------------------------- | :----- | :--------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| W2-01 | **W1-06 FAQ-parity fixes** — open PRs against `docs/marketing/FAQ.md` (main repo first) **and** the landing repo for any drift identified. Founder merges.                                                                                 | 1,2      | Docs PR + Landing repo (instructions only) | M      | W1-06            | Y                                                         | Both PRs opened with parity-fixed copy; watermark `NOT APPROVED` removed only on merge                        |
| W2-02 | **Approve / revise / kill W1-08 founder POV essay**; if approved, publish on founder's choice of personal blog or Medium (no paid), cross-post stub to LinkedIn + X thread (5–8 tweets).                                                   | 1,3      | Founder                                    | M      | W1-08            | Y                                                         | Post live; UTM'd `/getreeldive.com/?utm_source=<platform>&utm_campaign=prelaunch-w2-founder-pov`              |
| W2-03 | **Cinematic vocabulary house** — 12 sanctioned phrases per `marketing.md` §4 Do-Use list, mapped to typical hooks (problem, solution, expectation-setting, CTA). Internal style guide.                                                     | 3        | Founder                                    | S      | —                | N (internal)                                              | Style sheet tab populated; every subsequent draft pulls from it                                               |
| W2-04 | **Social bio polish (all 6 platforms)** — single shared bio (≤160 chars where allowed), cinematic vocab, single CTA = `https://getreeldive.com`. No countdown language.                                                                    | 1,3      | Founder                                    | S      | W2-03            | Y (each platform = separate artifact)                     | Bios live on all claimed handles; approval log row per platform                                               |
| W2-05 | **Pinned post draft (×6 platforms, single message)** — one paragraph + product framing + waitlist CTA, watermark `NOT APPROVED` until founder approves per platform.                                                                       | 1,3      | Founder                                    | M      | W2-03,W2-04      | Y                                                         | All 6 pinned posts approved and live by EOW2                                                                  |
| W2-06 | **Subreddit reconnaissance** — list 8–12 candidate subs (r/cordcutters, r/AndroidTV, r/Plex, r/Streaming, r/movies, r/televisionsuggestions, r/cordcuttersnews — exact list founder-vetted). Read each sub's self-promo rules. No posting. | 2,3      | Founder                                    | M      | —                | N (internal); **human review advised** before any posting | Sheet tab `subreddit-rules` with per-sub: name, members, self-promo rule, "value-first" posting cadence       |
| W2-07 | **Press list seeding** — long-list 25 outlets/writers focused on cord-cutting, streaming, Android TV, FireTV, smart-home, "second-screen" UX. No outreach yet.                                                                             | 4        | Founder                                    | M      | Clarification #5 | N (internal)                                              | Sheet tab `press-targets` with name, outlet, beat, public contact (Twitter/site contact form), warm/cold flag |
| W2-08 | **Marketing Monday digest #1** (W1 results)                                                                                                                                                                                                | All      | Founder                                    | XS     | W1-01            | N (internal)                                              | Digest committed to Sheet `weekly-digest` tab; founder reads aloud (yes really) to surface anomalies          |

**W2 capacity:** ~14 h.

---

#### **Week 3 — Long-form anchor + first FAQ amplification**

| ID    | Deliverable                                                                                                                                                                                                                                | KPI link | Owner   | Effort | Depends on              | Approval (Y/N)                                                 | Done definition                                                                                                                                  |
| :---- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :---------------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| W3-01 | **Long-form anchor essay #1** — "Streaming fatigue is a navigation problem, not a content problem" (≈1,200 words; problem → honest expectations → waitlist CTA).                                                                           | 1,2,3    | Founder | L      | W2-02                   | Y                                                              | Drafted, lint-clean, Sentinel-clean, approved, published on founder's blog with UTM'd waitlist CTA. NOT APPROVED watermark stripped on approval. |
| W3-02 | **Twitter/X thread version of W3-01** (10–14 tweets), each linkable; final tweet is waitlist CTA.                                                                                                                                          | 1,3      | Founder | M      | W3-01                   | Y                                                              | Thread live; pinned for 7 days                                                                                                                   |
| W3-03 | **LinkedIn long-post version** of W3-01 (≤3,000 chars).                                                                                                                                                                                    | 1,3      | Founder | S      | W3-01                   | Y                                                              | Live with single CTA                                                                                                                             |
| W3-04 | **First Reddit value-post** (no link in body — link in flair/profile or comment per sub rule). One sub from W2-06 only — the most permissive.                                                                                              | 2,3      | Founder | M      | W2-06                   | Y                                                              | Posted; engagement monitored daily for 3 days                                                                                                    |
| W3-05 | **Visual capture pass #1** — Web Discover screenshot at desktop bucket (3/4/6 column tiers — pick the 6-col version), Android TV Discover capture (5 col / 140×210 / 20px gap per `docs/tv_layout_rules.md`). Save to `assets/marketing/`. | 3        | Founder | M      | W1-09, Clarification #7 | N (internal — capture); Y (when used in any external artifact) | Captures saved; meta noted; founder confirms aesthetic matches `marketing.md` §3 (obsidian palette, no clutter, no SaaS gradients)               |
| W3-06 | **FAQ amplification post (×1 platform — X)** — pick the single highest-impact FAQ from `docs/marketing/FAQ.md` ("Is ReelDive a playback app?") and publish a 6-tweet thread that paraphrases the in-repo answer + waitlist CTA.            | 1,3      | Founder | S      | W2-02                   | Y                                                              | Live; UTM'd; pinned-replaced if engagement justifies                                                                                             |
| W3-07 | **Marketing Monday digest #2**                                                                                                                                                                                                             | All      | Founder | XS     | —                       | N (internal)                                                   | Sheet row added                                                                                                                                  |

**W3 capacity:** ~15 h.

---

#### **Week 4 — Confirmation email + first newsletter draft (gated on clarifications)**

| ID    | Deliverable                                                                                                                                                                                                                                                | KPI link | Owner   | Effort | Depends on           | Approval (Y/N)                                                      | Done definition                                                                                                                                                                                     |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W4-01 | **Confirmation email v1** (transactional only; lawful-basis-clean). Subject: "You're on the ReelDive list." Body: 80–120 words; reiterates premium positioning, expectation-setting (not playback / not streamer replacement), one-tap unsubscribe footer. | 1        | Founder | M      | Clarification #2, #3 | Y                                                                   | Draft watermarked `NOT APPROVED`; if ESP exists (Clarification #2 = yes), wire and send to founder + 2 trusted test addresses; if no ESP, **`BLOCKED — clarification 2`** and queue for §C decision |
| W4-02 | **Long-form anchor essay #2** — "What a discovery hub does that a streamer can't" (positions ReelDive as orientation/decision layer; explicitly **not** a substitute for subscriptions).                                                                   | 1,2,3    | Founder | L      | W3-01                | Y                                                                   | Published; UTM'd; LinkedIn + X reframes follow                                                                                                                                                      |
| W4-03 | **YouTube short / TikTok / IG Reel #1** — 30–45s vertical capture of TV Discover navigation, 2.39:1-inspired letterbox bars, obsidian palette, voiceover or text-only. Caption: cinematic vocab + waitlist CTA.                                            | 3,1      | Founder | L      | W3-05                | Y                                                                   | Live on 1–3 platforms (founder picks based on existing reach); UTM'd link in bio                                                                                                                    |
| W4-04 | **Second Reddit value-post** — different sub from W3-04.                                                                                                                                                                                                   | 2,3      | Founder | M      | W3-04 outcome        | Y                                                                   | Posted; reviewed against W3-04 engagement learnings                                                                                                                                                 |
| W4-05 | **Press long-list → short-list** — cull W2-07's 25 to 10 highest-fit warm targets. Draft tracking columns for outreach (still no outreach this week).                                                                                                      | 4        | Founder | S      | W2-07                | N (internal)                                                        | Short-list in Sheet `press-targets` flagged `month-2-target`                                                                                                                                        |
| W4-06 | **Month-1 retrospective + month-2 plan**                                                                                                                                                                                                                   | All      | Founder | M      | —                    | N (internal); **human review advised** if plan revision is material | Retro lives in `weekly-digest`; KPI deltas + 3 things to keep, 1 thing to kill, 1 thing to test                                                                                                     |
| W4-07 | **Marketing Monday digest #3**                                                                                                                                                                                                                             | All      | Founder | XS     | —                    | N (internal)                                                        | Sheet row                                                                                                                                                                                           |

**W4 capacity:** ~15 h.

---

#### **Week 5 — KPI 4 ramp begins; first warm press touch**

| ID    | Deliverable                                                                                                                                                                                                                                       | KPI link | Owner   | Effort | Depends on              | Approval (Y/N)                                   | Done definition                                                        |
| :---- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------- | :------ | :----- | :---------------------- | :----------------------------------------------- | :--------------------------------------------------------------------- |
| W5-01 | **Press warm-touch round 1 (×3 contacts)** — _not_ a pitch. A "following your work, here's what we're building, happy to share more when relevant" intro DM/email. Strictly no countdown, no dated promises. Cites only doc-approved facts.       | 4        | Founder | M      | W4-05, Clarification #5 | Y (per-message; founder must approve every send) | 3 messages sent; logged in `press-targets` with date + response status |
| W5-02 | **Long-form anchor essay #3** — "Why we built ReelDive for the TV first, then the desktop" (cites `docs/depts/marketing.md` matrix; explicit handset-TBD framing).                                                                                | 1,2,3    | Founder | L      | W4-02                   | Y                                                | Published; cross-posted to X + LinkedIn                                |
| W5-03 | **Visual asset capture pass #2** — Web Discover + TV Discover with same title hero (continuity across surfaces). Used in W6 carousel post.                                                                                                        | 3        | Founder | M      | W3-05                   | N (internal capture); Y (any external use)       | Captures saved                                                         |
| W5-04 | **IG / X carousel post draft** — 5-card carousel: (1) problem, (2) "discovery, not playback" framing, (3) TV surface visual, (4) Web surface visual, (5) waitlist CTA.                                                                            | 1,3      | Founder | M      | W5-03                   | Y                                                | Approved and queued for W6 publish                                     |
| W5-05 | **Reddit value-post #3** — third sub.                                                                                                                                                                                                             | 2,3      | Founder | M      | W4-04 outcome           | Y                                                | Posted                                                                 |
| W5-06 | **Newsletter cadence proposal** — Sheet doc: if Clarification #2 resolves favorably, propose a monthly (not weekly) "ReelDive Dispatch" cadence: theme = recent essay + one curated cord-cutting industry note + waitlist CTA. **Proposal only.** | 1        | Founder | S      | Clarification #2        | N (internal proposal); Y (any draft body)        | Proposal in Sheet `digest` tab; founder green-lights cadence           |
| W5-07 | **Marketing Monday digest #4**                                                                                                                                                                                                                    | All      | Founder | XS     | —                       | N (internal)                                     | Sheet row                                                              |

**W5 capacity:** ~14 h.

---

#### **Week 6 — Carousel publish + first cohort early-access exploration**

| ID    | Deliverable                                                                                                                                                                                            | KPI link | Owner   | Effort | Depends on       | Approval (Y/N)                                               | Done definition                                                                                                            |
| :---- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :--------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| W6-01 | **Publish W5-04 carousel** on IG + LinkedIn (image-friendly platforms).                                                                                                                                | 1,3      | Founder | S      | W5-04            | Y (already approved)                                         | Live; UTM'd link in bio / first comment                                                                                    |
| W6-02 | **Early-access concept memo** — internal only; explores whether and how an Android TV closed beta cohort could be sourced from waitlist signups, **assuming Product green-lights** (Clarification #6). | 1        | Founder | M      | Clarification #6 | N (internal memo); Y (if any external communication results) | Memo committed to `docs/marketing/early-access-concept.md` PR; product/founder review required before any external mention |
| W6-03 | **Long-form anchor essay #4** — "What ReelDive doesn't do (and why that's the point)" — explicitly leans into the §4.3 boilerplate.                                                                    | 1,2,3    | Founder | L      | W5-02            | Y                                                            | Published; X + LinkedIn variants follow                                                                                    |
| W6-04 | **Press warm-touch round 2 (×3 contacts)**                                                                                                                                                             | 4        | Founder | M      | W5-01 outcome    | Y                                                            | Sent; logged                                                                                                               |
| W6-05 | **YouTube short / Reel #2** — Web Discover scroll demo, cinematic framing, voiceover.                                                                                                                  | 1,3      | Founder | L      | W4-03 retro      | Y                                                            | Published; UTM'd                                                                                                           |
| W6-06 | **Subreddit AMA candidacy probe** — DM 2 mod teams of relevant subs to ask _if and when_ a founder AMA might be welcome (not asking for one).                                                          | 4,3      | Founder | S      | W2-06            | Y (each message)                                             | Messages sent; logged                                                                                                      |
| W6-07 | **Marketing Monday digest #5**                                                                                                                                                                         | All      | Founder | XS     | —                | N (internal)                                                 | Sheet row                                                                                                                  |

**W6 capacity:** ~16 h.

---

#### **Week 7 — Mid-quarter creative refresh + press push**

| ID    | Deliverable                                                                                                                                                                                                      | KPI link | Owner             | Effort | Depends on                                         | Approval (Y/N) | Done definition                                                                                                                              |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :---------------- | :----- | :------------------------------------------------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| W7-01 | **Creative refresh** — review M1–M2 best-performing post; produce 2 derivatives (different hook, same evidence).                                                                                                 | 1,3      | Founder           | M      | W6 retro                                           | Y (each)       | 2 variants approved and queued                                                                                                               |
| W7-02 | **Press warm-touch round 3 (×4 contacts)** — escalation to short-list remainder.                                                                                                                                 | 4        | Founder           | M      | W6-04                                              | Y (each)       | 4 messages sent; logged                                                                                                                      |
| W7-03 | **First "pitch-ready" press one-pager (NOT a press release)** — 1 page: what ReelDive is, what it's not, who it's for (US/CA cord-cutters), Web + TV launch posture (handsets TBD), no dates, contact = founder. | 4        | Founder + Docs PR | M      | `docs/depts/marketing.md`, `docs/marketing/FAQ.md` | Y              | One-pager committed to `docs/marketing/press-one-pager.md` PR; watermark `NOT APPROVED` until founder signs off; never sent without approval |
| W7-04 | **Long-form anchor essay #5** — guest-post pitch version (target: 1 cord-cutter outlet from press list).                                                                                                         | 1,4      | Founder           | L      | W4-02, W5-02                                       | Y              | Pitched to 1–2 outlets with W7-03 attached                                                                                                   |
| W7-05 | **Reddit value-post #4**                                                                                                                                                                                         | 2,3      | Founder           | M      | W5-05 outcome                                      | Y              | Posted                                                                                                                                       |
| W7-06 | **Marketing Monday digest #6**                                                                                                                                                                                   | All      | Founder           | XS     | —                                                  | N (internal)   | Sheet row                                                                                                                                    |

**W7 capacity:** ~16 h.

---

#### **Week 8 — Month-2 retrospective + month-3 plan**

| ID    | Deliverable                                                                                                                                                      | KPI link | Owner   | Effort | Depends on                 | Approval (Y/N)                                                    | Done definition                                                                    |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :------------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| W8-01 | **Newsletter Issue #1 draft** (if Clarifications #2 + #3 resolved; otherwise BLOCKED) — 250–400 words, monthly cadence.                                          | 1        | Founder | M      | Clarification #2,#3; W5-06 | Y                                                                 | Draft watermarked `NOT APPROVED`; if approved and ESP wired, scheduled for W9 send |
| W8-02 | **Visual asset capture pass #3** — both surfaces, new title; refresh hero stockpile.                                                                             | 3        | Founder | M      | W5-03                      | N (internal); Y (external use)                                    | Captures saved                                                                     |
| W8-03 | **Cross-surface story post** — "Same account, same library, your TV and your laptop know each other" — cites `docs/depts/web-tv-parity.md` §3 shared user state. | 1,3      | Founder | M      | W8-02                      | Y                                                                 | Published; UTM'd                                                                   |
| W8-04 | **Press warm-touch round 4** + **first true pitch** to 1–2 most-responsive contacts (with W7-03 one-pager).                                                      | 4        | Founder | M      | W7-02 outcomes             | Y (each send)                                                     | Sent; logged                                                                       |
| W8-05 | **Month-2 retrospective + month-3 plan**                                                                                                                         | All      | Founder | M      | —                          | N (internal); **human review advised** for any plan shape changes | Retro in `weekly-digest`; M3+ KPI 4 weight increased per the schedule              |
| W8-06 | **Marketing Monday digest #7**                                                                                                                                   | All      | Founder | XS     | —                          | N (internal)                                                      | Sheet row                                                                          |

**W8 capacity:** ~13 h.

---

#### **Week 9 — Newsletter Issue #1 + community ground**

| ID    | Deliverable                                                                                                                                                                                                      | KPI link | Owner   | Effort | Depends on    | Approval (Y/N)       | Done definition                    |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :------------ | :------------------- | :--------------------------------- |
| W9-01 | **Newsletter Issue #1 send** (if W8-01 approved).                                                                                                                                                                | 1        | Founder | S      | W8-01         | Y (already approved) | Sent; open / click stored in Sheet |
| W9-02 | **Reddit value-post #5**                                                                                                                                                                                         | 2,3      | Founder | M      | W7-05 outcome | Y                    | Posted                             |
| W9-03 | **Long-form anchor essay #6** — "How we think about availability when streamers shuffle catalogs" — references the auto-pruning behavior (`docs/depts/web.md` "Profile & My services") at a non-technical level. | 1,2      | Founder | L      | W6-03         | Y                    | Published; cross-posted            |
| W9-04 | **YouTube short / Reel #3** — focus on the cross-device "same account" idea.                                                                                                                                     | 1,3      | Founder | L      | W8-02         | Y                    | Live                               |
| W9-05 | **Press follow-ups** — gentle bumps on any W8-04 pitches that haven't responded after 7 business days.                                                                                                           | 4        | Founder | S      | W8-04         | Y (each)             | Sent; logged                       |
| W9-06 | **Marketing Monday digest #8**                                                                                                                                                                                   | All      | Founder | XS     | —             | N (internal)         | Sheet row                          |

**W9 capacity:** ~14 h.

---

#### **Week 10 — Partner / podcast probes**

| ID     | Deliverable                                                                                                                                                                   | KPI link | Owner   | Effort | Depends on                    | Approval (Y/N)                 | Done definition                                                  |
| :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :---------------------------- | :----------------------------- | :--------------------------------------------------------------- |
| W10-01 | **Podcast target list** — 12–15 cord-cutting / smart-home / streaming podcasts (US/CA, English).                                                                              | 4        | Founder | M      | —                             | N (internal)                   | Sheet tab `podcast-targets`                                      |
| W10-02 | **Podcast warm-touches (×4)** — listener-first DMs/emails to hosts; same rules as press.                                                                                      | 4        | Founder | M      | W10-01                        | Y (each)                       | Sent; logged                                                     |
| W10-03 | **Repurpose top essay into pitch-able podcast topic ideas (×3)**                                                                                                              | 4        | Founder | S      | W3-01,W4-02,W5-02,W6-03,W9-03 | N (internal until used)        | Topic memo in Sheet                                              |
| W10-04 | **Reddit AMA decision** — based on W6-06 mod responses, decide whether to pursue an AMA; if yes, schedule for M4+, **not in this 12-wk plan window unless mods green-light**. | 4,3      | Founder | S      | W6-06                         | Y (if any AMA action is taken) | Decision logged; AMA itself is `Future-capacity` unless approved |
| W10-05 | **Long-form anchor essay #7** — "Designing for the couch and the keyboard" (lean-back vs. lean-in UX).                                                                        | 1,2      | Founder | L      | W9-03                         | Y                              | Published                                                        |
| W10-06 | **Marketing Monday digest #9**                                                                                                                                                | All      | Founder | XS     | —                             | N (internal)                   | Sheet row                                                        |

**W10 capacity:** ~14 h.

---

#### **Week 11 — Creative double-down on best-performing format**

| ID     | Deliverable                                                                                                                                                                             | KPI link | Owner   | Effort | Depends on         | Approval (Y/N)                         | Done definition                                                |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :----------------- | :------------------------------------- | :------------------------------------------------------------- |
| W11-01 | **Format winner identification** — review M1–M2.5 KPI 1 and KPI 3 data; identify 1 format (e.g. carousel, short, long-form, X-thread) that drove disproportionate waitlist attribution. | 1,3      | Founder | M      | W8-05, W9–W10 data | N (internal); **human review advised** | Sheet row identifies winner with attribution math (UTM counts) |
| W11-02 | **Produce 2 new pieces in the winning format**                                                                                                                                          | 1,3      | Founder | L      | W11-01             | Y (each)                               | Drafted, approved, queued                                      |
| W11-03 | **Press follow-ups round 2**                                                                                                                                                            | 4        | Founder | S      | W9-05              | Y (each)                               | Sent                                                           |
| W11-04 | **Podcast follow-ups**                                                                                                                                                                  | 4        | Founder | S      | W10-02             | Y (each)                               | Sent                                                           |
| W11-05 | **Reddit value-post #6**                                                                                                                                                                | 2,3      | Founder | M      | W9-02 outcome      | Y                                      | Posted                                                         |
| W11-06 | **Marketing Monday digest #10**                                                                                                                                                         | All      | Founder | XS     | —                  | N (internal)                           | Sheet row                                                      |

**W11 capacity:** ~14 h.

---

#### **Week 12 — Quarter close + month-4 plan + countdown-readiness audit**

| ID     | Deliverable                                                                                                                                                                                                                                                                                            | KPI link | Owner   | Effort | Depends on    | Approval (Y/N)                                   | Done definition                                                     |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ | :----- | :------------ | :----------------------------------------------- | :------------------------------------------------------------------ |
| W12-01 | **Publish W11-02 pieces**                                                                                                                                                                                                                                                                              | 1,3      | Founder | S      | W11-02        | Y (already approved)                             | Live                                                                |
| W12-02 | **Newsletter Issue #2 send** (if approved)                                                                                                                                                                                                                                                             | 1        | Founder | M      | W9-01 cadence | Y                                                | Sent                                                                |
| W12-03 | **Quarter retrospective** — KPI 1–4 deltas vs. baseline, channel attribution, format learnings, press/podcast pipeline snapshot.                                                                                                                                                                       | All      | Founder | L      | —             | N (internal); **human review advised**           | Retro committed to `docs/marketing/retro-Q1-prelaunch.md` PR        |
| W12-04 | **Countdown-readiness audit** — verify §D checklist is **inactive but ready** (assets, copy variants, channel slots). Re-confirm `Announced ReelDive web / GA date` is still `none documented` in `docs/depts/marketing.md`. If a date appears between now and Q-close, halt this plan and trigger §D. | 1,2,3    | Founder | M      | §D            | N (internal); Y (anything §D produces)           | Audit row in Sheet; §D items remain `INACTIVE — date not announced` |
| W12-05 | **Month-4 plan** — three options drafted: (a) double down on top format/channel, (b) start handset-aspirational creative _only after_ `docs/depts/marketing.md` updates handset posture, (c) shift KPI 4 weight further toward partners (podcasts, newsletters, niche outlets).                        | All      | Founder | M      | W12-03        | N (proposal); Y (anything that becomes external) | Plan in Sheet; founder picks one                                    |
| W12-06 | **Marketing Monday digest #11**                                                                                                                                                                                                                                                                        | All      | Founder | XS     | —             | N (internal)                                     | Sheet row                                                           |

**W12 capacity:** ~14 h.

---

### B.3 Cross-week recurring tickets (not re-listed above)

| ID   | Recurring deliverable                                                | Cadence                    | KPI link | Approval                        |
| :--- | :------------------------------------------------------------------- | :------------------------- | :------- | :------------------------------ |
| R-01 | Marketing Monday digest                                              | Weekly                     | All      | N (internal)                    |
| R-02 | FAQ parity check (docs ↔ live site)                                  | Weekly                     | 1,2      | Y (any fix that ships)          |
| R-03 | Forbidden-words + Sentinel + R1 (countdown) lint pass on every draft | Per artifact               | All      | Hard prerequisite to Y approval |
| R-04 | Comment/DM triage (founder discretion; no auto-responders)           | Twice weekly, ≤30 min each | 3        | Y for any non-trivial reply     |
| R-05 | Mention monitoring (Google Alerts + manual)                          | Weekly                     | 4        | N (internal)                    |
| R-06 | Spreadsheet rollup → digest                                          | Monday morning             | All      | N (internal)                    |

---

## C — Stack & infra options (human-owned)

All comparisons emphasize **freemium / zero-cost tiers**. **Nothing here is "already subscribed"** — every adoption is a `Decision placeholder` for the founder. Where the prompt forbids implying current subscriptions, none of these tools is assumed live unless the founder confirms in writing.

**Security posture across all tables:** Per `docs/depts/marketing-autonomous.md` §3 and the broader `.env.example` doctrine in onboarding, **no marketing tool keys ever ship inside the Expo app bundle.** ESP keys, scheduler tokens, analytics admin keys live in the landing repo's environment (or a CI / serverless function), referenced by name only. The Expo app may carry `EXPO_PUBLIC_*` analytics IDs _only_ if those IDs are public-by-design (e.g. Plausible site identifier, Vercel Analytics auto-injection).

### C.1 Email service provider (ESP)

`Decision placeholder` — founder picks one or none.

| Tool           | Free tier (US/CA-friendly)                         | Setup effort (solo)                         | Strengths                                                                                                      | Weaknesses                                                              | Security note                    |
| :------------- | :------------------------------------------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- | :------------------------------- |
| **Loops**      | 1,000 contacts free; transactional + broadcast     | Low (waitlist webhook → Loops audience)     | Cinematic-clean defaults; one-click unsubs; suits low cadence                                                  | Smaller deliverability track record vs. incumbents                      | API key in landing repo env only |
| **Resend**     | 3,000 emails/mo, 100/day free; transactional-first | Low–Medium (templates are React components) | Same Resend pattern is already referenced in `docs/depts/qa.md` for QA digest emails — operational familiarity | Broadcast features less mature than marketing-first ESPs                | API key in landing repo env only |
| **Buttondown** | Free up to 100 subs (then paid); newsletter-first  | Low                                         | Privacy-respecting; minimalist; suits a monthly Dispatch                                                       | Tight free cap; will need upgrade past 100                              | API key in landing repo env only |
| **MailerLite** | Up to 1,000 subs + 12,000 emails/mo free           | Medium                                      | Visual builder; automation flows                                                                               | More features = more brand-drift risk (need stricter template lockdown) | Key in landing repo env only     |
| **Mailchimp**  | Up to 500 contacts free                            | Medium                                      | Most-recognized; broad integrations                                                                            | Pricier as list grows; brand voice tends to leak corporate-SaaS         | Key in landing repo env only     |

**Founder decision criteria:**

1. Is the waitlist store (per Clarification #2) already integrable with one of these? Pick that one.
2. Cadence ≤ 1/month → Buttondown or Loops. Cadence > 1/month → MailerLite or Resend.
3. Strong preference for an ESP whose default templates do **not** force SaaS-gradient aesthetics (`docs/depts/marketing.md` §3 explicit exclusions).

**Human setup required.** Not implied as adopted.

### C.2 Landing-site analytics (KPI 1, 2)

`Decision placeholder.`

| Tool                 | Free tier                                    | Setup                | Strengths                                                                   | Weaknesses                                                                | Security note                                               |
| :------------------- | :------------------------------------------- | :------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------ | :---------------------------------------------------------- |
| **Vercel Analytics** | Free on Hobby plan (if landing is on Vercel) | Trivial (one toggle) | Zero-config; privacy-respecting; no cookie banner needed in most cases      | Vercel-host coupled                                                       | No keys                                                     |
| **Plausible**        | 30-day free trial; paid after                | Low                  | Single script tag; privacy-friendly; lightweight                            | Not free long-term                                                        | Site-key public-by-design                                   |
| **PostHog**          | Free up to 1M events/mo                      | Medium               | Funnels, session replay, feature flags — overkill for pre-launch but scales | Heavier instrumentation = brand-drift risk                                | API key public-by-design for client SDK; server keys in env |
| **GA4**              | Free                                         | Medium–High          | Industry default; ad-platform interop later                                 | Cookie banner / consent compliance burden in CA jurisdictions; complexity | No secret keys                                              |

**Founder decision criteria:**

1. If landing is on Vercel → Vercel Analytics is the $0, lowest-friction default.
2. Avoid GA4 unless paid-channel attribution becomes a near-term priority — its consent burden costs solo-founder time.

**Human setup required.**

### C.3 Social scheduling (optional)

`Decision placeholder.` Founder may choose to post natively (zero tooling) for the first 12 weeks.

| Tool                                                                                                    | Free tier                                    | Setup | Strengths                                      | Weaknesses                              |
| :------------------------------------------------------------------------------------------------------ | :------------------------------------------- | :---- | :--------------------------------------------- | :-------------------------------------- |
| **Native dashboards** (Meta Business Suite, X composer, LinkedIn native, TikTok native, YouTube Studio) | Free                                         | None  | Zero learning curve; no third-party token risk | Manual; no cross-platform calendar view |
| **Buffer**                                                                                              | Free for 3 channels, 10 scheduled posts each | Low   | Calendar view; clean approval gate             | Free cap is tight for 6 platforms       |
| **Typefully**                                                                                           | Free tier for X-focused threads              | Low   | Excellent thread UX                            | X-centric                               |
| **Hootsuite Free**                                                                                      | Discontinued/limited                         | —     | —                                              | Mostly retired the free tier            |
| **Publer**                                                                                              | Free for 3 social accounts                   | Low   | Solid calendar                                 | Cap at 3 accounts                       |

**Founder decision criteria:**

1. For the first 12 weeks, native posting + a Sheet calendar is sufficient at this volume.
2. Adopt a scheduler only when weekly post count exceeds ~10 distinct artifacts.

**Human setup required.**

### C.4 Automation glue (Sheet ↔ ESP ↔ analytics)

`Decision placeholder.` Not needed until KPI volume justifies it.

| Tool                | Free tier                 | Setup      | Strengths                                              | Weaknesses       |
| :------------------ | :------------------------ | :--------- | :----------------------------------------------------- | :--------------- |
| **Zapier Free**     | 100 tasks/mo, 5 zaps      | Low        | Largest connector library                              | Free cap small   |
| **Make Free**       | 1,000 ops/mo              | Low–Medium | More ops per task than Zapier                          | Steeper UX       |
| **n8n (self-host)** | Free if self-hosted       | High       | Total control                                          | Founder ops cost |
| **GitHub Actions**  | 2,000 min/mo on free plan | Medium     | Already in stack (per `docs/depts/qa.md` cron pattern) | Code-first       |

**Founder decision criteria:**

1. **Mirror the QA pattern from `docs/depts/marketing-autonomous.md` §3** — when this layer turns on, prefer a scheduled GitHub Action writing to `marketing-digest.json` (or a Sheet row) over Zapier/Make. It reuses existing secret hygiene and audit logs.

**Human setup required.**

### C.5 Mention monitoring (KPI 4)

| Tool              | Free              | Setup   | Strengths                          | Weaknesses             |
| :---------------- | :---------------- | :------ | :--------------------------------- | :--------------------- |
| **Google Alerts** | Yes               | Trivial | Free + reliable for press mentions | Slow / lossy on social |
| **Brand24**       | 14-day free trial | Low     | Aggregates social + press          | Paid after trial       |
| **Mention.com**   | Free trial        | Low     | Similar                            | Paid after trial       |

**Founder decision criteria:** Google Alerts is the $0 default. Trials are only worth running once a press-mention baseline exists (M2+).

**Human setup required.**

---

## D — Countdown-ready package (INACTIVE until `Announced ReelDive web / GA date` is populated in `docs/depts/marketing.md`)

> ⚠️ **GATE.** Every item in §D remains **`INACTIVE — date not announced`** until `docs/depts/marketing.md` → `Announced ReelDive web / GA date (Marketing-owned)` is filled with an explicit ISO date or "Coming [season/year]" line. Per `docs/depts/web.md` and `docs/marketing/FAQ.md`, the hosted web app may show a countdown only **after** Marketing documents the date there **and** mirrored campaigns are approved. **All §D items are also `FOUNDER_APPROVAL_REQUIRED`** when activated.

### D.1 Surface-by-surface countdown activation checklist

| #   | Surface                                              | Trigger                                                     | Activation action                                                                                                                                                                                                           | Approval                                  |
| :-- | :--------------------------------------------------- | :---------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| D1  | **`docs/depts/marketing.md`**                        | Marketing fills the dated line                              | Update bibles + flag the date in Sheet `marketing-digest` tab                                                                                                                                                               | `FOUNDER_APPROVAL_REQUIRED`               |
| D2  | **`docs/marketing/FAQ.md`**                          | D1 done                                                     | Add dated answer to "When does ReelDive launch?" question; PR; merge after approval; mirror to `getreeldive.com` per FAQ dual-stewardship                                                                                   | `FOUNDER_APPROVAL_REQUIRED`               |
| D3  | **`getreeldive.com` landing (waitlist repo)**        | D2 done                                                     | Instructions-only ticket to landing repo: add countdown component above-the-fold; "movie-ticket" framing per `docs/depts/marketing.md` §1 ship-date section                                                                 | `FOUNDER_APPROVAL_REQUIRED`               |
| D4  | **Hosted web app shell**                             | D1 done                                                     | Per `docs/depts/web.md` "Pre-general-availability web" — release countdown may be added to the hosted bundle. Implementation in-repo (shell route / gate / env flag).                                                       | `FOUNDER_APPROVAL_REQUIRED`               |
| D5  | **Email — date-reveal broadcast**                    | D1 + ESP wired (C.1)                                        | Single broadcast to existing waitlist: date reveal, expectation reset, what to expect on day-of (still Web + TV only unless handset posture also updates)                                                                   | `FOUNDER_APPROVAL_REQUIRED`               |
| D6  | **Social — date-reveal posts (×6 platforms)**        | D1 done                                                     | Carousel + thread + short variants; each platform gets a tailored cut                                                                                                                                                       | `FOUNDER_APPROVAL_REQUIRED` per platform  |
| D7  | **Press — embargo-aware notification (×short-list)** | D1 done + W7-03 one-pager refreshed with date               | Personal notes to warm press contacts; offer embargoed info if Product allows                                                                                                                                               | `FOUNDER_APPROVAL_REQUIRED` per recipient |
| D8  | **Long-form anchor essay — "The date" post**         | D1 done                                                     | Founder-voice essay; cinematic vocabulary; honest expectations restated; CTA = waitlist (still primary) + "save the date"                                                                                                   | `FOUNDER_APPROVAL_REQUIRED`               |
| D9  | **YouTube short / Reel — date-reveal video**         | D1 done + visual asset stockpile from B.2 W3-05/W5-03/W8-02 | 30–45s vertical; 2.39:1 framing; obsidian palette; date keystone                                                                                                                                                            | `FOUNDER_APPROVAL_REQUIRED`               |
| D10 | **Newsletter date-reveal issue**                     | D1 + ESP wired                                              | Monthly cadence broken to insert a one-off date-reveal issue                                                                                                                                                                | `FOUNDER_APPROVAL_REQUIRED`               |
| D11 | **Sheet — KPI weighting flip**                       | D1 done                                                     | KPI 1 stays primary, but KPI 2 (qualified traffic) and KPI 4 (press) gain weight in countdown window. Document new weights.                                                                                                 | N (internal; **human review advised**)    |
| D12 | **Handset-posture audit**                            | Concurrent with D1                                          | Re-read `docs/depts/marketing.md` Platform Matrix. **Only if** Marketing has also updated handset posture (iOS / Android storefronts) may external copy expand beyond Web + TV. If not, all D-items stay strictly Web + TV. | `FOUNDER_APPROVAL_REQUIRED`               |

### D.2 Pre-staged creative slots (built during B.2, sit dormant)

The following slots are built as **draft skeletons during B.2** so that activation is paste-the-date, not write-from-scratch:

- **Landing hero variant** — "Coming [DATE]" replaces "Coming soon"; built as a landing-repo branch sitting in PR draft.
- **Email subject lines (3 variants, A/B-ready)** — drafted, watermarked, sitting in `docs/marketing/countdown-email-drafts.md`.
- **Social-post copy bank (×6 platforms × 3 variants)** — drafted in Sheet `countdown-copy-bank` tab.
- **Press one-pager — dated version** — copy of W7-03 with `[DATE]` placeholder.
- **Founder essay outline** — section headers only; one paragraph each.

All slots carry `NOT APPROVED` watermark and `INACTIVE — date not announced` flag until D1.

### D.3 What `Announced ReelDive web / GA date` is **not**

To prevent over-eager activation:

- A `Coming soon` flag on `getreeldive.com` is **not** a date.
- An internal team estimate of "we think Q[X]" is **not** a date.
- Product readiness signals from `HQ.md` ("Phase 2: IN PROGRESS") are **not** a date.
- Anything below the literal line `Announced ReelDive web / GA date (Marketing-owned):` in `docs/depts/marketing.md` is **not** a date until that placeholder is replaced with an ISO date or explicit "Coming [season/year]" language **by Marketing**.

§D stays asleep until then.

---

## Appendix — Illustrative copy (all `NOT APPROVED`)

These snippets show **shape and tone**, not finished artifacts. Each goes through B.2 W1-03 / W1-04 / R-03 lint + founder approval before any external use.

### App-1 · Pinned X / IG / LinkedIn bio post (illustrative)

> `NOT APPROVED — illustrative`
> Cord-cutting was supposed to feel like freedom. It feels like tab-hopping.
>
> ReelDive is a discovery hub for streaming — a Cinematic Canvas that helps you decide what to watch tonight, then hands you off to the streamer that actually plays it. Not a player. Not a replacement for your subscriptions. A way to orient.
>
> Web and Android TV at launch. Join the list: getreeldive.com

Lint check: ✅ no countdown verb · ✅ no "AI-powered assistant" / "next-gen" / etc. · ✅ no playback claim · ✅ no streamer-replacement claim · ✅ no handset storefront claim · ✅ doc-supported vocabulary ("Cinematic Canvas", "discovery hub").

### App-2 · Confirmation email (illustrative; requires Clarification #2 + #3)

> `NOT APPROVED — illustrative — requires ESP + consent posture confirmed` > **Subject:** You're on the ReelDive list.
>
> Thanks for joining.
>
> ReelDive is a cinematic streaming discovery experience built for your living room (Android TV) and your desktop (Web) at launch. It's not a player, and it's not a replacement for the streaming services you already pay for — it's the layer that helps you decide, then hands you off.
>
> We'll write only when something's actually worth your inbox. You can leave the list anytime: [unsubscribe]
>
> — ReelDive

Lint check: ✅ all rules pass.

### App-3 · Reddit value-post stem (illustrative; W3-04 / W4-04 etc.)

> `NOT APPROVED — illustrative — must follow per-sub self-promo rules` > **Title:** What I want from "where to watch" that I don't get today
>
> Body: 250–400 words of honest problem framing (cord-cutter fatigue, catalog churn, per-app silos). Closing line: a question to the sub — _not_ a CTA. CTA, if allowed by sub rules, goes in profile bio or first comment.

Lint check: ✅ all rules pass; sub-specific rules verified before posting.

---

## Approval log header (Sheet `approval-log` tab schema)

| Date       | Artifact ID      | Surface | Lint pass (Y/N) | Sentinel pass (Y/N) | Countdown lint pass (Y/N) | Founder approval | Notes     |
| :--------- | :--------------- | :------ | :-------------- | :------------------ | :------------------------ | :--------------- | :-------- |
| YYYY-MM-DD | e.g. W2-05-X-bio | X       | Y               | Y                   | Y                         | Y / N            | Free text |

Every external artifact lands in this log before it ships. No log row, no ship.

---

**End of plan.** Run-of-document watermark: this plan is internal strategy; the only customer-facing items it contains are illustrative snippets in the Appendix, all `NOT APPROVED`. No external publishing of any artifact in this document occurs without an explicit row in the approval log signed by the founder.
