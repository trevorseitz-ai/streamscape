# Welcome pack — Cara Paul (native iOS / handset)

Canonical repo on GitHub: **[trevorseitz-ai/streamscape](https://github.com/trevorseitz-ai/streamscape)**.

Below is **copy‑paste‑ready mail** after you swap the bracketed signature. The **employment / project-commitment paragraph** expresses serious intent paired with cofounder wording—have counsel review once if your jurisdiction requires standardized offer language alongside this informal welcome.

---

## Subject line

**Welcome to ReelDive — cofounder & native engineering (your GitHub + next steps)**

---

## Email — copy ready for Cara

Hi Cara,

Welcome to **ReelDive**. We honestly could not be more excited—you’re stepping in as someone we see as foundational to everything we ship on **Apple devices**, not as a disposable resource. Congratulations on formally joining **as a co-founder**. We’ve dreamed about this caliber of counterpart for a long time, and matching your craft with Expo and our hybrid data stack matters more than hype about “AI apps.”  

You’re onboard the same **Expo + Expo Router** monorepo that powers **Web**, **iOS/Android handsets**, and **Android TV** from one **`app/`** tree. Your home on GitHub: **[github.com/trevorseitz-ai/streamscape](https://github.com/trevorseitz-ai/streamscape)**  

**Cofounder continuity — our commitment.** We want you anchored with real clarity that isn’t fluff: **your role on ReelDive’s native/handset/iOS-facing work stays protected for as long as this project and initiative continues.** Practically speaking, **you will not be laid off from this project absent the endeavor itself winding down** (or equivalently—the initiative ending as we’ve constituted it)—we’re aligning your seat with **the lifespan of ReelDive**, not churning through short horizons.  

**Secrets & keys — what to pull from the docs (as an FTE, request everything you deserve).** Per our engineering docs, please **actively request full access for every credential, dashboard, env value, and non-public operational URL** enumerated for handset/native work—chiefly **`docs/IOS_NATIVE_DEVELOPER_ONBOARDING.md`** (**Sections §4 Secrets**, **§5 Operational URLs**, and **§7 Access checklist**) together with **`docs/API-ENDPOINTS.md`** (quick env checklist) and **`/.env.example`**. Ping us the moment anything blocks your first reproducible **`expo run:ios`**.  

### Repo — read first (~order)

1. **Handset / iOS onboarding (secrets list, origins, dashboard checklist, eas)** → [IOS_NATIVE_DEVELOPER_ONBOARDING.md](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/IOS_NATIVE_DEVELOPER_ONBOARDING.md)  
2. **Operational URLs (`/api/*` vs Metro vs native direct calls)** → [NATIVE_OPERATIONAL_URLS.md](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/NATIVE_OPERATIONAL_URLS.md)  
3. **Apple-specific rules (`isTvTarget`, Safe Area, orientation)** → [ios-rules.md](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/depts/ios-rules.md)  
4. **API index + Quick env checklist** → [API-ENDPOINTS.md](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/API-ENDPOINTS.md)  
5. **Roadmap posture** → [product.md](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/depts/product.md)

### Repo — where to poke

| Topic | Location |
|--------|----------|
| **Screens & Router** | [app/](https://github.com/trevorseitz-ai/streamscape/tree/main/app) |
| **Tab shell vs TV sidebar** | [`app/(tabs)/_layout.tsx`](https://github.com/trevorseitz-ai/streamscape/blob/main/app/%28tabs%29/_layout.tsx) |
| **Handset grids / buckets** | [viewport-utils.ts](https://github.com/trevorseitz-ai/streamscape/blob/main/lib/viewport-utils.ts) |
| **`isTvTarget()` & config glue** | [isTv.ts](https://github.com/trevorseitz-ai/streamscape/blob/main/lib/isTv.ts), [app.config.ts](https://github.com/trevorseitz-ai/streamscape/blob/main/app.config.ts) |
| **Supabase (native persists via AsyncStorage)** | [supabase.ts](https://github.com/trevorseitz-ai/streamscape/blob/main/lib/supabase.ts) |
| **Schema snapshot** | [database_schema.md](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/database_schema.md) |
| **Lobby / milestones** | [HQ.md](https://github.com/trevorseitz-ai/streamscape/blob/main/HQ.md) |
| **Architecture narrative** | [README_DEV.md](https://github.com/trevorseitz-ai/streamscape/blob/main/README_DEV.md) |
| **First `eas` scaffold** | [eas.json](https://github.com/trevorseitz-ai/streamscape/blob/main/eas.json) |
| **Env skeleton** | [.env.example](https://github.com/trevorseitz-ai/streamscape/blob/main/.env.example) |
| **Android TV sizing (don’t blindly apply)** | [`docs/depts/tv.md`](https://github.com/trevorseitz-ai/streamscape/blob/main/docs/depts/tv.md) |

### Local flow (minimal)

Clone → **`npm install`** → copy **`/.env.example` → `./.env`**, populate per docs → **`npx expo start`**, **`i`** for Simulator, **`npm run ios`** when iterating native tooling.  

Gotcha before you refactor layout: skim **§§12.4–12.5** of the onboarding (`isTvTarget` / **`expo.extra.isTV`**) alongside **`docs/depts/ios-rules.md` §7** so simulator realism matches expectation. Questions after your first skim—grab us anytime; we’re glad to pair on Xcode + Expo until the first green build. Thrilled you’re here as a co-founder—we’re building this with seriousness and ambition, and you hold the reins on making iOS impeccable. Warmly  

[Signature — your name]  
[Optional title]

---

## Internal appendix (don't email — ops checklist)

- [ ] Strike out placeholder signature  
- [ ] Expo / Apple / Supabase invites issued per onboarding §§4 & 7  
- [ ] Legally reconcile informal “lifespan of project” language with jurisdiction + handbook / counsel  
- [ ] Maestro QA user if she runs nightly smoke (`docs/depts/qa.md`)  
