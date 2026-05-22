# Implementation Plan: Axon — OOP Language for Orchestrating LLM Agents

**Branch**: `001-axon-language` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-axon-language/spec.md`

**Note**: The "implementation" delivered by this plan is **the Axon language specification document itself** (`docs/axon-spec.md`), not a working compiler. The spec is the contract a future feature will use to build the compiler. This plan therefore describes how the canonical spec document will be authored, structured, and validated. A separate spec-kit cycle will plan the compiler implementation once this document is finalized.

## Summary

Author the canonical Axon language specification document — a single, self-contained markdown deliverable precise enough that a competent engineer can implement a working Axon compiler (lexer, parser, resolver, validator, emitter) from it without further clarification (SC-001).

The technical approach is documentation-first with mechanical validation:

1. **Resolve notational decisions** (grammar formalism, bundle file format conventions, semantic-rules notation) up-front in Phase 0 research so the spec uses a single consistent notation throughout.
2. **Decompose the deliverable into contracts** (formal grammar, bundle format schema, error catalog) so each can be reviewed independently before being woven into the long-form spec.
3. **Use the three example programs as cross-cutting validation**: each example must (a) parse cleanly against the formal grammar, (b) produce a bundle whose layout conforms to the bundle format schema, and (c) — for the medium example only — have its full compiled bundle reproduced in the spec to make the DRY guarantees (FR-024) concrete.
4. **Author the spec in section order matching FR-032 through FR-041**, then run a final pass that traces every functional requirement to at least one section, every compiler error in FR-027 to its catalog entry, and every construct from FR-001 through FR-022 to at least one example.

## Technical Context

**Language/Version**: Markdown (CommonMark) for the spec document; ISO/IEC 14977 EBNF for the formal grammar embedded inside it.

**Primary Dependencies**: None at runtime. Authoring uses a markdown editor and a manual EBNF validator. Optionally, a one-off prototype parser may be sketched in any convenient language during Phase 0 to confirm the grammar is unambiguous — this is a validation aid only, not a deliverable.

**Storage**: Git repository. Single deliverable file `docs/axon-spec.md` plus a `docs/axon/` directory holding the three example programs as standalone `.ax` / `.axm` source files and the medium example's full compiled-bundle directory.

**Testing**: Manual review against the [requirements checklist](./checklists/requirements.md) plus a documentation-coverage matrix (every FR cited; every error in FR-027 catalogued with example + message + fix; every construct exemplified). Mechanical validation: the three example programs are pasted into a grammar checker (any EBNF validator) and must parse without error. SC-004 (byte-equivalent bundles across two implementations) is **not** verifiable until a real compiler exists; in this cycle it is reduced to "the bundle format section is precise enough that two reviewers independently agree on the byte-level output for the medium example."

**Target Platform**: Any platform that can render markdown. The Axon language itself targets Claude as its runtime; the spec document targets human readers (specifically the future compiler implementer) and reviewers.

**Project Type**: Language specification / documentation deliverable.

**Performance Goals**: Not applicable to the document itself. The spec document SHOULD describe a language whose compiler is realistic to implement in roughly 2,000–5,000 lines of code in a typical implementation language (used as a sanity check during authoring — if a section seems to demand a 50k-line compiler, the design is too complex and must be simplified).

**Constraints**:
- The spec MUST satisfy every functional requirement FR-001 through FR-041 in [spec.md](./spec.md).
- Zero `[NEEDS CLARIFICATION]` markers may remain in the final document.
- The deliverable MUST be a single self-contained markdown file plus the `docs/axon/` example directory — no external dependencies, no broken links to outside resources.
- The medium example's compiled-bundle reproduction inside the spec MUST be byte-faithful to what FR-023 / FR-024 / FR-025 / FR-026 demand (manifest-first, DRY, fully self-describing).

**Scale/Scope**: One spec document of approximately 80–150 letter-sized pages when rendered. Embeds 3 example programs (small ≈ 30 lines of Axon, medium ≈ 80 lines, complex ≈ 150 lines). Embeds 1 full compiled bundle (the medium example's output) totaling approximately 8–12 files within the bundle. Catalogues 10 compiler errors. Defines a grammar of roughly 25–40 EBNF production rules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is currently the **unfilled template** — its principle blocks contain only placeholders (`[PRINCIPLE_1_NAME]`, `[PRINCIPLE_1_DESCRIPTION]`, etc.) and there are no ratified governance rules. There are therefore **no concrete gates to evaluate against**.

**Decision**: Proceed without constitutional violations recorded. If the user wants binding governance rules (e.g., "every language feature must have an executable example"), they can be ratified via `/speckit-constitution` and this plan will be re-checked.

**Implicit gates honored anyway** (drawn from the spec's own constraints — these are the de-facto constitution for this work):

1. **Spec-first** — every section of the deliverable traces to at least one FR; no section is invented that is not requirement-driven.
2. **DRY in the bundle** — the medium example's reproduced compiled bundle must contain zero duplicated skill bodies. Reviewed before publishing.
3. **Zero `[NEEDS CLARIFICATION]`** — already satisfied in the spec; must remain satisfied in the deliverable.
4. **Example-driven** — every language construct cited in FR-001 through FR-022 must appear in at least one of the three example programs.

Constitution Check: **PASS** (no defined principles to violate).

## Project Structure

### Documentation (this feature)

```text
specs/001-axon-language/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature spec (already produced by /speckit-specify)
├── research.md          # Phase 0 output — notational decisions
├── data-model.md        # Phase 1 output — Axon's conceptual entities and relations
├── quickstart.md        # Phase 1 output — "how to author and validate an Axon program"
├── contracts/           # Phase 1 output — extractable contracts the spec must contain
│   ├── grammar.ebnf         # Formal grammar (the developer ↔ compiler contract)
│   ├── bundle-format.md     # Bundle file schemas (the compiler ↔ runtime contract)
│   └── error-catalog.md     # The 10 compiler errors (the compiler ↔ developer contract)
└── checklists/
    └── requirements.md  # Quality checklist (already created)
```

### Source Code (repository root)

Because the deliverable is a documentation artifact, this project has no source code in the traditional sense. The "source" is the canonical spec document plus the example Axon programs used to validate it.

```text
docs/
└── axon/
    ├── spec.md                          # THE canonical Axon language spec — the primary deliverable
    ├── examples/
    │   ├── small/
    │   │   ├── greeter.ax
    │   │   └── main.axm
    │   ├── medium/
    │   │   ├── researchable.ax
    │   │   ├── research.ax
    │   │   ├── research_company.ax
    │   │   └── main.axm
    │   └── complex/
    │       ├── research.ax
    │       ├── research_company.ax
    │       ├── question_generator.ax
    │       ├── file_exporter.ax
    │       ├── email_sender.ax
    │       └── main.axm
    └── examples-compiled/
        └── medium/                      # Full byte-faithful compiled bundle for the medium example
            ├── _manifest.axc
            ├── main.axc                 # (medium has no main; this dir omits main.axc if so)
            ├── _fields/
            │   ├── Research.fields
            │   └── ResearchCompany.fields
            └── _skills/
                ├── Research.research.skill
                ├── Research.write_report.skill
                ├── ResearchCompany.gather_sources.skill
                ├── ResearchCompany.validate_sources.skill
                └── ResearchCompany.write_report.skill
```

**Structure Decision**: A single canonical spec document at `docs/axon/spec.md` with adjacent example sources under `docs/axon/examples/` and the reference compiled bundle under `docs/axon/examples-compiled/medium/`. The `specs/001-axon-language/` directory holds the spec-kit artifacts (requirements, plan, research, etc.) — it is **not** where the deliverable lives. Keeping the deliverable under `docs/` keeps it discoverable for future contributors who do not use spec-kit.

The medium example was chosen for full-bundle reproduction (per FR-040) because it exercises inheritance, abstract skill implementation, virtual override with `base.*`, and interface implementation — i.e., everything the DRY guarantees in FR-024 must demonstrate — without the noise of threading constructs.

## Complexity Tracking

No constitutional violations to justify. The deliverable is a single document plus example files; there is no multi-project complexity to track.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |
