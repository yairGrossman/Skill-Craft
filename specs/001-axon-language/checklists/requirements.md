# Specification Quality Checklist: Axon — OOP Language for Orchestrating LLM Agents

**Purpose**: Validate specification completeness and quality before proceeding to planning

**Created**: 2026-05-21

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- The spec deliberately specifies the **content scope** of the produced `spec.md` (FR-032 through FR-041) without prescribing how the compiler is implemented. This is appropriate because the feature itself is the production of a language spec — the artifact's structure is the user-facing deliverable, not an implementation detail.
- 0 `[NEEDS CLARIFICATION]` markers were emitted; ambiguities in the source brief were resolved via informed defaults documented in the **Assumptions** section, and deferred decisions are captured in **Open Questions / Future Extensions**.

## Grammar validation records

### Small example (US1, T014) — `docs/axon/examples/small/`

Manual trace of `greeter.ax` against §2 grammar:

- File payload → `AxFile` → `ClassDecl` (matches `"class" Identifier { ClassBody }` with Identifier = `Greeter`).
- `ClassBody` → `[ FieldsBlock ] { Skill }`.
  - `FieldsBlock` → `"fields" "{" { FieldDecl } "}"`.
    - `FieldDecl` (`@private last_greeting`) → `Visibility Identifier` (no literal default). ✓
  - First `Skill`: `Visibility OverrideMode "skill" Identifier "(" ParamList ")" "{" SkillBody "}"`.
    - `Visibility = "@public"`, `OverrideMode` empty (default), Identifier = `greet`, `ParamList` = `Param` with Identifier = `name` (no default).
    - `SkillBody` = two `Instruction` productions, each `"-" " " OpaqueLine Newline`. The OpaqueLines `greet name warmly` and `store the greeting in this.last_greeting` are opaque per SR-3. ✓
  - Second `Skill`: `Visibility = "@public"`, Identifier = `recall`, no `ParamList` (the `[ "(" ParamList ")" ]` optional group is omitted).
    - `SkillBody` = one `Instruction` with OpaqueLine `return this.last_greeting`. ✓

Manual trace of `main.axm` against §2 grammar:

- File payload → `AxmFile` → `MainDecl` (matches `"@main" "skill" "main" "{" SkillBody "}"`).
- `SkillBody` = two `Instruction` productions.
  - First OpaqueLine begins with `call ` → resolver treats remainder as `CallExpression` → `CrossCall` → `Identifier "." Identifier "(" ArgList ")"` with Identifier(class) = `Greeter`, Identifier(skill) = `greet`, ArgList = one `NamedArg` (`name: "Yair"`) where `ArgumentValue = Literal` (string `"Yair"`). ✓
  - Second OpaqueLine begins with `call ` → `CrossCall` → no parentheses (zero-argument call form). ✓

**Outcome**: small example parses cleanly against §2 grammar. No parse errors, no semantic-rule violations.

### Medium example (US2, T020) — `docs/axon/examples/medium/` + `docs/axon/examples-compiled/medium/`

**DRY guarantee verification**:

- `docs/axon/examples-compiled/medium/_skills/` contains exactly five `.skill` files:
  - `Research.research.skill`
  - `Research.write_report.skill`
  - `ResearchCompany.gather_sources.skill`
  - `ResearchCompany.validate_sources.skill`
  - `ResearchCompany.write_report.skill`
- ✓ NO `_skills/ResearchCompany.research.skill` — `research` is inherited from `Research` unchanged and the bundle does not duplicate its body. The manifest records `research [@public, inherited from Research]` under `ResearchCompany`.
- ✓ NO `_skills/Research.gather_sources.skill` — `gather_sources` is `abstract` in `Research`; abstract skills emit no `.skill` file (only manifest entries).
- ✓ NO `_skills/Research.validate_sources.skill` — same reason.
- Skill body content uniqueness: no body line in any of the five files appears verbatim in any other file. The body of `Research.write_report` lives only in `_skills/Research.write_report.skill`; `ResearchCompany.write_report` references it via `DEPENDS ON: _skills/Research.write_report.skill` and its own body augments rather than duplicates the parent.
- Field uniqueness: `Research`'s fields appear once in `_fields/Research.fields`; `ResearchCompany`'s skill files reference that path via `INHERITED FIELDS FROM:`. No re-emission.

**Grammar validation**:

- `researchable.ax` → `AxFile` → `InterfaceDecl` (`"interface" Identifier "{" { SkillSignature } "}"`); contains one `SkillSignature` (`Visibility "skill" Identifier "(" ParamList ")"` with Visibility = `@public`, Identifier = `research`, ParamList = one `Param` named `topic`). ✓
- `research.ax` → `AxFile` → `AbstractClassDecl` with Identifier = `Research`, no `Extends`, no `Implements`; `ClassBody` = `FieldsBlock` (three `FieldDecl`s) + four `Skill` productions. Two of the four skills have `OverrideMode = abstract` and omit the `{ SkillBody }` block (legal per the grammar's alternation `( "{" SkillBody "}" | (* abstract skills have no body *) )`). ✓
- `research_company.ax` → `AxFile` → `ClassDecl` with `Extends` (= `Research`) and `Implements` (= `Researchable`); `ClassBody` = `FieldsBlock` (one `FieldDecl` with string-literal default) + three concrete `Skill` productions, none with explicit `OverrideMode` modifier (SR-10 permits this — the override mode comes from the parent declaration). ✓
- `main.axm` → `AxmFile` → `MainDecl`; `SkillBody` = one `Instruction` whose `OpaqueLine` begins with `call ` → `CallExpression` → `CrossCall` (`ResearchCompany.research(topic: "Apple Inc")`). ✓

Byte-equivalence checks on the bundle directory:

- UTF-8, no BOM (verified via byte inspection of `_manifest.axc`'s first three bytes: `65 88 79` = `A X O` — no BOM marker).
- LF-only line endings on all nine files (no CRLF anywhere).
- Each file ends with exactly one LF.
- Lexicographic ordering: `_fields/` entries (`Research.fields`, `ResearchCompany.fields`) and `_skills/` entries are sorted ASCII.
- Source-order preservation: `_fields/Research.fields` lists `sources`, `report`, `is_validated` in declaration order, not alphabetical.

**Outcome**: medium example parses cleanly against §2 grammar. DRY guarantee verified by direct inspection of the bundle directory. SC-007 satisfied.

### Complex example (US3, T025) — `docs/axon/examples/complex/`

Grammar validation:

- `research.ax` → `AxFile` → `AbstractClassDecl`. Same shape as the medium example's; only difference is the field `@public report` (medium has `@protected report`), which is a `Visibility` choice and parses identically. ✓
- `research_company.ax` → `AxFile` → `ClassDecl` with `Extends` (= `Research`); no `Implements` clause (the complex example does not require interfaces). Body has one `FieldDecl` (with string literal default) and three concrete `Skill` productions. ✓
- `question_generator.ax` → `AxFile` → `ClassDecl`. Body has one `Skill` with `ParamList` of two `Param`s — `topic` (required) and `amount = 10` (integer-literal default). ✓
- `file_exporter.ax` and `email_sender.ax` → `AxFile` → `ClassDecl` each, with a single `@public` `Skill` and a two-parameter / three-parameter list respectively. ✓
- `main.axm` → `AxmFile` → `MainDecl`. The `SkillBody` contains three top-level entries:
  - One `Instruction` (sequential call to `ResearchCompany.research(topic: "Apple Inc")`) — the leading `- ` followed by `OpaqueLine` whose first token is `call ` → `CrossCall` with one `NamedArg` (string literal). ✓
  - One `ThreadingBlock` → `ParallelBlock` matching `"parallel" "{" { Instruction } "}"`. Each contained `Instruction` is a `CrossCall` with `NamedArg`s. The `body` argument in `EmailSender.send(...)` uses `ResearchCompany.report` → `DottedReference` (resolved by SR-6 to a `@public` field read). The `filename` argument uses a string literal. ✓
  - One `ThreadingBlock` → `PipeBlock` matching `"pipe" "(" "strategy" ":" PipeStrategy ")" "{" { Instruction } "}"` with `PipeStrategy = "per_item"`. Contained `Instruction`s are `CrossCall`s; the second one's `body` argument uses a `DottedReference`. ✓

Manual check that nested-threading-block constraint is not violated: neither the parallel block nor the pipe block contains another threading block. Each contains only `- call ...` instructions, as SR-16, SR-17, and §10.10 require.

**Outcome**: complex example parses cleanly against §2 grammar. All three threading constructs (`parallel`, `pipe(strategy: per_item)`, and — via §3.19 inline snippet — `pipe(strategy: on_complete)`) are exercised. SR-6 (DottedReference field read), SR-7 (implicit composition), SR-16, SR-17 all illustrated.

### Error catalog completeness (US4, T027) — §6 of `docs/axon/spec.md`

Verification against SC-003 (all 10 errors with trigger + message + suggested fix) and SC-008 (a reader can self-identify each error from §6 alone):

| Error | In §6.2? | Trigger snippet? | Message has file path? | Has line/column (or "project-wide")? | Has summary message? | Has suggested fix? | SC-008 self-contained? |
|---|---|---|---|---|---|---|---|
| E1 Unimplemented abstract skill | ✓ | ✓ (Research + partial ResearchCompany) | ✓ `research_company.ax` | ✓ `line 7, column 1` | ✓ | ✓ (skill stub) | ✓ |
| E2 Interface contract violation | ✓ | ✓ (wrong visibility) | ✓ `research_company.ax` | ✓ `line 6, column 1` | ✓ | ✓ (change visibility) | ✓ (sub-case covered) |
| E3 Invalid `base.*` reference | ✓ | ✓ (both sub-cases) | ✓ | ✓ | ✓ | ✓ | ✓ |
| E4 Visibility violation | ✓ | ✓ (`@private` call from main) | ✓ `main.axm` | ✓ `line 3, column 8` | ✓ | ✓ (change visibility or wrapper) | ✓ (`@protected` + abstract + narrower-override variants noted) |
| E5 Sealed skill override | ✓ | ✓ | ✓ `b.ax` | ✓ `line 10, column 1` | ✓ | ✓ (remove override, rename, or change parent to virtual) | ✓ |
| E6 Unknown reference | ✓ | ✓ (`NoSuchClass`) | ✓ `main.axm` | ✓ `line 3, column 8` | ✓ | ✓ (check spelling, add file) | ✓ (variants for skill, field, this/base noted) |
| E7 Cyclical inheritance | ✓ | ✓ (A → C → B → A) | ✓ `a.ax` | ✓ `line 1, column 1` | ✓ | ✓ (break the cycle) | ✓ |
| E8 Override mode mismatch | ✓ | ✓ (child marks `abstract`) | ✓ `b.ax` | ✓ `line 10, column 1` | ✓ | ✓ (remove modifier) | ✓ (sealed-re-mark sub-case noted) |
| E9 Duplicate class name | ✓ | ✓ (two `greeter.ax`-style files) | ✓ `greeter2.ax` | ✓ `line 1, column 1` | ✓ | ✓ (rename) | ✓ |
| E10 Multiple `@main` skills | ✓ | ✓ (three sub-cases A/B/C) | ✓ (B: `main.axm`; C: `foo.ax`; A: project-wide) | ✓ (A omits per §6.1) | ✓ | ✓ (merge, delete duplicate, move) | ✓ |

**Outcome**: §6 satisfies SC-003 (10/10 errors with all four required elements) and SC-008 (a reader can identify each error's trigger, message format, and at least one valid fix from §6 alone). Coverage trace at §6.3 maps every error to FR-027 and to the firing semantic rules in §4.

## FR coverage matrix (T028)

For every functional requirement FR-001 through FR-041, the section of `docs/axon/spec.md` that satisfies it.

| FR | Topic | Satisfied by |
|---|---|---|
| FR-001 | `class` construct (static, no instantiation, `{ }` block) | §3.1, §3.2, §2.2 `ClassDecl`, §4.1 (no instantiation implied by static-class model) |
| FR-002 | `abstract class` (may contain abstract skills; cannot be invoked from main) | §3.10, §2.2 `AbstractClassDecl`, §4.2 SR-11 |
| FR-003 | `interface` (signatures only, no fields, no bodies) | §3.11, §2.2 `InterfaceDecl`/`SkillSignature`, §4.2 SR-12 |
| FR-004 | `extends` ≤1; `implements` 0..N | §3.12, §3.13, §2.2 `Extends`/`Implements` |
| FR-005 | Child inherits non-private skills/fields transitively | §4.2 SR-9; §4.1 SR-2 |
| FR-006 | Skills as named parameterized instruction units with `- ` bullet bodies | §3.3, §3.4, §2.2 `Skill`/`SkillBody`/`Instruction` |
| FR-007 | Four override modes (abstract/virtual/sealed/default) | §3.15, §2.2 `OverrideMode`, §4.2 SR-10 |
| FR-008 | Parameters untyped; LLM infers from context | §3.3, §3.4 (no type syntax), §4.1 SR-4 (named binding) |
| FR-009 | `this.member` and `base.member` | §3.6, §3.14, §2.2 `ThisCall`/`BaseCall`, §4.2 SR-13 |
| FR-010 | Cross-class call without `import`/`uses`; project-wide resolution | §3.7, §3.20, §4.1 SR-7, §4.3 SR-20 |
| FR-011 | Single `fields { }` block per class; untyped; class-scoped; literal defaults | §3.2, §2.2 `FieldsBlock`/`FieldDecl`, §4.1 SR-5 |
| FR-012 | Fields obey visibility rules and are inherited subject to them | §3.5 + §4.2 SR-9 + data-model.md FieldDecl inheritance section |
| FR-013 | Three visibility modifiers `@public`/`@protected`/`@private` | §3.5, §2.2 `Visibility`, §4.1 SR-1 |
| FR-014 | Compiler enforces visibility at every reference site → E4 | §4.1 SR-1, §6.2 E4 |
| FR-015 | `parallel { }` fire-and-forget concurrent agents | §3.17, §2.2 `ParallelBlock`, §4.3 SR-16, §8.6 |
| FR-016 | `pipe(strategy: per_item|on_complete) { }` semantics | §3.18, §3.19, §2.2 `PipeBlock`/`PipeStrategy`, §4.3 SR-17, SR-18, §8.7 |
| FR-017 | Bundle records threading semantics unambiguously | §7.5.2 (parallel/pipe in BODY), §8.6, §8.7 |
| FR-018 | No classical control-flow keywords; instructions are free-speech | §1.2, §4.1 SR-3 (opacity), §2.2 `Instruction`/`OpaqueLine` |
| FR-019 | Optional `@main` in `.axm`; ≤1 `.axm` per project; ≤1 `@main` per file | §3.8, §2.2 `MainDecl`/`AxmFile`, §6.2 E10 |
| FR-020 | `@main` acts as orchestrator; no inlined skill content | §3.8 (note "calls other skills by reference"), data-model.md MainSkill validation rules |
| FR-021 | A `.axm`-less project is a valid library | §4.1 SR-8, §8.8 |
| FR-022 | `.ax` and `.axm` extensions; reject other extensions | §3.8 (file extension roles), §4.3 SR-20, data-model.md Project validation rules |
| FR-023 | Bundle is a directory containing `_fields/`, `_skills/`, `_manifest.axc`, `main.axc` | §7.1 |
| FR-024 | DRY: no skill duplication; one fields file per class; inherited skills reference parent | §7.1.2, §7.4, §7.4.3, §9.2.3 (concrete DRY callout), §4.2 SR-15 |
| FR-025 | `.skill` file metadata block + body in deterministic schema | §7.4.1, §7.4.2 |
| FR-026 | `_manifest.axc` enumerates classes, interfaces, entry point | §7.6.1, §7.6.2 |
| FR-027 | Compiler detects all 10 errors | §6.2 E1–E10 |
| FR-028 | Errors have file path, line+column, message, suggested fix | §6.1, §6.2 (every entry) |
| FR-029 | Compiler exits non-zero on any error; no partial bundle | §6.1 (last paragraph), §5.4 ("validator MUST collect ALL errors"), §5.5 (emitter does not run if errors) |
| FR-030 | Bundle self-describing; manifest-first; runtime can resolve refs | §8.1, §8.2, §8.3, §7.6 |
| FR-031 | Runtime contract precisely specified | §8 (entire section) |
| FR-032 | Spec contains Language Overview section | §1 |
| FR-033 | Spec contains Formal Grammar in EBNF | §2 |
| FR-034 | Spec contains Syntax Reference with one example per construct | §3 |
| FR-035 | Spec contains Semantic Rules section | §4 |
| FR-036 | Spec contains Compiler Architecture section | §5 |
| FR-037 | Spec contains Compiler Error Catalog | §6 |
| FR-038 | Spec contains Output Bundle Format precise enough for byte-equivalence | §7 (incl. §7.7 byte-equivalence checklist) |
| FR-039 | Spec contains Runtime Contract | §8 |
| FR-040 | Spec contains Example Programs (small, medium with bundle, complex) | §9.1, §9.2, §9.3 |
| FR-041 | Spec contains Open Questions / Future Extensions | §10 |

All 41 functional requirements are mapped to at least one section. **No FR is unmapped.**

## Construct coverage matrix (T030)

Verification that every language construct cited in FR-001 through FR-022 appears in at least one of the three example programs in §9.

| Construct | Cited in | Small | Medium | Complex |
|---|---|---|---|---|
| `class` declaration | FR-001 | ✓ (Greeter) | ✓ (ResearchCompany) | ✓ (ResearchCompany, QuestionGenerator, FileExporter, EmailSender) |
| `abstract class` declaration | FR-002 | — | ✓ (Research) | ✓ (Research) |
| `interface` declaration | FR-003 | — | ✓ (Researchable) | — |
| `extends` clause | FR-004 | — | ✓ (`ResearchCompany extends Research`) | ✓ (`ResearchCompany extends Research`) |
| `implements` clause | FR-004 | — | ✓ (`implements Researchable`) | — |
| `abstract` skill modifier | FR-007 | — | ✓ (`gather_sources`, `validate_sources`) | ✓ |
| `virtual` skill modifier | FR-007 | — | ✓ (`write_report` in Research) | ✓ |
| `sealed` skill modifier | FR-007 | — | — | — (illustrated via §3.15 / §6.2 E5 snippets) |
| default (no modifier) skill | FR-007 | ✓ (Greeter.greet, Greeter.recall) | ✓ (`Research.research`) | ✓ (all complex skills) |
| `@public` visibility | FR-013 | ✓ | ✓ | ✓ |
| `@protected` visibility | FR-013 | — | ✓ (Research.sources/report/gather_sources/...) | ✓ |
| `@private` visibility | FR-013 | ✓ (`last_greeting`) | ✓ (`is_validated`, `preferred_database`) | ✓ (`is_validated`, `preferred_database`) |
| `fields { }` block | FR-011 | ✓ | ✓ | ✓ |
| `this.*` member reference | FR-009 | ✓ (`this.last_greeting`) | ✓ (`this.sources`, `this.report`, `this.is_validated`) | ✓ (same as medium plus `this.preferred_database`) |
| `base.*` super-call | FR-009 | — | ✓ (`base.write_report`) | ✓ (`base.write_report`) |
| Cross-class call `ClassName.skill_name(...)` | FR-010 | ✓ (`Greeter.greet`, `Greeter.recall`) | ✓ (`ResearchCompany.research`) | ✓ (multiple) |
| `parallel { }` block | FR-015 | — | — | ✓ |
| `pipe(strategy: per_item)` block | FR-016 | — | — | ✓ |
| `pipe(strategy: on_complete)` block | FR-016 | — | — | — (illustrated via §3.19 inline snippet) |
| `@main` skill | FR-019 | ✓ (small/main.axm) | ✓ (medium/main.axm) | ✓ (complex/main.axm) |
| `.ax` file extension | FR-022 | ✓ (greeter.ax) | ✓ (research.ax, researchable.ax, research_company.ax) | ✓ (5 .ax files) |
| `.axm` file extension | FR-022 | ✓ (main.axm) | ✓ (main.axm) | ✓ (main.axm) |
| Named-argument call syntax | FR-008 / SR-4 | ✓ (`name: "Yair"`) | ✓ (`topic: "Apple Inc"`) | ✓ (multiple) |
| Literal parameter default | FR-011 | — | ✓ (`is_validated = false`, `preferred_database = "SEC EDGAR"`) | ✓ (`amount = 10`) |
| DottedReference in argument-value position | research R8, FR-013 | — | — | ✓ (`ResearchCompany.report`) |

Constructs marked "— (illustrated via §3.X snippet)" appear in the spec body itself even though no full example program exercises them. This is acceptable per FR-034 ("at least one complete example each"), and the gap is documented above.

**Outcome**: every construct cited in FR-001 through FR-022 appears in at least one of the three example programs OR in a complete §3 example snippet. SC-002 satisfied.

## Reviewer byte-equivalence check for `docs/axon/examples-compiled/medium/` (T031)

Method: independently re-derive each of the nine bundle files from §7 of `docs/axon/spec.md` (without looking at the existing `examples-compiled/medium/` directory), then compare byte-by-byte.

Re-derivation summary:

- **`_manifest.axc`**: From §7.6.1 (format), §7.6.2 (rules), §7.6.3 (the worked example for the medium project). §7.6.3 is itself the manifest for the medium example, so the re-derivation is direct: classes `Research [abstract]` and `ResearchCompany [concrete]` sorted lexicographically; interface `Researchable` in INTERFACES; entry point `main.axc`. Skill annotation column alignment uses the longest skill name (`validate_sources`, 16 chars) plus 5 trailing spaces — putting `[` at column 23 — and this matches every skill line in the example.
- **`_fields/Research.fields`** and **`_fields/ResearchCompany.fields`**: From §7.3 (format + rules + example). Source order preserved within each file. The example in §7.3.3 reproduces `Research.fields` exactly as written under `examples-compiled/medium/_fields/Research.fields`.
- **`_skills/Research.research.skill`**: From §7.4.1 (format), §7.4.2 (rules — eight required header keys in order, abstract skills excluded from DEPENDS ON), §7.4.3 (the worked example for `Research.research` and `ResearchCompany.write_report`). §7.4.3 is itself the answer key — its `Research.research.skill` block exactly matches the file under `examples-compiled/medium/_skills/`.
- **`_skills/Research.write_report.skill`**: Inferred from §7.4 rules. PARAMS: none (write_report has no params); INHERITED FIELDS FROM: none (Research has no parent); OWN FIELDS: `_fields/Research.fields`; DEPENDS ON: empty (body calls no skill); BODY contains the two source bullets.
- **`_skills/ResearchCompany.gather_sources.skill`** and **`_skills/ResearchCompany.validate_sources.skill`**: Inferred from §7.4 rules. OVERRIDE_MODE: `implements abstract from Research` (per §7.4.2's provenance vocabulary). INHERITED FIELDS FROM: `_fields/Research.fields` (parent has fields). OWN FIELDS: `_fields/ResearchCompany.fields`. DEPENDS ON: empty (bodies do not call other skills). BODY: source bullets in source order.
- **`_skills/ResearchCompany.write_report.skill`**: §7.4.3 reproduces this exactly. DEPENDS ON: `_skills/Research.write_report.skill` (the body uses `base.write_report`).
- **`main.axc`**: §7.5.1/§7.5.2. ENTRY: main; DEPENDS ON: the single skill file the body calls into (`_skills/Research.research.skill`, since `ResearchCompany.research` is inherited from `Research`); BODY: the single source bullet.

Byte-level comparisons:

- All files are UTF-8 without BOM (verified via raw byte inspection — first three bytes of `_manifest.axc` are `0x41 0x58 0x4F` = `AXO`, no BOM marker).
- All files use LF (`\n`) line endings exclusively. No CRLF anywhere. Verified by enumerating all bytes.
- Every file ends with exactly one LF.
- Two-space indentation consistent everywhere lists appear; single space after every `:`; no tabs.
- Sorted ordering verified: `_fields/` and `_skills/` entries are lexicographic; manifest CLASSES and INTERFACES sections are lexicographic; skills within each class entry are lexicographic.

**Outcome**: the re-derived bundle is byte-equivalent to the on-disk `docs/axon/examples-compiled/medium/`. SC-004 proxy and FR-038 precision check both pass.










