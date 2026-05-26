# Autonomous marketing — charter & blueprint

**Purpose:** Define what an **autonomous marketing capability** means for ReelDive, how it differs from **engineering automation** (QA digests, Maestro), and how to stand it up **without losing brand control**.

**Audience:** Founder / Growth lead integrating with Product (`docs/depts/product.md`), Web (`docs/depts/web.md`), and HQ (`HQ.md`).  
Canonical brand voice, **four-pillar** (four-surface) matrix, and agent guardrails: **`docs/depts/marketing.md`** (Marketing Bible). **Launch posture:** **Web** + **Android TV** at launch; **iOS / Android handset** storefront timing **TBD** until dated in **`marketing.md`** / Product. **Web × TV factual parity:** **`docs/depts/web-tv-parity.md`**.

---

## 1. Definition (narrow this first)

“Autonomous marketing” is **not** one dashboard. Pick one wedge **per quarter**:

| Wedge | What “autonomous” automates | Human still owns |
| :--- | :--- | :--- |
| **Lifecycle email** | Triggers + templates + sends from CRM / ESP | Tone, GDPR/consent, offer truth, unsub |
| **Organic social** | Draft queue, scheduling, UTM tagging | Narrative arcs, crises, influencer deals |
| **Programmatic landing / SEO** | Page generation from data (e.g. “where to watch X”) | Indexing strategy, canonical rules, spam risk |
| **Paid growth** | Creative variants, pacing, budget guards | Audience definition, economics, creative direction |
| **Analytics & narrative** | Nightly rollup → internal digest (like `report:qa` but for funnel) | What “good” means, budget decisions |

Avoid trying to automate **everything**—that produces silent brand drift.

---

## 2. Org shape (minimal “department”)

You get a **Marketing ops cell** faster than full headcount:

- **Marketing owner** (you): positioning, approvals, escalation.
- **Autonomy engineer** (part-time contractor or internal): APIs, Zapier/Make, Cron, dashboards—mirrors how **`scripts/generate-qa-report.ts`** owns QA automation.
- **Brand editor** (light): reviews templated outbound before widen blast (can be async Slack).

Treat **agents** as **staffers with job descriptions**: input sources, approval gates, forbidden phrases, escalation when confidence < threshold.

---

## 3. Control plane (three layers)

1. **Facts from Product** — What we ship, dates, screenshots, compliant claims (same bar as **`marketing.md`**).
2. **Execution layer** — ESP, Meta/Google, CMS, Git for web—each with audit logs & API keys outside the Expo client (reuse secret posture from **`.env.example`** / QA pipeline).
3. **Human gates** — “Publish” vs “Dry run”: anything customer-facing crosses a checklist (claim accuracy, competitor ToS for “streaming availability” wording, Accessibility).

Mirror your **successful pattern** from QA: **scheduled job + artifact + optional Resend** (`docs/depts/qa.md`). Marketing equivalent:

- Cron or GitHub Action → **`marketing-digest.json`** (or Sheets row) → optional email to stakeholder.

---

## 4. Starter stack (opinionated, swappable)

| Layer | Typical tools | Role |
| :--- | :--- | :--- |
| **CRM / email** | Loops, Customer.io, Braze (pick one aligned to waitlist/export) | Lifecycle |
| **Social buffer** | Typefully / Buffer API | Queue + approvals |
| **Analytics** | Plausible / PostHog / GA4 (one source of truth) | Funnel truth |
| **Waitlist ↔ product** | getreeldive.com + documented handoff (**`HQ.md`**) | Single acquisition story |
| **Internal status** | Reuse **`reporter.py`** pattern (`report_session`) for *campaign milestones* IF you adopt a tracker; do **not** confuse with user-facing messaging |

Keep **marketing keys out of Expo** unless a specific surface needs public analytics IDs only (`EXPO_PUBLIC_*` analytics is OK; ESP secrets never).

---

## 5. Concrete deliverables checklist (paste into tickets)

- [ ] **ICP one-pager** — who watches what, geography, competitors (2 pages max).
- [ ] **FAQ parity** — update [`docs/marketing/FAQ.md`](../marketing/FAQ.md); mirror approved answers to **`getreeldive.com`** (**[`github.com/trevorseitz-ai/v0-reel-dive-landing-page`](https://github.com/trevorseitz-ai/v0-reel-dive-landing-page)**).

- [ ] **Message house** — 3 positioning pillars + proof points (must match **`marketing.md`** + Product reality; **do not** conflate these with the **four platform pillars**—see **Launch posture** in **`marketing.md`**: Web + TV launch; handset iOS/Android **TBD**).
- [ ] **Consent & suppression** — how waitlist/email maps to lawful basis; unsub in one click.
- [ ] **Weekly digest automation** — “traffic, signups, top posts, anomalies” emailed Monday 08:00 (parallel to QA cron philosophy).
- [ ] **Playbook templates** — 5 email templates + 10 social stubs with `{variable}` injection from Product releases.
- [ ] **Incident rule** — if agent output mentions a title/licensing claim not in Stream Finder mirror, route to human.

---

## 6. 30 / 60 / 90 rollout (minimal)

**30 days:** Pick wedge #1 → one ESP + weekly digest cron + editorial review SLA.  
**60 days:** Add second channel **only after** wedge #1 metrics + review loop feel stable.  
**90 days:** Introduce assisted drafting (agents) **with** templated prompts + forbidden-claim list synced from **`docs/database_schema.md`** posture (truth = mirror/sync, not hand-wavy).

---

## 7. Repo touchpoints

- Marketing Bible & core brand protocol: **`docs/depts/marketing.md`**
- **Public FAQ (in-repo drafts):** **`docs/marketing/FAQ.md`** ↔ mirror approved answers on **`getreeldive.com`**
- Roadmap overlap: **`docs/depts/product.md`**, **`HQ.md`**
- Do **not** label **`npm run report:qa`** or **`reporter.py`** as marketing—they are engineering/QA/ops telemetry unless you deliberately repurpose payloads (document that decision here if you do).

---

## 8. Optional next doc (when scope firms up)

Create **`docs/depts/marketing-autonomous-runbook.md`** with: ESP webhooks fields, Cron schedule URLs, escalation contacts, and a **living “forbidden claims”** list synced with Legal/Product.

**Claude Projects — pre-launch action plan:**

- **Standalone prompt (recommended):** **`docs/REELDIVE_PRELAUNCH_CLAUDE_PROMPT.md`** — zero carry-over from onboarding.
- **Legacy inline block:** **`docs/REELDIVE_LLM_ONBOARDING_PROMPT.md`** → **Part D** (`BEGIN PRELAUNCH …`/`END`).
