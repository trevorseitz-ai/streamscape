# StreamScape → ReelDive: remnants map

**Audience:** Engineers who see **StreamScape** / **streamscape** in the tree and wonder if the rebrand is incomplete.

**Product name today:** **ReelDive** (see root [`HQ.md`](../HQ.md)).

---

## What we already updated (safe / no process impact)

These were human-facing strings or non-persistent identifiers only:

| Location | Change |
| :--- | :--- |
| [`HQ.md`](../HQ.md) | Lobby title → **ReelDive Headquarters**; link to this file. |
| [`README_DEV.md`](../README_DEV.md) | Onboarding line → **ReelDive** only. |
| [`REELDIVE_BRAIN.md`](../REELDIVE_BRAIN.md) | Title → **ReelDive** only. |
| [`docs/API-ENDPOINTS.md`](../docs/API-ENDPOINTS.md) | Header → **ReelDive** only. |
| [`docs/tv_layout_rules.md`](../docs/tv_layout_rules.md) | Directive text → **ReelDive**. |
| [`lib/supabase.ts`](../lib/supabase.ts) | `X-Client-Info` → `reeldive-supabase-js`. |
| [`RealDive Launch Deck/ReelDive-Launch-Proposal.html`](../RealDive%20Launch%20Deck/ReelDive-Launch-Proposal.html) | Removed “formerly StreamScape” from speaker notes. |

---

## In-repo remnants we did **not** change (and why)

### 1. AsyncStorage key strings (device persistence)

| File | Constant / value |
| :--- | :--- |
| [`lib/provider-preferences.ts`](../lib/provider-preferences.ts) | `streamscape_provider_ids`, `streamscape_providers_initialized` |
| [`lib/country-context.tsx`](../lib/country-context.tsx) | `streamscape_selected_country` |

**Why:** These keys are the **on-disk contract** with every install that has already saved providers or country. Renaming them **without a migration** would ignore existing data (empty selections, wrong region).

**Future work (pair with a real release / QA pass):**

- Introduce **`reeldive_*`** keys (or a single **`reeldive_preferences_v2`** blob).
- On cold start: if new key missing, **read legacy `streamscape_*`**, hydrate state, **write new key**, optionally **remove** legacy keys after success.
- **When you touch this anyway** (e.g. Profile preferences overhaul, encrypted storage): that is the ideal window to consolidate keys under **ReelDive** and drop **streamscape**.

---

### 2. Supabase CLI linked-project metadata

| File | What you’ll see |
| :--- | :--- |
| [`supabase/.temp/linked-project.json`](../supabase/.temp/linked-project.json) | `"name":"Streamscape Project"` (example; may vary per machine). |

**Why:** Generated / local link state tied to whichever Supabase project was linked in the Dashboard. Editing this file alone does **not** rename the hosted project and can be overwritten by **`supabase link`**.

**Future work:**

- In **Supabase Dashboard** → project **Settings → General**, rename the project display name to **ReelDive** (org policy permitting).
- Re-run **`supabase link`** on each dev machine so `.temp` reflects reality.
- **When you overhaul environments** (new project, staging fork): standardize naming on **ReelDive** in the Dashboard from day one.

---

## Outside this repository (still confusing)

| Where | Notes |
| :--- | :--- |
| **Git / folder path** e.g. `~/Projects/StreamScape` | Purely local or **GitHub repo name**. Renaming the remote repo is an org/GitHub Admin action; clone URLs and CI “checkout path” docs may reference the old slug. |
| **IDE / Cursor “project folder” label** | Follows filesystem path above. |

**Future work:**

- Repo rename slug → **`reeldive`** (or **`reeldive-app`**) when you’re ready to update remotes, Vercel, EAS, and any **“clone URL”** in internal docs simultaneously.

---

## How to verify the tree later

Run from repo root (case variants):

```bash
rg -n 'StreamScape|Streamscape|streamscape' --glob '!node_modules'
```

Expect intentional hits: **this file**, **`HQ.md`** pointer line, **`lib/provider-preferences.ts`**, **`lib/country-context.tsx`**, and possibly **`supabase/.temp/`**.

---

## Pairing cheat-sheet: “when we change X, we can rename Y”

| If you are already changing… | Good opportunity to also… |
| :--- | :--- |
| Provider / country persistence schema | Migrate **`streamscape_*`** AsyncStorage keys → **`reeldive_*`** with read-fallback + cleanup. |
| Supabase projects or **`supabase link`** flow | Rename hosted project + refresh linked metadata; scrub old name in dashboards. |
| Monorepo / repo split | New repo **`reeldive`** and archive **`StreamScape`** with a README redirect note. |
| Store listings / bundle identifiers | Align **Apple / Google / Amazon** listing names even if codebase already says ReelDive (bundle IDs rarely need to echo the word “streamscape”). |
