# Learner Data Architecture

This document describes how SPEC collects, stores, and uses learner data across the ecosystem. It covers the split between what lives on the ATProto firehose versus what lives in SPEC's private backend, and how apps like Sunbi contribute data to build a meaningful learner profile over time.

**Related:** [`lexicon-public-private-audit.md`](./lexicon-public-private-audit.md) (public SDK litmus audit), [`spec-research-suite/docs/lexicons/RELEASE_PROCESS.md`](../../spec-research-suite/docs/lexicons/RELEASE_PROCESS.md) (draft → release pipeline).

---

## The Two-Layer Model

SPEC uses two distinct storage layers with different purposes:

| Layer | What it holds | Who reads it | Why |
|---|---|---|---|
| **ATProto user repo** (portable) | Signed **raw events** + optional **curated profile summaries** | Any SPEC-compatible app | Portability, user data ownership, cross-app identity |
| **spec-server DB** (private) | BKT posteriors, IRT state, full content ratings, rich interaction signals, OAuth secrets | spec-server, Sunbi extension (via API) | Proprietary interpretation + high-volume telemetry |

Raw firehose records prove something happened, when, and on which app. The server DB is where SPEC's scoring model runs.

**Source-of-truth rule:** if ATProto raw events and the private DB disagree about what happened, **the ATProto repo wins**; derived state must be recomputable from events plus private corpus caches.

---

## What Goes on the User's ATProto Repo (public lexicons)

Firehose records are minimal, signed by the originating app, and pass the [public litmus test](./lexicon-public-private-audit.md): raw, verifiable facts — not model conclusions.

### Raw encounter events (`tools.spec.event.*`)

Examples already in the SDK: `sentence.read`, `word.saved`, `lemma.encountered`, `morpheme.encountered`, `book.completed`, `course.completed`, SRS reviews, mining captures.

These answer: **what did the learner encounter or do, and when?** They do not carry BKT posteriors, fitted weights, or per-item model state.

**No sentence surface text on the firehose (hard rule).** Firehose records — including a user's own `sentence.read`, `mining.sentence.captured`, encounter `sentenceContext`, `learner.cloze.responded`, and `srs.card.created` — identify source content only by **`contentHash`** (plus `sourceUrl`/`sourceDomain` and item refs), never by inlining the full Korean/English sentence. Full sentence text lives only in spec-server's private Tier B parse/sentence-analysis cache, reachable from a public record via an opaque `privateRecordRef`. See [`spec-research-suite/docs/lexicons/RECORD_REFERENCE_HIERARCHY.md`](../../spec-research-suite/docs/lexicons/RECORD_REFERENCE_HIERARCHY.md) §5 and [`lexicon-public-private-audit.md`](./lexicon-public-private-audit.md).

Rich morpheme interaction detail (hover pauses, lookups, self-reports) is sent to **spec-server's API only** — not duplicated on the firehose at full granularity.

### Lifecycle milestone notifications (`tools.spec.lifecycle.*`)

Trimmed public milestones: `stage.promoted`, `item.mastered`, `item.forgotten`, `session.started`, `streak.broken`, `bibim.pattern.discovered`.

These are badge/analytics notifications. They **do not** include BKT `priorW`/`posteriorW`, IRT difficulty deltas, or threshold proximity fields — those live in spec-server Postgres.

**Removed from public SDK (private only):** `tools.spec.profile.extrapolation_state`, `tools.spec.lifecycle.difficulty.learner.updated` — see `spec-server/docs/private-schemas/`.

### Curated profile summaries (`tools.spec.profile.*`)

#### `tools.spec.profile.learnerState` (singleton, spec-server-written)

Human-readable SPEC profile for partner apps. Written to the user's repo when level or major metrics change.

```
specLevel          — integer 1–10 (AND-gated level)
specDecimal        — optional display decimal (level + progress hint)
eloRating          — optional mirror of ELO trajectory
settledLemmas      — count only (not per-lemma posteriors)
settledMorphemes    — count only
settledDomains     — count only
weeksAtLevel       — temporal gate progress
growthZoneLow/High — recommended E_diff band for this learner
computedAt         — last update timestamp
```

This record does **not** expose raw BKT posteriors, V/M/D/T threshold tables, or encounter history.

#### `tools.spec.profile.elo` (singleton)

Public **ELO trajectory score** aggregates (reading/vocabulary/listening/overall). This is not the paper's AND-gated SPEC level — see ecosystem naming guidance in `spec-score` / `ECOSYSTEM_ARCHITECTURE.md` §8.

### Public content catalog labels (`tools.spec.content.difficultyBand`)

Shareable **text level + zone** for a content unit — no E_diff module vector, weight profile, or per-level curve. Full grading output stays in spec-server's private `content_rating` cache.

---

## What Stays in spec-server Postgres (never public lexicons)

Everything computationally heavy, model-internal, or gaming-sensitive:

### Full content ratings

When content is first ingested, spec-server runs the five-module grading pipeline (after parse):

- **C_lex**, **C_morph**, **C_decomp**, **SC**, **CD** module scores
- E_diff per reference level, morpheme pattern inventory, eojeol environment inventory

Stored as private `content_rating` rows — **not** as `tools.spec.content.contentRating` on the firehose.

### Learner model state

- BKT posteriors per morpheme/lemma (`bkt_posterior`, `is_settled`, fading flags)
- IRT item params and ability estimates
- Extrapolation snapshots (`extrapolation_state` schema in `spec-server/docs/private-schemas/`)
- Per-item difficulty update history (`difficulty.learner.updated` schema — private)

### Rich interaction signals (from Sunbi)

Sent via spec-server API, not firehose:

| Signal type | Description |
|---|---|
| `hover_pause` | Passive attention on a morpheme |
| `lookup` | Click-through to definition |
| `self_report` | Inline familiarity rating |
| `test_correct` / `test_wrong` | Assessment outcomes |
| `saved` | Pattern starred |

Each signal may carry full eojeol parse detail for environment-level BKT updates.

### Assessments and d-prime

Cloze, recognition, and context-classification responses feed BKT and signal-detection (`d'`) estimates server-side. Response history is private; only derived summaries may appear in `learnerState`.

### Auth and secrets

OAuth tokens, JWT signing keys, service-role credentials — always private.

---

## How the Two Layers Connect

```
Firehose: user X encountered content Y at time T
    ↓
Server DB: fetch private content_rating for Y
    → morpheme inventory, E_diff at X's level, eojeol environments
    ↓
Update private state:
    → BKT posteriors, domain counters, IRT where applicable
    ↓
Sunbi API signals (if present):
    → active-signal weights, self-reports, assessments
    ↓
Recompute curated public records:
    → tools.spec.profile.learnerState (summary only)
    → tools.spec.profile.elo (via spec-score trajectory, optional mirror)
```

The firehose event is the trigger. The content rating is the private linguistic payload. Sunbi signals are the enrichment layer.

---

## Data Portability

When a user exports or moves their SPEC account, they take:

- Complete `tools.spec.event.*` history
- Current `tools.spec.profile.learnerState` and `tools.spec.profile.elo`
- `tools.spec.event.word.saved` and other saved records

They do **not** take (private, recomputable given corpus access):

- Raw BKT posteriors and IRT params
- Full `content_rating` module breakdowns
- Eojeol interaction logs and assessment item history

A new SPEC-compatible server can bootstrap from exported events and its own content-rating cache.

---

## App Integration Summary

| App | Writes to user ATProto repo | Sends to spec-server API | Reads from user repo |
|---|---|---|---|
| **Sunbi** | Raw encounter events, `word.saved` | Morpheme signals, self-reports, assessments | `learnerState`, `elo` |
| **Shelf** | Content encounter events | — | `learnerState` |
| **Yoten** | Content encounter events | — | `learnerState` |
| **SPEC-RSSHub** | — | Content ingest / rating jobs | — |
| **spec-server** | `learnerState` (computed summary) | — | All `tools.spec.event.*` |
| **spec-score** | Optional `profile.elo` mirror | — | Verified `tools.spec.event.*` (firehose) |

Sunbi remains the richest signal source because it alone captures morpheme-level interaction detail — via the **private API**, not the public firehose.
