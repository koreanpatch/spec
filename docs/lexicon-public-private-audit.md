# Public lexicon litmus audit

**Date:** 2026-07-03  
**Scope:** `packages/spec-sdk/src/lexicons/*.json` (41 lexicons after the 2026-07-03 scoring-adequacy release; 39 at original audit)  
**Policy:** [`spec-research-suite/docs/compliance/PRODUCT_AND_SPEC_DECISIONS.md`](../../spec-research-suite/docs/compliance/PRODUCT_AND_SPEC_DECISIONS.md) §2.2

Both questions must be **yes** for a lexicon to remain in the public `spec` repo:

1. Does it describe a **raw, verifiable, app-agnostic event**?
2. Does it **avoid** BKT posteriors, fitted weights, stage thresholds, or other scoring conclusions?

## Copyright boundary — no sentence surface on the firehose (hard rule, 2026-07-03)

**Full sentence / passage surface text must NEVER appear on any public firehose (Tier A) record — including a user's own reading, mining, cloze, or SRS records.** The firehose is public and permanent, so a copyrighted passage stored there is a copyright exposure regardless of whose repo holds it. This supersedes the earlier "user owns their own `sentence.read`" nuance, which is now rejected (see [`spec-research-suite/docs/lexicons/RECORD_REFERENCE_HIERARCHY.md`](../../spec-research-suite/docs/lexicons/RECORD_REFERENCE_HIERARCHY.md) §5).

Public records identify content by **`contentHash`** (via `tools.spec.content.defs#contentRef`), plus `sourceUrl`/`sourceDomain`, dictionary/item refs, and an optional opaque **`privateRecordRef`** (`refType: sentenceAnalysis | parseCache`) pointing at the server-only Tier B record that holds the full text. Single-item surfaces that identify the specific lexeme encountered (one `eojeolSurface`, one `compositeSurface`, one dialect `observedSurface`) remain allowed — they are the item, not the sentence, and are analogous to `word.saved`.

### Sentence-surface remediation (2026-07-03)

| NSID | Field(s) removed | Replacement |
|---|---|---|
| `tools.spec.event.sentence.read` | `sentence` | `content` (contentRef) + optional `privateRecordRef` |
| `tools.spec.mining.sentence.captured` | `sentenceSurface`, `sentenceNormalised`, `sentenceTranslation` | `content` (contentRef, now required) + optional `privateRecordRef`; item refs + `sourceId` retained |
| `tools.spec.learner.cloze.responded` | `sentenceContext.surfaceSentence`, `sentenceContext.encryptedSentence` | `sentenceContext.content` (contentRef) + `itemRef` + antecedent slot metadata + optional `privateRecordRef` |
| `tools.spec.event.lemma.encountered` | `sentenceContext.surfaceSentence` | `sentenceContext.content` (contentRef) |
| `tools.spec.event.compound.encountered` | `sentenceContext.surfaceSentence` | `sentenceContext.content` (contentRef) |
| `tools.spec.event.grammar_pattern.encountered` | `sentenceContext.surfaceSentence` | `sentenceContext.content` (contentRef) |
| `tools.spec.event.entity.encountered` | `sentenceContext.surfaceSentence` | `sentenceContext.content` (contentRef) |
| `tools.spec.event.register.observed` | `sentenceContext.surfaceSentence` | `sentenceContext.content` (contentRef) |
| `tools.spec.event.dialect.observed` | `sentenceContext.surfaceSentence` | `sentenceContext.content` (contentRef) |
| `tools.spec.srs.card.created` | `miningSource.sentenceSurface`, `presentation.contextSentence` | `miningSource.content` (contentRef); `cardFront`/`cardBack` retained (item/gloss/user text only — no copyrighted passage or cloze of one) |
| `tools.spec.event.defs#privateRecordRef` | — | added `sentenceAnalysis`, `parseCache` to `refType` enum (points at Tier B full-text records) |

## Remediation summary

| NSID | Verdict | Action |
|---|---|---|
| `tools.spec.profile.extrapolation_state` | **FAIL** | Removed from public SDK → `spec-server/docs/private-schemas/` |
| `tools.spec.lifecycle.difficulty.learner.updated` | **FAIL** | Removed from public SDK → `spec-server/docs/private-schemas/` |
| `tools.spec.lifecycle.item.mastered` | **FAIL** (posterior fields) | Trimmed: removed `priorW`, `posteriorW`, `difficultyAtMastery` |
| `tools.spec.lifecycle.item.forgotten` | **FAIL** (posterior fields) | Trimmed: removed `priorW`, `posteriorW` |
| `tools.spec.lifecycle.stage.promoted` | **PARTIAL** | Trimmed: removed `vAtPromotion`, `mAtPromotion` |
| `tools.spec.profile.learnerState` | **NEW (pass)** | Added as curated public summary (no posteriors/thresholds) |
| `tools.spec.content.difficultyBand` | **NEW (pass, minimal)** | Added catalog label only (no module scores / eDiff curve) |
| `tools.spec.content.defs` | **NEW (pass, minimal)** | Shared refs for difficultyBand only (no `moduleScores`) |

## Pass — remain public (35 existing + 3 new)

**Infra:** `tools.spec.account.*`, `tools.spec.oauth.*`, `tools.spec.registry.approvedApps`

**Profile:** `tools.spec.profile.elo`, `tools.spec.profile.keys`, `tools.spec.profile.approvedApps`, `tools.spec.profile.learnerState`

**Raw events:** all `tools.spec.event.*` (including `encounter_defs`, `defs`, and `event.hvpt.trial` — raw HVPT stimulus/response/outcome/latency)

**Learner (raw responses):** `tools.spec.learner.cloze.responded` (raw signal-detection hit/miss/false_alarm/correct_reject). Note: `tools.spec.learner.specScore` stays **blocked/private** — the `learner.*` namespace holds raw responses here, not derived scores.

**Study:** `tools.spec.srs.*`, `tools.spec.mining.*`

**Lifecycle (milestone notifications):** `session.started`, `stage.promoted` (trimmed), `item.mastered` (trimmed), `item.forgotten` (trimmed), `streak.broken`, `bibim.pattern.discovered`, `calibration.run.completed`

**Content:** `tools.spec.content.defs` (minimal), `tools.spec.content.difficultyBand` (minimal)

**Notes on borderline passes:**

- `tools.spec.srs.card.reviewed` — `Y` is the review observation (0/1), not a BKT posterior. Pass.
- `tools.spec.lifecycle.calibration.run.completed` — aggregate run metadata only; no item params or ability state. Pass with monitoring.
- Event lexicon *descriptions* may mention BKT/IRT as consumer context; fields must not expose model internals.

## Fail — never release from proposals

See `spec-research-suite/docs/lexicons/proposals/RELEASE_BLOCKERS.md`:

- `app.bsky.spec.*` model records
- `tools.spec.learner.specScore`
- `tools.spec.content.contentRating` (full E_diff module vector)
- Full `tools.spec.content.defs#moduleScores`

## Re-audit trigger

Re-run this audit whenever a lexicon is promoted from `spec-research-suite/docs/lexicons/proposals/` to `spec/packages/spec-sdk/src/lexicons/`.

---

## Scoring adequacy review (2026-07-03)

Cross-checked public lexicons against [`CALCULATION_ENGINE_ARCHITECTURE.md`](../../spec-research-suite/docs/plans/CALCULATION_ENGINE_ARCHITECTURE.md) and [`EMBEDDING_SIMILARITY_PIPELINE_PROPOSAL.md`](../../spec-research-suite/docs/plans/EMBEDDING_SIMILARITY_PIPELINE_PROPOSAL.md).

### Verdict: split is correct; a few raw inputs are still missing

**spec-server can compute full SPEC level, personalized E_diff (except CD), embeddings, and extrapolation** with:

- (a) public firehose events + (b) private DB (`content_rating`, `spectrum_state`, Sunbi API, dictionary)

Removed/blocked **interpretation** records (`extrapolation_state`, `priorW`/`posteriorW`, `contentRating`, `specScore`, `app.bsky.spec.*`) do **not** block scoring — they were outputs, not inputs.

Trimmed lifecycle milestones (`item.forgotten` without `priorW`) are **notification-only**. Forgetting is recomputed from encounter stream + private `(W, κ, F)` state; the crossing snapshot was never a required input.

### Real gaps (never shipped raw events — not caused by the split)

| Gap | Impact | Status (2026-07-03) |
|---|---|---|
| `morpheme.encountered` lacks `outcome`/`Y` | Weak M-axis BKT vs `lemma`/`compound`/`grammar_pattern` | **DONE** — added `outcome` (required) + `Y` (optional) + `encounteredAt` (required), aligned with `lemma.encountered` |
| `tools.spec.learner.cloze.responded` draft-only | No portable H/F → d′ → `CD_effective` | **DONE** — released as public raw signal-detection event (passes litmus; was wrongly grouped with `specScore`) |
| `latencyMs` on reading encounters (RFC 017) | B9 Automaticity (`F`) falls back to outcome proxy | **DONE** — optional `latencyMs` added to lemma/morpheme/compound/grammar_pattern |
| `candidateAnalyses` on ambiguous parses (RFC 017) | B9 soft-evidence / enumeration needs re-parse or hard single analysis | **DONE** — optional `candidateAnalyses[]` + new `encounter_defs#candidateAnalysisRef` added to lemma/morpheme/compound/grammar_pattern |
| `tools.spec.event.hvpt.trial` (draft only) | B9 phonetic branch incomplete on firehose | **DONE** — released as public raw trial record (raw stimulus/response/outcome/latency only) |
| `domainId`/`parentDomainId` taxonomy on `content.defs#contentRef` (RFC 017) | No recursive domain hierarchy for B9 domain rollups | **DONE** — added as optional taxonomy fields (structure only, no aggregates) |
| Full `contentRating` / `sentenceAnalysis` blocked | Cannot recompute E_diff from firehose alone | **By design** — spec-server `content_rating` cache (still blocked) |
| `encounteredAt`/`observedAt` missing from some encounter JSON properties | Schema validation gap | **DONE** — added to lemma/compound/grammar_pattern (`encounteredAt`) and entity/register/dialect (`observedAt`) |

`word.saved` was reviewed for a structured `hostLemma` ref + `outcome`/`Y` (weaker V-axis priority): **not changed** — RFC 008 §"tools.spec.event.word.saved" deliberately keeps `word.saved` as a *bookmark/save* event and routes the V-axis *signal* through `lemma.encountered`, which already carries `hostLemma` (ref), `outcome`, and `Y`. Duplicating those onto `word.saved` was intentionally avoided.

### Do not un-block

Posterior fields, threshold tables, module score vectors, IRT params, and `specScore` — keep private. Replace with **raw observations** above, not model conclusions.

---

## Reference hierarchy & copyright boundary (2026-07-03, second pass)

Full architecture: [`spec-research-suite/docs/lexicons/RECORD_REFERENCE_HIERARCHY.md`](../../spec-research-suite/docs/lexicons/RECORD_REFERENCE_HIERARCHY.md). Summary of what changed on the public SDK side:

### Three storage tiers

| Tier | What | Where | Public? |
|---|---|---|---|
| **A** | Raw firehose events + opaque references | user PDS → firehose → this SDK | Yes |
| **B** | Private ATProto-shaped interpretation (`tools.spec.private.*`) | spec-server Postgres | No |
| **C** | Encrypted blobs (embedding vectors, full parse tiers) | spec-server blob store, encrypted at rest | No |

Tier B keeps an ATProto record shape on purpose so a redacted variant can graduate to public by **redaction + relocation**, not a storage migration.

### Public records carry references, not inline interpretation

New shared type **`tools.spec.event.defs#privateRecordRef`** — `{ ref, refType, resolvedBy: "spec-server" }` — is the canonical opaque pointer from a public record to a private one. Outsiders cannot dereference it; it reveals no posterior, weight, threshold, module vector, or embedding.

| Public record | Field added / clarified | Points at (private, opaque) |
|---|---|---|
| `tools.spec.event.sentence.read` | optional `content` (`content.defs#contentRef` → `contentHash`) | joins to private `contentRating` by hash |
| `tools.spec.content.difficultyBand` | optional `contentRatingRef` (`privateRecordRef`) | `tools.spec.private.content.contentRating` |
| `tools.spec.lifecycle.item.mastered` | `sourceEventRef` description now names the target | `tools.spec.private.learner.spectrumState` (no inline `W`) |
| `tools.spec.lifecycle.item.forgotten` | `sourceEventRef` description now names the target | `tools.spec.private.learner.spectrumState` (no inline `W`) |

### Copyright boundary

- **Firehose (public):** `contentHash` (sha256 of normalized text) + `textLevel` + `zone` only. No sentence surface in catalog/rating records, no embedding dimensions, no module scores.
- **Private Tier B:** full `contentRating` module vectors, `sentenceAnalysis`, per-node `spectrumState` — `tools.spec.private.*` on spec-server.
- **Private Tier C:** embeddings and reconstructable metadata are **encrypted at rest**; the private `embeddingFingerprint` record stores only `{ contentHash, embeddingBlobRef, cipherSuite, specVersion, dims }`, never the vector. Aligns with `EMBEDDING_SIMILARITY_PIPELINE_PROPOSAL.md` (production embeddings not in the public `spec` repo).

`sentence.read.sentence` is exempt: it is a record in the reading **user's own** repo (like browser history), not a SPEC-published catalog of copyrighted text. The additions above are all raw signals (outcomes, latencies, parser candidate lists, taxonomy structure) — no axis values (`W`/`κ`/`F`), no `Agg_γ` propagation weights, no d′.

