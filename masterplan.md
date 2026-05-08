# Arvutaju — MVP Masterplan

## Vision

A single-session tool where an Estonian math teacher opens a task from the "Mõtlemine nähtavaks!" workbook, understands what strategies students will use, gets AI coaching on misconceptions, and can generate practice variants — all in under 2 minutes.

---

## What's Been Done

### Infrastructure
- [x] Next.js 16.2.6 project (App Router, TypeScript, Tailwind v4)
- [x] Mongoose + MongoDB Atlas connection (`lib/mongoose.ts`)
- [x] OpenAI client + embedding helper (`lib/openai.ts`)
- [x] Task Mongoose model with embedding field (`lib/models/Task.ts`)
- [x] Environment variables configured (`.env.local`)

### Data
- [x] 18 workbook tasks seeded — counting/addition/subtraction, grades 1–6, bilingual ET/EN (`scripts/seed-data.ts`)
- [x] `text-embedding-3-small` embeddings (1536-dim) generated and stored in MongoDB Atlas
- [x] Workbook asset schema added — source PDF, page reference, page image URL, task image URL, extracted asset metadata
- [x] PDF extraction workflow scaffolded (`scripts/extract-workbook-images.py`, `scripts/workbook-assets.json`)
- [ ] Exact per-task crop boxes — page renders are supported now; crop boxes still need to be tuned against the two PDFs

### API Routes
- [x] `GET /api/tasks` — filter by operation/grade/difficulty; vector search when `?q=` given (`app/api/tasks/route.ts`)
- [x] `GET /api/tasks/[slug]` — single task detail (`app/api/tasks/[slug]/route.ts`)
- [x] `POST /api/chat` — streaming RAG chat grounded in task context (`app/api/chat/route.ts`)
- [x] `POST /api/generate` — generates 3 similar problems via GPT-4o (`app/api/generate/route.ts`)

### UI
- [x] Task library page — card grid, operation/difficulty filters, semantic search bar (`app/page.tsx`)
- [x] Task detail page — 4 tabs: Strategies, Facilitation, AI Coach, Generate (`app/tasks/[slug]/page.tsx`)

---

## What's Still Needed for MVP

### Critical (app breaks without these)

| # | What | Where | Notes |
|---|------|-------|-------|
| 1 | MongoDB Atlas Vector Search index | Atlas UI → Search tab | Index name: `vector_index`, field: `embedding`, dims: 1536, similarity: cosine |
| 2 | Fix `useSearchParams` Suspense boundary | `app/tasks/[slug]/page.tsx` | Next.js hard requirement — crashes in prod build |
| 3 | Browser smoke test — verify UI renders correctly | localhost:3000 | Nothing tested visually yet |
| 4 | Add `.env.local` to `.gitignore` | `.gitignore` | Credentials safety before any push |

### Core UX (MVP feels incomplete without these)

| # | What | Where | Notes |
|---|------|-------|-------|
| 5 | Language toggle wires through properly | `app/page.tsx`, `app/tasks/[slug]/page.tsx` | `lang` param currently lost on some navigation paths |
| 6 | Error + empty states in chat | `app/tasks/[slug]/page.tsx` | Currently hangs silently if API fails |
| 7 | Mobile layout check | All pages | Teachers may use tablets or phones |

### Polish (nice for demo, not blocking)

| # | What | Where | Notes |
|---|------|-------|-------|
| 8 | Run PDF extraction → `/public/images/tasks/` + page renders | `scripts/extract-workbook-images.py` | Requires PyMuPDF locally |
| 9 | Tune per-task crop boxes for both workbook PDFs | `scripts/workbook-assets.json` | Page-level references are ready; exact task crops need calibration |
| 10 | Expand seed data (22 → 40+ tasks) | `scripts/seed-data.ts` | Richer demo coverage |
| 11 | Auth-ready middleware skeleton | `middleware.ts` | Future-proofing, not needed for demo |
| 12 | Vercel deploy | `vercel.json` / Vercel dashboard | Live URL for judges |

---

## Atlas Vector Search Index Config

Go to: **Atlas → Cluster → Search → Create Search Index → JSON Editor**

Set index name to `vector_index`, database `arvutaju`, collection `tasks`, and paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "operation"
    },
    {
      "type": "filter",
      "path": "gradeMin"
    },
    {
      "type": "filter",
      "path": "difficulty"
    }
  ]
}
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 16.2.6 (App Router) | Full-stack, streaming support |
| Database | MongoDB Atlas | Flexible schema + vector search built in |
| ODM | Mongoose | Schema validation, model reuse |
| AI | OpenAI GPT-4o | Chat + generation |
| Embeddings | `text-embedding-3-small` | Multilingual, fast, cheap |
| Styling | Tailwind CSS v4 | Utility-first, fast iteration |
| Runtime | Node.js (Next.js API routes) | No separate backend needed |

---

## Data Model — `tasks` collection

Each task document contains:
- `slug` — URL-safe identifier (e.g. `lahutamine-84-miinus-38`)
- `title` / `titleEt` — problem label in EN/ET
- `problem` / `problemEt` — the actual problem statement
- `operation` — `addition | subtraction | multiplication | division | mixed`
- `gradeMin` / `gradeMax` — Estonian grade range
- `difficulty` — `easy | medium | hard`
- `strategies[]` — each with `name`, `nameEt`, `description`, `descriptionEt`, `example`
- `facilitation` / `facilitationEt` — teacher facilitation guidance
- `commonMisconceptions[]` / `commonMisconceptionsEt[]`
- `tags[]` — for keyword search and filtering
- `answer` — expected answer string
- `pageRef` — page number in the workbook PDF
- `workbookPart` / `workbookTitle` — source workbook identity
- `sourcePdfName` / `sourcePageNumber` — exact provenance for the task
- `pageImageUrl` — rendered full workbook page
- `imageUrl` — primary task image/crop shown in the UI
- `workbookAssets[]` — page/task image assets with type, URL, page, crop, dimensions, checksum
- `embedding` — 1536-dim vector from `text-embedding-3-small`

---

## Priority Order (what to do next)

```
1. Fix Suspense boundary (#2)          — 10 min
2. Add .env.local to .gitignore (#4)   — 2 min
3. Smoke test in browser (#3)          — 15 min
4. Create Atlas vector index (#1)      — 5 min (manual in Atlas UI)
5. Language + nav fixes (#5, #6)       — 30 min
6. Mobile layout check (#7)            — 20 min
7. PDF images if available (#8, #9)    — 30 min
8. Expand seed data (#10)              — 1 hr
9. Deploy to Vercel (#12)              — 20 min
```

---

## Re-seeding

To re-run the seed script (adds new tasks, updates existing ones):

```bash
npx tsx scripts/seed.ts
```

Requires `MONGODB_URI` and `OPENAI_API_KEY` in `.env.local`.
