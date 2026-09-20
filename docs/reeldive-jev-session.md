# Jev + ReelDive — session record

**Date:** 19 September 2026
**Started as:** "is jevai.org useful for any of my projects?"
**Ended as:** a fixed ranking bug in ReelDive's live Top Rated screen.

---

## 1. What Jev is

[Jev](https://vercel.com/ai-gateway/models/jev) is TypeSafe AI's "System One" model. It
is not a chat model and cannot produce text. It takes a **state** object plus a set of
**typed questions** and returns typed answers with calibrated probabilities, in a single
parallel pass.

Three question types:

| Playground name | AI SDK name | Returns |
|---|---|---|
| Choice | `choice` | one option from a set you define, plus a distribution |
| Score | `score` | a position on an ordered rubric (2–10 levels) |
| **Noul** | `boolean` | a probability from 0 to 1 that a statement is true |

(Noul and boolean are the same primitive under two names — the Playground uses TypeSafe's
naming, the AI SDK renames it.)

**Numbers:** 70–500ms latency. $0.042 per million input tokens, output free. ~67.8%
agreement on TypeSafe's own four-workflow benchmark — mid-tier LLM quality at roughly
1/48th the price. Text only. 32k context.

**Hard limits:** no text generation, no rationale (you get a probability and nothing
else), and it only works where the answer space is known in advance.

### Access

TypeSafe's own API (`api.typesafe.ai/v1/systemone`) is waitlisted. Two hosted routes work
today:

- **Vercel AI Gateway** — model id `typesafe-ai/jev`, called via `experimental_evaluate`
  from the `ai` package. **Requires ai@>=7** (it does not exist in ai@5). Free at time of
  writing.
- **Cloudflare Workers AI** — model id `typesafe/jev`.

The same `experimental_evaluate` call also reaches evaluation models from Anthropic,
OpenAI and Google, which makes A/B comparison a one-variable change.

---

## 2. Where Jev fits across the portfolio

The initial assessment, before any building:

**Worth trying**

- **ReelDive** — scoring or validating catalogue-scale rating data. Too expensive per-title
  for a frontier model, cheap here.
- **Tapatize** — same pattern, plus latency matters: a group deciding in real time can
  afford 200ms, not 8 seconds.
- **Marketing agent team** — the structural fit. Since the Opus coordinator was dropped for
  your own orchestration code, the routing decisions in that code, the Signal Filter's
  "what passes to the next stage", QA pass/fail gates and brand/legal red-line
  classification are all bounded decisions. Keep it out of anything that must explain
  itself — you wanted escalations ending in answerable questions, and Jev returns a
  probability with no reasoning.

**Not worth it**

- **Payhip conformance** — deterministic measurements. Code, not a model.
- **gstack lifecycle-guide** — cost and latency aren't the constraint, and the ledger needs
  reasons.
- **Photographer product** — the thesis is local AI; Jev is a hosted text-only API.
- **SEO/AEO** — would work, but at a zero-traffic baseline the volume doesn't justify a new
  dependency.

**Separate opportunity:** "Don't Go Broke — After Launch the Meter Still Runs" is about
exactly the problem Jev exists to solve. Moving bounded decisions off a frontier model onto
a cheap decision model is a concrete, measurable cost tactic with real numbers behind it.
That's a section, independent of whether it ever ships in code.

---

## 3. The ReelDive experiment

### The chosen use case

Rating reconciliation: given several providers' ratings for one title, decide which are
trustworthy signals of quality, drop the rest, and produce a sorted list from what
survives.

### Architecture

```
raw ratings (multiple scales)
  ↓  normalize.ts    calibrate scales → 0-100, deviation from median,
  │                  sample adequacy, age
  ↓  questions.ts    one state object + 2 questions per rating + 2 per title
  ↓  Jev             p(valid), p(brigaded) per rating; divergence cause; polarizing
  ↓  validate.ts     apply gates, weight survivors by confidence × log(votes)
  ↓                  consensus score, or null when nothing survives
  ↓  run.ts          sort, compare to naive average, report
```

**The design rule, from TypeSafe's own docs:** never ask the model something code can
compute exactly. Code owns scale conversion, deviation, sample thresholds, weighting and
the sort. Jev is asked only *"given all of this, is this rating measuring the film, or
measuring something else?"*

One call per title with every question at once ("speculative fan-out") — judging whether
one rating is trustworthy *is* a question about how it sits against the others.

### Questions asked

| key | type | judgment |
|---|---|---|
| `<source>__valid` | Noul | trustworthy signal of the film's quality? |
| `<source>__manipulated` | Noul | brigading signature vs. organic disagreement? |
| `divergence` | Choice | consensus / critic_audience_split / review_bombed / thin_sample / niche_appeal / unclear |
| `polarizing` | Noul | does this film genuinely divide viewers? |

Noul questions carry explicit `Yes means` / `No means` criteria. The load-bearing phrase is
in the valid questions' Yes: *"even if far from the other sources"* — it tells the model
that distance from the median is not by itself disqualifying, which is precisely the
distinction a heuristic cannot make.

### Gates (in `validate.ts`, deliberately outside the questions)

```
minValid: 0.6          keep only above this
maxManipulated: 0.35   drop outright above this
minConfidence: 0.5     below this, keep but flag for review
```

Low confidence is a first-class branch, not a failure.

---

## 4. What the ReelDive codebase actually has

Read from `~/Projects/StreamScape`.

| Source | Field | Scale | Vote count published? |
|---|---|---|---|
| TMDB | `vote_average` | 0–10 | yes (`vote_count`) |
| IMDb | OMDb `imdbRating` | 0–10 | yes (`imdbVotes`) |
| Rotten Tomatoes | OMDb `Ratings[]` | 0–100 | **no** — critics only |
| Metacritic | OMDb `Metascore` | 0–100 | **no** |

No RT audience score, so the audience side is TMDB + IMDb, which correlate.

Key files: `lib/ratings.ts`, `lib/tmdbFetch.ts`, migration
`supabase/migrations/20250101001000_media_omdb_ratings.sql`. Scores stored as TEXT on
`public.media` with a `ratings_fetched_at` TTL, fetched lazily on the movie detail screen.
The TMDB key is a **v4 Read Access Token** (a JWT → `Authorization: Bearer`), not a v3 key.

### Findings

**A. Vote counts were being discarded.** `vote_count` appeared only as a TMDB discover
filter, never stored. `imdbVotes` sits unread in the OMDb response `lib/ratings.ts` already
parses. Both free — no extra requests. *Now plumbed through the discover path.*

**B. Provider scales are not comparable, and RT is the worst offender.** See §5.

**C. Sample thresholds were incoherent.** Hand-picked per source. On real data the harness
dropped a 333-vote IMDb score while keeping a 338-vote TMDB score on the same film, then
ranked that film #3. *Fixed — see §6.*

---

## 5. Calibration — the central finding

Fitted by quantile mapping on a 303-title corpus (289 TMDB↔IMDb paired, 237 RT, 228
Metacritic), anchored on IMDb. Shift applied at each percentile of the source's own
distribution:

| percentile | TMDB | RT critics | Metacritic |
|---|---|---|---|
| 5% | −11.0 | **+28.8** | +17.0 |
| 30% | −5.7 | −5.0 | +7.0 |
| 50% | −5.0 | −10.0 | +6.0 |
| 80% | −1.2 | −12.8 | +1.6 |
| 95% | +1.0 | −10.0 | −3.0 |

**The Tomatometer is not a quality score.** It's the percentage of critics who were
positive. A 21% Tomatometer maps to roughly **50** on IMDb's scale. Reading it as "21/100
quality" systematically punishes any film critics were merely mixed on — and RT's low end
goes far lower than any user-rating scale ever does.

**TMDB is compressed.** Measured on the 22-title sample: mean +7.0 vs IMDb, higher in 16 of
22 — but +35 on weak films (Zip Wire) and −5 on the canon (Godfather, Shawshank). Its whole
distribution sits in roughly 65–92; it never goes low. A flat offset cannot fix that;
quantile mapping can.

**Why this matters beyond the experiment:** it affects how ReelDive *displays* these
numbers side by side, not just how a model judges them.

### Effect on real data

Against the original raw-linear, keep-everything behaviour: 14 of 22 titles changed rank.
Clash of the Thundermans 55.0 → 46.0, Moana 51.7 → 58.6, Michael 63.0 → 69.8. Drop rate
fell 7/79 → 4/79.

Crucially, **Michael and Moana stopped registering as critic/audience splits.** Their
apparent divergence was RT's scale, not real disagreement.

---

## 6. Sample adequacy, derived rather than guessed

Thresholds now come from standard error (SD/√n), with two models because a crowd and a
critic panel are different kinds of sample:

| kind | assumed SD | tolerated error | implied minimum |
|---|---|---|---|
| crowd (IMDb, TMDB, RT audience, Letterboxd) | 20 | 2 points | n ≥ 100 |
| critic panel (RT critics, Metacritic) | 15 | 5 points | n ≥ 9 |

Both SD figures are stated assumptions in `normalize.ts`, there to be argued with. The
critic split matters: a single uniform rule dropped a 38-critic Metascore, which is wrong —
38 curated critics carry far more information than 38 random users.

A missing vote count is `null` — **unknown, not small**. OMDb publishes no critic counts,
so treating absence as thinness would drop every RT and Metacritic score on every title.
Unknown ratings get a neutral middle weight and the state object says
`sample_size_published: false` explicitly.

---

## 7. The live app fix

Your Top Rated screen was showing *The Way to the Heart* (9.9), *Ghosts and the Afterlife*
(9.6) and a K-pop concert film (9.5) above everything recognisable.

**Cause:** `app/api/discover+api.ts` and `app/(tabs)/discover.tsx` both carried
`&sort_by=vote_average.desc&vote_count.gte=10`. A ten-vote floor on a plain arithmetic
mean. Small devoted fandoms rate 10/10 en masse and win.

Note that **calibration was not the fix here.** Quantile mapping is monotonic — it
preserves rank order within a source, so on a TMDB-only sort it changes nothing. What fixed
it was the vote floor plus shrinkage.

### What changed

**New: `lib/rankScore.ts`** — Bayesian shrinkage toward the global mean:

```
score = (v / (v + m)) * R + (m / (v + m)) * C

  R = the film's own average
  v = votes behind it
  C = 7.16   prior mean, measured from your own 303-title corpus
  m = 500    prior strength, in votes — a product dial
```

**Both discover files:**
- the rating-sorted phase no longer uses `sort_by=vote_average.desc` at all. It asks for
  `sort_by=vote_count.desc&vote_count.gte=100` — the most-voted matching titles — and ranks
  them locally with `rankByBayesian`.
- `discover.tsx` pulls a **5-page, ~100-title candidate pool**, ranks the whole pool, then
  serves the requested 20-item slice. `total_pages` is derived from the pool so loadMore
  still works.
- `vote_count` added to the TMDB response types and mapped through
- phase 2 untouched — it sorts by popularity and keeps TMDB's order

**Why not simply re-rank a `vote_average.desc` page (the first attempt, which was wrong):**
TMDB sorts server-side. Page 1 of `vote_average.desc` *is* the wall of 9.x titles with a
hundred votes. Re-ranking those twenty among themselves only reshuffles them — a
well-supported film at 8.7 is hundreds of positions down that sort and can never be pulled
onto page 1. Ranking has to span a candidate pool selected on evidence, not on the raw mean.

### What shrinkage does to a raw 9.9

14 votes → 7.23 · 120 votes → 7.69 · 500 votes → 8.53 · 30,000 votes → 9.86.
Shawshank (8.7 from 31,352 votes) → 8.68, which beats all but the last of those.

### Verifying it

`scripts/check-top-rated.mjs` prints the old and new orderings against the live TMDB API,
so the change can be checked without rebuilding:

```bash
node scripts/check-top-rated.mjs            # all years
YEAR=2024 node scripts/check-top-rated.mjs  # one year
```

This matters because the first attempt at this fix passed a test that wasn't faithful to
how the app pages through TMDB. Check it against the real endpoint, not a local corpus.

**Caveats.** Displayed scores still show the raw TMDB number, so a film can show ★9.1 while
sitting fifth — ranking and display are deliberately separate. Top Rated filters by release
year, so a sparse year may now return fewer results; worth clicking through some older
years. Originals are in `.backup-preranking/` because that repo has no commits yet.
TypeScript isn't installed in StreamScape, so `npx tsc` there silently does nothing — the
edited files were parse-checked elsewhere. Worth `npm i -D typescript`.

---

## 7b. What was actually wrong with Discover (found after the above)

The ranking fix in §7 was correct but was not the reason the screen looked broken.
Tracing the real data flow, and then a HAR capture of the running app, turned up three
separate causes:

**The landing feed was never TMDB.** `discoverFeedSourceRef` initialised to
`'stream-finder'`, so Discover opened on the Supabase cache
(`lib/stream-finder-supabase.ts`), which selects `tmdb_id, title, popularity, overview,
poster_path`, orders by **popularity**, and hardcodes `vote_average: null`. A
popularity-ordered list with no ratings, under a "Top Rated Movies" heading. Fixed with
`DEFAULT_DISCOVER_FEED = 'tmdb'`, which also stops that effect resetting the feed-source
flags and clobbering the TMDB list a moment after it loads.

**The feed was filtered to one streaming provider.** The HAR showed
`with_watch_providers=300` on every discover call. For 2026 on that one service, zero
titles have 100+ votes — so phase 1 legitimately returned nothing and the pre-existing
fallback dumped `popularity.desc` with no vote filter, which is where the four unrated
titles came from. Provider narrowing is now opt-in via `LIMIT_TO_MY_PROVIDERS = false`;
browsing starts from the whole catalogue.

**The vote floor could not degrade.** A single floor of 100 either matched or collapsed.
Now `VOTE_FLOORS = [100, 20, 0]` steps down and keeps the ranking meaningful for as long
as anything matches, logging when it eases.

Plus a display bug: TMDB returns `vote_average: 0` rather than `null` for unrated films,
so `MovieCard`'s null check still rendered a "★0.0" badge. It now requires a positive
average and, where known, a non-zero vote count.

**Result:** Discover opens on Shawshank / The Godfather / The Dark Knight, and the year
and genre chips filter within that same ranked catalogue.

**Still open:** the Stream Finder feed is not deleted, just no longer the landing view
(flip `DEFAULT_DISCOVER_FEED` to restore it). It deserves its own row with an honest
heading such as "On your services" — it cannot sit under "Top Rated" while it has no
ratings and sorts by popularity.

## 8. The honest verdict on Jev in ReelDive

After calibration and derived thresholds, the remaining drops are almost entirely
thin-sample refusals — pure arithmetic, no model required. The cases that looked like
genuine judgment calls (critic/audience splits) largely evaporated once the scales were
made comparable. **Fixing the measurement error dissolved most of the problem Jev was going
to solve.**

What a model could still add:

- distinguishing early-adopter bias from a real score on new releases — 140 votes is
  statistically precise, but the first 140 people to rate a four-day-old film aren't a
  representative audience. That is a real judgment and arithmetic cannot make it.
- review-bomb detection — hard to test well without an RT audience score.
- `divergence` and `polarizing` as filter facets or card copy — a product feature rather
  than a data-quality one.

**Cost is not the deciding factor either way:** ~300 input tokens per title → **$0.63 per
50,000 titles**.

**The test to run before committing:** `npm run eval:live` and `npm run eval:haiku` on the
same set. Jev has to beat plain arithmetic on your own data, and it has to beat Haiku on
the identical question set. If Haiku matches it, Jev's entire case is price.

---

## 9. Known gaps

- The corpus's 50k–1M vote band returned 0 titles, so calibration above ~28,000 votes is
  extrapolated. The canon titles (1–3M votes) sit outside the fitted range. A second pull
  with that band split smaller would fix it.
- Only 22 labelled test titles; no ground truth on the 303-title corpus.
- No RT audience score anywhere in the stack.
- Live Jev has still never been called. Everything above used the offline heuristic mock.
- `Batman: Knightfall` still ranks high on ~335 votes with no critic coverage. A coverage
  penalty (fewer surviving sources → lower confidence → ranked lower) would address it.

---

## 10. Corrections made during the session

Recorded because each was a real error, not a refinement.

1. **`ai@^5` pinned for `experimental_evaluate`.** It doesn't exist there; it landed in v7.
   The live call would have thrown immediately.
2. **Boolean answer shape.** Comes back as `{ probability }`, not `{ boolean }`, with no
   guaranteed `confidence` field — the adapter now derives one.
3. **"Your OMDb key is missing."** Stated as a live app bug; it was actually added between
   my reading the file and saying so.
4. **TMDB sent as a v3 `api_key` param.** It's a v4 JWT — 401. Your own `lib/tmdbFetch.ts`
   already had the right logic; the script didn't.
5. **A uniform 100-vote rule for every source.** Wrong — it dropped 38-critic Metascores.
   Split into crowd and critic models.
6. **An import inserted into the middle of a multi-line import block** in `discover.tsx`.
   Caught and repaired.
7. **A typecheck reported as clean that never ran** — TypeScript isn't installed in
   StreamScape and `npx tsc` prints a notice instead of compiling.
8. **I fixed a code path that wasn't the one rendering the screen.** Discover landed on
   the Stream Finder feed, not TMDB. I recognised the classic small-sample bug in
   `sort_by=vote_average.desc` and fixed it without first tracing what actually fed the
   grid. Both my corpus test and the live TMDB probe validated the path I had changed, so
   neither could catch it. A HAR capture from the running app settled it in one step —
   that should have been the first move, not the last.
9. **The first ranking fix didn't work, and the test that "proved" it was unfaithful.**
   Re-ranking a `vote_average.desc` page locally cannot change what's on that page, because
   TMDB sorts server-side. My corpus test ranked across 303 titles spanning every vote
   band, which is not what the app does — it pages through TMDB twenty at a time. The fix
   is now a candidate pool selected by vote count, and there's a script that checks it
   against the live endpoint instead of a local file.

---

## 11. Files and commands

### In `~/Projects/StreamScape`

```
scripts/export-ratings-sample.mjs    22-title sample for testing
scripts/export-ratings-corpus.mjs    ~400-title corpus across vote bands, for calibration
scripts/check-top-rated.mjs          old vs new Top Rated ordering, against live TMDB
scripts/real-titles.json             the sample
scripts/real-corpus.json             the corpus (303 titles)
lib/rankScore.ts                     NEW — Bayesian shrinkage ranking
app/api/discover+api.ts              MODIFIED — floor, re-rank, vote_count
app/(tabs)/discover.tsx              MODIFIED — floor, re-rank, vote_count
.backup-preranking/                  originals of both modified files
```

### In `reeldive-jev/` (the standalone harness)

```
src/types.ts          shared shapes
src/normalize.ts      calibration application, sample model, consensus
src/calibrate.ts      fits quantile curves from a corpus
src/questions.ts      state + question construction
src/jev.ts            Gateway adapter + offline heuristic mock
src/validate.ts       gates and aggregation
src/run.ts            CLI, eval, cost and ranking report
data/calibration.json fitted from your 303-title corpus
data/titles.json      8 synthetic adversarial titles with expected-drop labels
data/real-titles.json your 22 real titles
data/real-corpus.json your 303-title corpus
```

```bash
npm install
npm run eval                                   # offline mock, no key, no spend
npm run calibrate -- data/real-corpus.json     # refit the curves
TITLES=data/real-titles.json npm run eval      # run against real rows
npm run eval:live                              # real Jev via AI Gateway
npm run eval:haiku                             # same questions, Claude Haiku
```

Live runs need `vercel link && vercel env pull`, or `AI_GATEWAY_API_KEY` in the
environment.

---

## 12. Next steps, in priority order

1. **Click through the fixed Top Rated screen** across several years and genres. Confirm
   nothing empties out at `gte=100`.
2. **Apply the same vote-count capture to `lib/ratings.ts`** — `imdbVotes` is still unread
   there, and the movie detail screen still stores scores without counts.
3. **Consider applying calibration to displayed scores**, or at least stop presenting RT's
   Tomatometer next to user ratings as if they were the same kind of number.
4. **Re-pull the corpus** with the 50k+ band split smaller, and refit.
5. **Only then** run `eval:live` and `eval:haiku`, with the bar set in §8.

---

*Sources: [Jev AI Community](https://www.jevai.org/) · [Jev API](https://www.jevai.org/jev-api) ·
[Vercel AI Gateway](https://vercel.com/ai-gateway/models/jev) ·
[Vercel: classify, route, score with Jev](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk) ·
[AI SDK evaluation docs](https://ai-sdk.dev/docs/ai-sdk-core/evaluation) ·
[Cloudflare Workers AI](https://developers.cloudflare.com/ai/models/typesafe/jev/) ·
[DataCamp: System One models](https://www.datacamp.com/blog/system-one-models-jev) ·
[awesome-jev-by-typesafe](https://github.com/Anil-matcha/awesome-jev-by-typesafe)*
