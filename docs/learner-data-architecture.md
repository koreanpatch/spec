# Learner Data Architecture

This document describes how SPEC collects, stores, and uses learner data across the ecosystem. It covers the split between what lives on the ATProto firehose versus what lives in SPEC's own database, and how apps like Sunbi contribute data to build a meaningful learner profile over time.

---

## The Two-Layer Model

SPEC uses two distinct storage layers with different purposes:

| Layer | What it holds | Who reads it | Why |
|---|---|---|---|
| **ATProto firehose** (public, portable) | Minimal signed events — what content a user encountered, when, on which app | Any SPEC-compatible app | Portability, user data ownership, cross-app identity |
| **SPEC server DB** (private, computed) | Rich interaction detail, BKT posteriors, morpheme signals, assessments, computed SPEC level | spec-server, Sunbi extension (via API) | Heavy computation, eojeol-level granularity, signal quality |

The firehose records are the skeleton. They prove something happened, when, and on what platform. The server DB is where the real learner model lives.

---

## What Goes on the Firehose

Firehose records are minimal, signed by the originating app, and human-readable. They answer one question: **what content did this user engage with, and when?**

### `tools.spec.event.content.encountered`

The primary event record. Written once per content item per session, by any SPEC-integrated app.

```
user DID         — who
app DID          — which app wrote this
content URI      — URL or AT-URI of the content (YouTube video, book chapter, article)
content domain   — news | webtoon | academic | conversation | fiction | video | other
watched from     — timestamp (start)
watched until    — timestamp (end of engagement, not necessarily the end of the content)
spec level hint  — integer 1–10, the pre-computed SPEC level of this content (optional, supplied by app)
signature        — Ed25519 signed by appDid
```

Nothing else. No morpheme lists. No word counts. No interaction details. Those belong in the server DB.

### `tools.spec.event.word.saved` (existing)

Unchanged from the current schema. Written when a user explicitly saves or looks up a word. This is a meaningful active signal and stays on the firehose because it is intentional, low-frequency, and portable.

### `tools.spec.profile.learnerState` (singleton, server-written)

A single self-keyed record per user, written by spec-server and updated when the learner's SPEC level or major profile metrics change. This is what partner apps read to display the user's level, zone, and progress.

```
spec level         — integer 1–10 (AND-gated: V, M, D, T all met)
spec decimal       — e.g. 4.7 (level + posterior probability of next level)
elo rating         — current overall ELO ability estimate
settled lemmas     — count of lemma families with BKT posterior ≥ 0.60
settled morphemes  — count of morpheme patterns with BKT posterior ≥ 0.60
settled domains    — count of domains with 50+ settled encounters
weeks at level     — time gate for level advancement
growth zone        — [low, high] E_diff band for this learner
computed at        — timestamp of last spec-server update
```

This record is the public face of the learner's SPEC profile. It does not expose raw posteriors or encounter history.

---

## What Goes in the Server DB

Everything computationally heavy, interaction-granular, or linguistically specific lives in spec-server's PostgreSQL database, not on the firehose.

### Content Ratings

When a piece of content is first encountered by any user, spec-server (or SPEC-RSSHub for RSS feeds) runs the full five-module SPEC grading pipeline on it:

- **C_lex** — lexical coverage at each SPEC level
- **C_morph** — salience-weighted morphological coverage
- **C_decomp** — decomposition bonus (Sino-Korean transparency)
- **SC** — structural complexity (ASL, connective density, nominalization)
- **CD** — context debt (zero anaphora, referential distance, AIC)

The result is a `content_rating` row: E_diff per level, zone classification, morpheme pattern inventory, and — critically — **eojeol environment inventory**: the specific surface forms and their functional classifications (contrast, background, trailing, etc.) for every polysemous pattern in the content.

This is computed once and cached. Every user who later encounters the same content gets the benefit of that pre-computation.

### Learner Morpheme States

For each user, the server maintains a BKT (Bayesian Knowledge Tracing) posterior per morpheme pattern, updated from signals contributed by Sunbi and other apps:

```
user_id
morpheme_id        — pattern identifier e.g. "-는데"
bkt_posterior      — P(learned) per Baker et al. 2008 update rule
elo_rating         — per-item ELO (cold-start before BKT stabilises)
encounter_count    — total signals received
is_settled         — posterior ≥ 0.60
last_signaled_at
fading_flag        — posterior decayed below threshold after extended absence
```

Over time, with enough signals from Sunbi, these posteriors extend to **eojeol environment granularity** — not just one posterior for `-는데` but a distribution across functional environments (contrast vs. background vs. trailing softener), derived from clustering the specific eojeol contexts in which the user received signals.

### Interaction Signals (from Sunbi)

Sunbi's extension tracks fine-grained morpheme interactions and sends them to spec-server via its own API — not via the firehose. These are the high-quality BKT signals:

| Signal type | Description | BKT weight |
|---|---|---|
| `hover_pause` | User paused on a morpheme in a parsed eojeol | Low (passive attention) |
| `lookup` | User clicked through to morpheme definition | Medium |
| `self_report` | User rated familiarity inline (see below) | High |
| `test_correct` | Correct response on a prompted assessment | High |
| `test_wrong` | Incorrect response on a prompted assessment | High (negative) |
| `saved` | User saved/starred the pattern | Medium |

Each signal carries the full eojeol surface form and Kiwi parse, so spec-server can map it to the appropriate eojeol environment in the content rating.

### Self-Reports

Sunbi surfaces non-intrusive inline self-report prompts while users read. These are shown contextually — for a specific morpheme in a specific eojeol the user just encountered — not as interruptions.

Example prompt (inline, dismissible):
> *`비가 오는데` — did this feel natural?*
> ✓ Yes / ~ Mostly / ? Unsure / ✗ No

The four-point response maps to a BKT signal weight. The full eojeol and its parsed functional class are recorded server-side. Self-reports are the highest-quality signal in the system because they are reflective and morpheme-specific.

Frequency is managed to stay low-friction: Sunbi throttles self-report prompts by session and by morpheme (no pattern is prompted more than once per session, and patterns above 0.85 posterior are not prompted unless fading is detected).

### Assessments

Occasional, low-pressure prompted assessments are generated from content the user just finished. They fire at natural break points (end of article, between chapters) and are always optional and dismissible.

Three types:

1. **Cloze** — a sentence from the just-read content with a morpheme blanked. User types or selects the missing form.
2. **Recognition** — two versions of a sentence (differing in morpheme choice). User picks which matches the original or which sounds natural.
3. **Context classification** — given an eojeol containing a polysemous pattern (e.g. `-는데`), user selects its discourse function from a short list (contrast / background / trailing).

Cloze and recognition responses feed BKT directly. Context classification responses feed the eojeol environment model — over time, user accuracy on classifying specific environments tells spec-server which environments are consolidated versus uncertain for that user.

Assessment results also generate `d'` (d-prime) estimates from signal detection theory, per the SPEC A7 methodology. Hit rate and false-alarm rate across a session give a bias-free accuracy estimate that feeds the AIC component of context debt scoring for that user's profile.

---

## How the Two Layers Connect

At computation time, spec-server joins the firehose events against the server DB:

```
Firehose: user X encountered content Y at time T
    ↓
Server DB: fetch content_rating for Y
    → morpheme pattern inventory
    → eojeol environment inventory
    → E_diff at user X's current SPEC level
    → domain classification
    ↓
Update:
    → BKT posteriors for all patterns in Y (passive exposure weight)
    → ELO rating update using E_diff
    → domain encounter counter
    ↓
Sunbi API signals (if present for this session):
    → override passive-weight BKT updates with active-signal weights
    → add eojeol environment-specific posteriors
    → incorporate self-report and assessment results
    ↓
Recompute tools.spec.profile.learnerState
    → write back to firehose (singleton, overwrites previous)
```

The firehose event is the trigger. The content rating is the linguistic payload. Sunbi signals are the enrichment layer.

---

## Data Portability

When a user exports or moves their SPEC account, they take:

- Their complete `tools.spec.event.*` history — every piece of content they engaged with, on every app, with timestamps
- Their current `tools.spec.profile.learnerState` — human-readable level, ELO, settled counts, growth zone
- Their `tools.spec.event.word.saved` records — words they explicitly saved

What they do not take with them (because it lives in the server DB):

- Raw BKT posteriors per morpheme (these can be recomputed from the event history given a content rating DB)
- Eojeol environment interaction logs (Sunbi-specific, high-volume)
- Assessment response history

A user who moves to a different SPEC-compatible server can bootstrap a new profile from their exported event history. The new server recomputes BKT from content ratings, producing a profile that converges to their true state over time. The more content ratings the new server has cached, the faster the convergence.

---

## App Integration Summary

| App | Writes to firehose | Sends to spec-server API | Reads from firehose |
|---|---|---|---|
| **Sunbi** | `content.encountered`, `word.saved` | Morpheme hover/lookup signals, self-reports, assessment responses | `learnerState` (zone badge, level display) |
| **Shelf** | `content.encountered` | — | `learnerState` (difficulty display per book) |
| **Yoten** | `content.encountered` | — | `learnerState` (content filter by zone) |
| **SPEC-RSSHub** | — | Content rating jobs (article ingest) | — |
| **spec-server** | `learnerState` (computed result) | — | All `tools.spec.event.*` records |

Sunbi is the richest data source because it is the only app with morpheme-level interaction detection. Shelf and Yoten contribute content encounter breadth — the system gets better coverage of which content a learner is consuming across domains, which feeds domain strength and SPEC level computation even without morpheme-level signals.
