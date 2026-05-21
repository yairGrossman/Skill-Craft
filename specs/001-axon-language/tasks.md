---
description: "Task list for Axon language specification"
---

# Tasks: Axon — OOP Language for Orchestrating LLM Agents

**Input**: Design documents from `specs/001-axon-language/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Deliverable**: `docs/axon/spec.md` — the canonical Axon language specification document — plus example source programs and the medium example's hand-compiled bundle.

**Note**: Tests are not requested. No test tasks are included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directory tree and spec skeleton so all subsequent writing has a target.

- [X] T001 Create docs directory structure: `docs/axon/`, `docs/axon/examples/small/`, `docs/axon/examples/medium/`, `docs/axon/examples/complex/`, `docs/axon/examples-compiled/medium/_fields/`, `docs/axon/examples-compiled/medium/_skills/`
- [X] T002 Create `docs/axon/spec.md` with 10 section-header skeleton (§1 Language overview through §10 Open questions), empty body under each header, per `specs/001-axon-language/quickstart.md` section order

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared spec sections — grammar, bundle format, compiler architecture, runtime contract, open questions — that all user stories depend on. Must be complete before story-specific sections are authored.

**⚠️ CRITICAL**: No user-story section work can begin until this phase is complete.

- [X] T003 [P] Author §1 Language overview in `docs/axon/spec.md`: Axon's vision (OOP for LLM orchestration), philosophy (static classes, free-speech logic, LLM as runtime), and comparison to traditional OOP (no instantiation, no constructors, semantics are LLM-driven); cite FR-032
- [X] T004 [P] Author §2 Formal grammar in `docs/axon/spec.md`: add 2-paragraph EBNF metasyntax preamble explaining ISO/IEC 14977 conventions (per research R1), then embed all ~35 production rules from `specs/001-axon-language/contracts/grammar.ebnf` verbatim; cite FR-033
- [X] T005 [P] Author §5 Compiler architecture in `docs/axon/spec.md`: describe each phase — Lexer (source text → token stream), Parser (tokens → AST), Resolver (AST + class graph → annotated AST), Validator (annotated AST → error list), Emitter (annotated AST → bundle directory) — with inputs, outputs, and responsibilities; implementation language is unspecified; cite FR-036
- [X] T006 [P] Author §7 Output bundle format in `docs/axon/spec.md`: embed full content of `specs/001-axon-language/contracts/bundle-format.md` — directory layout, `.fields` schema, `.skill` schema, `main.axc` schema, `_manifest.axc` schema, byte-equivalence checklist; cite FR-023, FR-024, FR-025, FR-026, FR-038
- [X] T007 [P] Author §8 Runtime contract in `docs/axon/spec.md`: specify what Claude does when given a bundle — (a) read `_manifest.axc` first to load class graph, (b) resolve `this.*` and `base.*` against manifest, (c) honor visibility at call-resolution time, (d) execute `parallel{}` as fire-and-forget concurrent agents, (e) execute `pipe(strategy:per_item)` as streaming and `pipe(strategy:on_complete)` as batch, (f) execute `main.axc` entry point or treat bundle as callable library if absent, (g) surface runtime errors in plain language; cite FR-030, FR-031
- [X] T008 [P] Author §10 Open questions / future extensions in `docs/axon/spec.md`: copy all deferred items from `specs/001-axon-language/spec.md` Open Questions section — overloading, positional arguments, cross-class field writes, field-level default expressions, generic classes, `uses`/`import`, multi-file `@main`, runtime error taxonomy, standard library; cite FR-041

**Checkpoint**: Foundation ready — all shared sections drafted; user story implementation can now begin.

---

## Phase 3: User Story 1 — Author and Run a Minimal Axon Program (Priority: P1) 🎯 MVP

**Goal**: Spec sections and example programs that let a developer write a one-class Axon program, understand the compiler output, and have Claude execute the bundle.

**Independent Test**: §3 and §4 cover class, fields, skills, visibility, @main, and call syntax; §9 contains `greeter.ax` + `main.axm` source listings and a full narrative of the expected bundle output; a developer reading only these sections can write the small example and understand what it compiles to.

### Implementation for User Story 1

- [X] T009 [P] [US1] Write `docs/axon/examples/small/greeter.ax`: one concrete class `Greeter` with one `fields {}` block declaring `@private last_greeting`, two `@public` skills — `greet(name)` with two instruction bullets and `recall` with one instruction bullet; match the canonical form from `specs/001-axon-language/quickstart.md`
- [X] T010 [P] [US1] Write `docs/axon/examples/small/main.axm`: `@main skill main` with two call instructions — `- call Greeter.greet(name: "Yair")` and `- call Greeter.recall`; match canonical form from `specs/001-axon-language/quickstart.md`
- [X] T011 [P] [US1] Author §3 Syntax reference (part 1) in `docs/axon/spec.md`: complete worked examples for every construct needed by US1 — `class` declaration, `fields {}` block and field declarations with visibility, `skill` declaration with and without parameters, literal defaults, `@public`/`@protected`/`@private` visibility modifiers, `this.*` member reference, `call` instruction prefix, cross-class call `ClassName.skill_name(param: value)`, `@main` skill in `.axm`, and `DottedReference` in argument-value position; each construct gets at least one complete Axon snippet; cite FR-034
- [X] T012 [P] [US1] Author §4 Semantic rules (part 1) in `docs/axon/spec.md`: numbered prose rules (template: Rule / Example / Compiler behavior) for — SR-1 visibility enforcement at every call site and field reference (cite FR-013, FR-014), SR-2 skill lookup order (own class → parent chain depth-first; cite FR-005), SR-3 instruction-bullet opacity (compiler treats bullet text as opaque; cite FR-018, research R7), SR-4 named-argument-only binding at call sites (cite FR-008, research R4), SR-5 literal-only defaults (string/integer/boolean; cite FR-011, research R5), SR-6 DottedReference classification (field read vs error; cite research R8), SR-7 implicit class resolution (no `uses`/`import`; cite FR-010), SR-8 library project validity (no `.axm` = valid; cite FR-021)
- [X] T013 [US1] Author §9 Example programs (part a) in `docs/axon/spec.md`: embed the small example — `greeter.ax` and `main.axm` source listings followed by a complete prose narrative of the expected bundle structure (`_manifest.axc` listing one concrete class with two skills, `_fields/Greeter.fields`, `_skills/Greeter.greet.skill`, `_skills/Greeter.recall.skill`, `main.axc`); cite FR-040
- [X] T014 [US1] Validate the small example against §2 grammar in `docs/axon/spec.md`: manually trace `greeter.ax` through the `ClassDecl → ClassBody → FieldsBlock → Skill` productions and `main.axm` through `MainDecl → SkillBody → Instruction → CallExpression` productions; confirm no parse errors; record outcome in a comment or note in `specs/001-axon-language/checklists/requirements.md`

**Checkpoint**: §1–§5 and §7–§10 drafted; §3/§4 cover US1 constructs; small example in §9 with bundle narrative; grammar-validates without error.

---

## Phase 4: User Story 2 — Class Hierarchy with Abstract Base, Concrete Child, and Interfaces (Priority: P2)

**Goal**: Spec sections and example programs that let a developer define an abstract class, a concrete child, and an interface; understand override modes, `base.*`, and interface contracts; and verify DRY guarantees in the compiled bundle.

**Independent Test**: §3 and §4 additions cover abstract class, interface, `extends`, `implements`, virtual/abstract/sealed override modes, and `base.*`; §9 contains the medium example source listings and the full hand-compiled bundle that demonstrates DRY; a developer can create `researchable.ax`, `research.ax`, and `research_company.ax`, compile them, and understand every file produced.

### Implementation for User Story 2

- [X] T015 [P] [US2] Write medium example source files: `docs/axon/examples/medium/researchable.ax` (interface `Researchable` with `@public skill research(topic)` signature), `docs/axon/examples/medium/research.ax` (abstract class `Research` with `@protected sources`, `@protected report`, `@private is_validated = false` fields; `@public default skill research(topic)` with three call bullets; `@protected abstract skill gather_sources(topic)`; `@protected abstract skill validate_sources`; `@protected virtual skill write_report`), `docs/axon/examples/medium/research_company.ax` (concrete `ResearchCompany extends Research implements Researchable` with own fields, `gather_sources` implementation, `validate_sources` implementation, `write_report` override using `base.write_report`), `docs/axon/examples/medium/main.axm` (calls `ResearchCompany.research(topic: "Apple Inc")`)
- [X] T016 [P] [US2] Author §3 Syntax reference (part 2) in `docs/axon/spec.md`: complete worked examples for — `abstract class` declaration, `interface` declaration (signatures only, no fields, no bodies), `extends` clause (single parent only), `implements` clause (one or more interfaces, comma-separated), `virtual` / `abstract` / `sealed` / `default` override-mode modifiers on skills, `base.*` super-call syntax in a skill body; use research.ax/research_company.ax snippets as illustrations; cite FR-034
- [X] T017 [P] [US2] Author §4 Semantic rules (part 2) in `docs/axon/spec.md`: numbered prose rules for — SR-9 inheritance resolution order (depth-first single-parent chain; cite FR-005), SR-10 override-mode compatibility (child may override virtual or abstract; sealed triggers E5; re-marking child with abstract/virtual triggers E8; cite FR-007), SR-11 abstract class invocation prohibition (abstract classes cannot be called from main; cite FR-002), SR-12 interface contract enforcement (class must provide @public skill for every required interface signature; cite FR-003, FR-004), SR-13 base.* resolution (walks ancestor chain for member; errors if class has no parent or member not found; cite FR-009), SR-14 visibility on override (child override visibility must be same or wider than parent; cite data-model.md Skill validation rules), SR-15 DRY bundle guarantee (inherited-but-not-overridden skills not re-emitted; fields stored once; cite FR-024)
- [X] T018 [US2] Hand-compile the medium example bundle at `docs/axon/examples-compiled/medium/`: produce `_manifest.axc` (per bundle-format §6 schema, with Research[abstract] and ResearchCompany[concrete] class entries and Researchable interface), `_fields/Research.fields`, `_fields/ResearchCompany.fields`, [abstract skills emit no file per §7.1.2], `_skills/Research.research.skill`, `_skills/Research.write_report.skill`, `_skills/ResearchCompany.gather_sources.skill`, `_skills/ResearchCompany.validate_sources.skill`, `_skills/ResearchCompany.write_report.skill`, `main.axc`; strictly follow `specs/001-axon-language/contracts/bundle-format.md` — UTF-8, LF-only, two-space indent, single space after `:`, source order for fields, lexicographic order for classes/skills in manifest; verified NO ResearchCompany.research.skill exists (DRY guarantee)
- [X] T019 [US2] Author §9 Example programs (part b) in `docs/axon/spec.md`: embed the medium example — source listings for all four files followed by the full compiled bundle reproduced verbatim (all nine output files, exactly as written in `docs/axon/examples-compiled/medium/`); add a callout paragraph highlighting that `ResearchCompany.research` has no skill file of its own (pointing to parent's file instead) as the concrete demonstration of FR-024 DRY; cite FR-040, SC-007
- [X] T020 [P] [US2] Validate medium example DRY guarantee: confirm `docs/axon/examples-compiled/medium/` contains no `_skills/ResearchCompany.research.skill`; verify no skill body content appears verbatim in more than one `.skill` file; trace medium example against §2 grammar; record outcome in `specs/001-axon-language/checklists/requirements.md`

**Checkpoint**: §3/§4 cover all inheritance and interface constructs; medium example in §9 with full byte-faithful bundle; DRY guarantee verified.

---

## Phase 5: User Story 3 — Orchestrate Multiple Agents with Threading and Composition (Priority: P2)

**Goal**: Spec sections and example programs that let a developer write a `main.axm` with `parallel{}` and `pipe(strategy:...){}` blocks, understand how implicit class resolution works, and see how the LLM runtime executes concurrent workflows.

**Independent Test**: §3 and §4 additions cover `parallel`, both `pipe` strategies, and implicit composition; §9 contains the complex example source listings with a narrative of the threading semantics; a developer can write a multi-class main and know exactly what the compiled bundle encodes.

### Implementation for User Story 3

- [X] T021 [P] [US3] Write complex example source files: `docs/axon/examples/complex/research.ax` (abstract class, same shape as medium but adapted for complex scenario), `docs/axon/examples/complex/research_company.ax` (concrete child), `docs/axon/examples/complex/question_generator.ax` (class with `@public skill generate_questions(topic, amount = 10)`), `docs/axon/examples/complex/file_exporter.ax` (class with `@public skill export_to_pdf(content, filename)`), `docs/axon/examples/complex/email_sender.ax` (class with `@public skill send(recipient, subject, body)`), `docs/axon/examples/complex/main.axm` (`@main skill main` that calls `ResearchCompany.research(topic: "Apple Inc")` sequentially, then a `parallel{}` block with `FileExporter.export_to_pdf` and `EmailSender.send` calls, with argument values drawn from `ResearchCompany.report` via DottedReference)
- [X] T022 [P] [US3] Author §3 Syntax reference (part 3) in `docs/axon/spec.md`: complete worked examples for `parallel { }` block (fire-and-forget concurrent calls, no shared state between branches), `pipe(strategy: per_item) { }` block (streaming, consumer receives items as produced), `pipe(strategy: on_complete) { }` block (batch, consumer waits for producer to finish), implicit composition (no `uses`/`import` declaration; all `ClassName.skill_name(...)` references resolved project-wide); cite FR-015, FR-016, FR-034
- [X] T023 [P] [US3] Author §4 Semantic rules (part 3) in `docs/axon/spec.md`: numbered prose rules for — SR-16 parallel semantics (each branch is an independent fire-and-forget agent with no shared intermediate state; developer is responsible for avoiding shared mutation; cite FR-015, FR-017), SR-17 pipe per_item semantics (consumer executes once per item emitted by producer; cite FR-016), SR-18 pipe on_complete semantics (consumer executes once after producer finishes; cite FR-016), SR-19 multi-stage pipe (strategy applies pairwise between consecutive stages; from spec.md assumptions), SR-20 implicit project-wide composition (compiler discovers all `.ax` files and resolves `ClassName` references automatically; cite FR-010, FR-022), SR-21 threading blocks in any skill body (threading blocks allowed in any skill, not only @main; desugars identically; from data-model.md MainSkill note)
- [X] T024 [US3] Author §9 Example programs (part c) in `docs/axon/spec.md`: embed the complex example — source listings for all six files followed by a prose narrative explaining how Claude executes the bundle: the sequential call, the parallel block (two agents launched simultaneously), and the DottedReference argument values resolved at runtime from the manifest; cite FR-040
- [X] T025 [P] [US3] Validate complex example against §2 grammar in `docs/axon/spec.md`: trace `parallel { }` through `ParallelBlock` production and `pipe(...)` through `PipeBlock` production; confirm each call inside threading blocks parses as `Instruction → OpaqueLine → CallExpression → CrossCall`; record outcome in `specs/001-axon-language/checklists/requirements.md`

**Checkpoint**: §3/§4 cover all threading constructs; complex example in §9 with threading narrative; grammar-validates without error.

---

## Phase 6: User Story 4 — Receive Precise, Actionable Compiler Errors (Priority: P3)

**Goal**: The error catalog section of the spec, covering all 10 compiler errors, so a developer can self-correct without consulting the spec author.

**Independent Test**: A developer reading only §6 can identify, for each of the 10 errors, (a) what source code triggers it, (b) the exact 4-element error message format, and (c) at least one valid fix — without consulting any other section.

### Implementation for User Story 4

- [X] T026 [US4] Author §6 Compiler error catalog in `docs/axon/spec.md`: embed the common message format (4 elements: file path, line+column, human-readable message, suggested fix) and all 10 errors E1–E10 from `specs/001-axon-language/contracts/error-catalog.md` verbatim — each error with its trigger example, exact message format, and suggested fix; include the note that the compiler emits all errors before exiting non-zero and writes no partial bundle; cite FR-027, FR-028, FR-029, FR-037
- [X] T027 [P] [US4] Verify §6 completeness against SC-003 and SC-008: confirm all 10 FR-027 error types are present; confirm each entry has an example source snippet, an error message containing all 4 required elements, and a suggested fix; record pass/fail for each error in `specs/001-axon-language/checklists/requirements.md`

**Checkpoint**: All four user stories have their spec sections; all 10 errors catalogued with full message format.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final coverage validation, FR traceability, and quality checks across the entire deliverable.

- [ ] T028 Build FR coverage matrix in `specs/001-axon-language/checklists/requirements.md`: for every functional requirement FR-001 through FR-041, record which section of `docs/axon/spec.md` satisfies it; flag any FR with no section mapped; fix any gaps before marking complete
- [ ] T029 [P] Scan `docs/axon/spec.md` for `[NEEDS CLARIFICATION]` markers: zero must remain; fix any found by consulting the relevant research decision (R1–R10) or data-model.md
- [ ] T030 [P] Verify construct coverage in `docs/axon/spec.md`: confirm every language construct from FR-001 through FR-022 appears in at least one of the three example programs in §9 (class, abstract class, interface, extends, implements, four override modes, three visibility modifiers, fields, this.*, base.*, cross-class call, parallel, per_item pipe, on_complete pipe, @main, .ax and .axm extensions); record in coverage matrix
- [ ] T031 [P] Reviewer byte-equivalence check for `docs/axon/examples-compiled/medium/`: re-derive the medium bundle independently from §7 of `docs/axon/spec.md` alone (without looking at the existing `examples-compiled/medium/` directory); compare every file byte-by-byte; confirm they are identical; record outcome in `specs/001-axon-language/checklists/requirements.md` — this validates SC-004 proxy and FR-038 precision

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 → T002 (sequential)
- **Foundational (Phase 2)**: Depends on Phase 1 (T001, T002) — **BLOCKS** all user story phases; T003–T008 can run in parallel with each other
- **User Stories (Phases 3–6)**: All depend on Foundational completion
  - US1 (Phase 3) is P1 — start first
  - US2 and US3 (Phases 4–5) are both P2 — can run in parallel with each other after US1 is done, or after Foundational if staffed
  - US4 (Phase 6) is P3 — start after US1/US2/US3 are complete
- **Polish (Phase 7)**: Depends on all six phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — no dependency on other stories
- **US2 (P2)**: Depends on Foundational — T018 (hand-compile bundle) depends on T015 (source files); T019 depends on T018
- **US3 (P2)**: Depends on Foundational — T024 depends on T021; independent of US2
- **US4 (P3)**: Depends on Foundational — T027 validates T026; independent of US1–US3 sections

### Within Each User Story

- Source files before validation tasks (T009/T010 before T014; T015 before T020; T021 before T025)
- Syntax reference and semantic rules sections [P] (different spec sections)
- Hand-compile bundle (T018) before spec embed (T019)
- All story implementation tasks before coverage validation (T028–T031)

### Parallel Opportunities

- T003–T008 (Foundational sections): all [P] — six sections in six different parts of the spec
- T009 and T010 (small example sources): [P] — two different files
- T011 and T012 (§3/§4 part 1): [P] — two different spec sections
- T015 (medium sources) and T016/T017 (§3/§4 part 2): T016 and T017 can start as T015 is being written
- T020, T022, T023, T025 within Phases 4–5: all [P] markers within their phase
- T028–T031 (Polish): T029, T030, T031 all [P]

---

## Parallel Example: Phase 2 Foundational

```text
# All six foundational sections can be authored simultaneously:
T003: §1 Language overview
T004: §2 Formal grammar (embed grammar.ebnf)
T005: §5 Compiler architecture
T006: §7 Output bundle format (embed bundle-format.md)
T007: §8 Runtime contract
T008: §10 Open questions (copy from spec.md)
```

## Parallel Example: User Story 1

```text
# Source files in parallel:
T009: docs/axon/examples/small/greeter.ax
T010: docs/axon/examples/small/main.axm

# Spec sections in parallel:
T011: §3 Syntax reference (part 1)
T012: §4 Semantic rules (part 1)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T008) — CRITICAL, blocks everything
3. Complete Phase 3: User Story 1 (T009–T014)
4. **STOP and VALIDATE**: Can a developer read §§1–5, 7–10 and the small example in §9, then write and understand a one-class Axon program?
5. If yes, the core spec value is deliverable.

### Incremental Delivery

1. Setup + Foundational → shared skeleton ready
2. Add US1 (P1) → small example + basic constructs → validate → deliverable as "minimal spec"
3. Add US2 (P2) → inheritance/interfaces + medium example with DRY bundle → validate
4. Add US3 (P2) → threading/composition + complex example → validate
5. Add US4 (P3) → error catalog → validate → full spec complete

### Parallel Team Strategy

With multiple contributors:

1. Team completes Setup + Foundational together (or in parallel per section)
2. Once Foundational is done:
   - Contributor A: US1 (small example + §3/§4 part 1)
   - Contributor B: US2 (medium example + hand-compiled bundle + §3/§4 part 2)
   - Contributor C: US3 (complex example + §3/§4 part 3)
3. US4 (error catalog) added last; Polish phase done together

---

## Notes

- [P] tasks = different files or different spec sections; no dependencies between them
- [US1]–[US4] labels map tasks to the four user stories for traceability
- This project's deliverable is a documentation artifact, not compiled code; "implementation" = authoring spec sections and example files
- The spec sections can be authored independently but the final spec must read as a coherent whole — review for tone and cross-reference consistency during Polish
- Each example program must be validated against the §2 grammar before the story is marked complete
- The hand-compiled medium bundle (T018) is load-bearing: it is the byte-level proof of the DRY guarantee (SC-007) and the bundle-format precision check (SC-004 proxy)
- Commit after each phase checkpoint to preserve incremental progress
