# Feature Specification: Axon — OOP Language for Orchestrating LLM Agents

**Feature Branch**: `001-axon-language`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "Build the specification for a new programming language called Axon. Axon is an object-oriented programming language designed to orchestrate LLM agents (specifically Claude). It applies classical OOP concepts — classes, inheritance, encapsulation, abstraction, interfaces, threading — to prompt engineering. The compiler is classical code. The runtime is an LLM that reads the compiled output and executes the resulting skills."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Author and run a minimal Axon program (Priority: P1)

A developer wants to wrap a single piece of LLM behavior (e.g., "greet a person and remember the greeting") as a reusable, named unit, then invoke it from an entry point. They write one class file (`.ax`) and one main file (`.axm`), run the Axon compiler, hand the resulting bundle to Claude, and observe the expected behavior — without ever pasting a raw prompt into the chat.

**Why this priority**: This is the smallest end-to-end loop that proves the language has value. If a developer cannot author a one-class program, compile it, and have Claude execute the result, none of the more advanced constructs matter. This story alone delivers the core value proposition: turning ad-hoc prompts into named, reusable, encapsulated units of LLM behavior.

**Independent Test**: A developer creates `greeter.ax` (one class, one `@public` skill, one `@private` field) plus `main.axm` (one `@main` skill that calls the greeter), compiles the project, hands the output folder to Claude, and observes that Claude performs the greeting and recalls it. No inheritance, no interfaces, no threading involved.

**Acceptance Scenarios**:

1. **Given** a valid `.ax` file defining a class with one `@public` skill and one `@private` field, **When** the developer runs the compiler with that file plus a `.axm` calling the skill, **Then** the compiler emits an output bundle containing a manifest, a fields file for the class, a skill file for each declared skill, and a `main.axc` — with no duplicated content between files.
2. **Given** a compiled bundle produced from a valid one-class project, **When** Claude is asked to execute the bundle, **Then** Claude reads `_manifest.axc` first, resolves the `main.axc` entry point, executes the referenced skill(s), and reports the resulting behavior to the user.
3. **Given** a project containing only `.ax` files (no `.axm`), **When** the developer runs the compiler, **Then** compilation succeeds and produces a library bundle (no `main.axc`) that Claude can later be asked to use on demand.

---

### User Story 2 - Build a class hierarchy with abstract base, concrete child, and interfaces (Priority: P2)

A developer wants to express a reusable LLM-agent contract once and have multiple concrete implementations share it. They define an abstract class (e.g., `Research`) with shared fields, a `@public` template-method skill that orchestrates the workflow, and `abstract` / `virtual` / `sealed` skills representing the hooks. They then define a child class (e.g., `ResearchCompany`) that `extends` the abstract base, implements its abstract skills, overrides a `virtual` skill using `base.write_report`, and `implements` one or more interfaces.

**Why this priority**: Inheritance, abstraction, encapsulation, and interfaces are the OOP core that distinguishes Axon from slash commands. This story is what justifies calling Axon a "language" rather than a prompt collection. It validates that the compiler resolves inheritance chains, enforces visibility, enforces interface contracts, distinguishes override modes, and supports the `base.*` super-call decorator pattern — without ever duplicating content in the compiled bundle.

**Independent Test**: A developer creates `research.ax` (abstract), `research_company.ax` (concrete child that extends + implements an interface), and `researchable.ax` (interface). Compilation succeeds. The bundle's manifest shows `ResearchCompany` inheriting the parent's `research` skill (by reference, not by copy), overriding `write_report` (with `base.write_report` resolved), and implementing the interface's required skills. Claude can execute `ResearchCompany.research(topic: ...)` and the resulting behavior reflects both inherited and overridden logic.

**Acceptance Scenarios**:

1. **Given** an abstract class with one `@protected virtual` skill and two `@protected abstract` skills, **When** a child class extends it but fails to implement one abstract skill, **Then** compilation fails with an "Unimplemented abstract skill" error that names the source file, line, column, the missing skill, and a suggested fix (a code stub the developer can paste).
2. **Given** a child class that declares `skill write_report { - call base.write_report ... }`, **When** the project is compiled, **Then** the child's compiled skill file references the parent's skill file by path (never copies the body) and the manifest records the override mode as "overrides Research.write_report".
3. **Given** a class declaring `implements Researchable, Exportable`, **When** the class is missing one of the skills required by either interface, **Then** compilation fails with an "Interface contract violation" error that names which interface and which skill is missing.
4. **Given** a concrete class calling `base.write_report` while extending a class whose parent has no `write_report`, **When** the project is compiled, **Then** compilation fails with an "Invalid base.* reference" error.
5. **Given** a child class attempting to override a `sealed` skill, **When** the project is compiled, **Then** compilation fails with a "Sealed skill override" error.

---

### User Story 3 - Orchestrate multiple agents with threading and composition from main (Priority: P2)

A developer wants to run several LLM agents concurrently (parallel branches with no shared resource) and chain producer-consumer pipelines (with explicit synchronization strategy). They write a `main.axm` that calls multiple classes' public skills directly — without any `uses` or `import` declaration — and wraps subsets of calls in `parallel { }` or `pipe(strategy: per_item) { }` / `pipe(strategy: on_complete) { }` blocks.

**Why this priority**: Threading and composition are what make Axon a real orchestrator rather than a fancier prompt template. Without them, a developer could only sequence agents one at a time; with them, the developer can express realistic multi-agent workflows. The implicit composition rule (no `uses` declaration) is a deliberate ergonomic choice that must be enforced and validated.

**Independent Test**: A developer writes a `main.axm` containing one sequential call followed by a `parallel { }` block of three independent calls to three different classes, finishing with a `pipe(strategy: per_item) { }` between a reader and a writer class. Compilation succeeds without any explicit import declarations. The manifest records all involved classes. Claude reads the bundle and executes the parallel block as fire-and-forget concurrent agents and the pipe with the chosen synchronization strategy.

**Acceptance Scenarios**:

1. **Given** a `main.axm` calling `QuestionGenerator.generate_questions(...)` where `QuestionGenerator` is defined in a separate `.ax` file in the project, **When** the project is compiled, **Then** compilation succeeds with no `uses` / `import` declaration required — the compiler discovers and resolves the class automatically.
2. **Given** a `parallel { }` block with three call instructions, **When** the bundle is executed by Claude, **Then** the three skills are launched concurrently as independent agents that do not share intermediate state with each other.
3. **Given** a `pipe(strategy: per_item) { }` block with a producer skill and a consumer skill, **When** the bundle is executed, **Then** the consumer receives items from the producer as they are emitted (streaming), whereas a `pipe(strategy: on_complete)` consumer waits for the producer to finish before starting.
4. **Given** a project containing two `.axm` files, **When** compilation runs, **Then** it fails with a "Multiple @main skills" error.
5. **Given** a `main.axm` that references a non-existent class or skill, **When** compilation runs, **Then** it fails with an "Unknown reference" error pointing to the bad reference.

---

### User Story 4 - Receive precise, actionable compiler errors (Priority: P3)

A developer makes a mistake — calls a `@private` skill from outside its class, creates a cyclical inheritance chain, names two classes the same, or tries to override a non-virtual/non-abstract skill. The compiler refuses to produce a bundle and instead emits an error message that names the offending source file, the line and column, a clear human-readable description, and a concrete suggested fix.

**Why this priority**: Without a tight error story, developers cannot self-correct, and Axon will feel like an opaque transpiler. This is what makes the compiler trustworthy and the language teachable. It is P3 because P1 and P2 must work first — there is nothing to validate errors against if the happy paths aren't built.

**Independent Test**: A test suite of intentionally broken projects (one per error type in the catalog) is fed to the compiler. For every project, the compiler exits with a non-zero status and emits an error containing all four required elements: source file, line+column, description, suggested fix.

**Acceptance Scenarios**:

1. **Given** a `main.axm` calling a `@private` skill of another class, **When** compilation runs, **Then** it fails with a "Visibility violation" error that quotes the calling site (file, line, column), names the private skill, and suggests either changing visibility or routing through a `@public` wrapper.
2. **Given** two `.ax` files both declaring `class Greeter { }`, **When** compilation runs, **Then** it fails with a "Duplicate class name" error pointing to both files.
3. **Given** an inheritance chain A → B → C → A, **When** compilation runs, **Then** it fails with a "Cyclical inheritance" error listing the full cycle.
4. **Given** a child class declaring `skill foo { ... }` where the parent's `foo` is neither `virtual` nor `abstract`, **When** compilation runs, **Then** it fails with an "Override mode mismatch" error.

---

### Edge Cases

- **Empty project**: A directory with no `.ax` and no `.axm` files. Compilation produces a valid empty library bundle (manifest with empty class list) and exits successfully.
- **Library project (no `.axm`)**: A project containing only `.ax` files. Compilation succeeds; the bundle omits `main.axc`; Claude treats the bundle as a callable library on request.
- **Abstract class invoked from `main`**: `main.axm` directly calls a skill on an abstract class. Compilation fails — abstract classes cannot be invoked directly.
- **Skill calling itself or mutually-recursive skills**: Compilation succeeds (the language is natural-language, and the compiler is not responsible for proving termination); the LLM runtime handles termination semantically.
- **Default parameter values referencing fields or other skills**: Defaults are literal values only (numbers, strings, booleans). A field reference in a default is treated as a parse error.
- **Field referenced by a skill but never declared**: "Unknown reference" error at compile time, even if a fields block exists elsewhere.
- **Skill named identically to a field**: "Duplicate member" error in the owning class.
- **`this.*` used inside an interface skill signature**: Interfaces contain only signatures, no bodies; `this.*` is meaningless and produces a parse error.
- **`base.*` used in a class with no `extends`**: "Invalid base.* reference" error.
- **`@main` declared inside an `.ax` file (not `.axm`)**: "Misplaced @main" parse error.
- **Multiple `@main` skills in the same `.axm` file**: "Multiple @main skills" error.
- **A class implements an interface but declares one of the interface's required skills as `@private` or `@protected`**: "Interface contract violation" — interface-required skills must be `@public` to satisfy the contract.
- **A `parallel { }` block whose branches mutate the same field on the same class**: The language guarantees no shared state between parallel branches by contract; the developer is responsible for not introducing the conflict, but the spec must clearly state this.
- **A `pipe { }` block with three or more stages**: Allowed; the synchronization strategy applies pairwise along the chain.
- **A skill body containing zero instruction bullets**: Allowed; treated as a no-op skill (the LLM does nothing).

## Requirements *(mandatory)*

### Functional Requirements

#### Language constructs

- **FR-001**: Axon MUST support a `class` construct that is static (no instantiation, no constructors), uses `{ ... }` as its block delimiter, and may declare a `fields` block plus zero or more skills.
- **FR-002**: Axon MUST support an `abstract class` construct that may contain both implemented and abstract skills, may contain fields, and cannot be invoked directly from `main`.
- **FR-003**: Axon MUST support an `interface` construct that contains only skill signatures (no bodies), cannot declare fields, and may be implemented by zero or more classes.
- **FR-004**: A class MUST be permitted to `extends` at most one other class (single inheritance) and to `implements` zero or more interfaces.
- **FR-005**: A child class MUST inherit all non-private skills and fields of its parent (transitively across the inheritance chain).

#### Skills

- **FR-006**: Axon MUST support skills as named, reusable instruction units, each accepting zero or more parameters with optional literal default values, and consisting of zero or more `- free speech instruction text` bullets inside `{ }`.
- **FR-007**: Skills MUST support four override modes — `abstract` (no body, child MUST override), `virtual` (has body, child MAY override), `sealed` (has body, child CANNOT override), and default (has body, child MAY override).
- **FR-008**: Parameters MUST be untyped; types MUST be inferred by the LLM runtime from context.
- **FR-009**: A skill MUST be able to reference members of its own class via `this.member_name` and members of its parent class via `base.member_name`.
- **FR-010**: A skill MUST be able to call any other class's public skill via `ClassName.skill_name(param: value, ...)` without any explicit `import` / `uses` declaration; resolution MUST be automatic from the project's `.ax` files at compile time.

#### Fields

- **FR-011**: Fields MUST be declared inside a single `fields { }` block per class, MUST be untyped, MUST be class-scoped shared memory across all skills of that class, and MUST support optional literal default values.
- **FR-012**: Fields MUST follow the same encapsulation visibility rules as skills and MUST be inherited by child classes subject to those rules.

#### Encapsulation

- **FR-013**: Axon MUST support three visibility modifiers — `@public` (accessible from anywhere), `@protected` (accessible from this class and its descendants), `@private` (accessible only from within this class) — applicable uniformly to skills and fields.
- **FR-014**: The compiler MUST enforce visibility at every call site and field reference, failing compilation with a "Visibility violation" error when a `@private` member is accessed from outside its class or a `@protected` member is accessed from outside its inheritance chain.

#### Threading

- **FR-015**: Axon MUST support a `parallel { }` block that runs each contained call as a fire-and-forget concurrent agent with no shared resource between branches.
- **FR-016**: Axon MUST support a `pipe(strategy: per_item) { }` block in which the consumer receives each item from the producer as it is emitted, and a `pipe(strategy: on_complete) { }` block in which the consumer waits for the producer to finish before executing.
- **FR-017**: The compiled bundle MUST record the threading semantics in a way the LLM runtime can interpret unambiguously, so that `parallel` and `pipe` blocks are executed with the declared concurrency model.

#### Free speech logic

- **FR-018**: Axon MUST NOT define `if`, `else`, `for`, `while`, or any other classical control-flow keyword. Conditional logic, iteration, and rules MUST be expressible as natural-language instruction bullets that the LLM interprets at runtime.

#### Main / entry point

- **FR-019**: Axon MUST support an optional `@main skill main { }` entry point that lives in a `.axm` file, with at most one `.axm` file per project and at most one `@main` skill per file.
- **FR-020**: A `@main` skill MUST act as an orchestrator that calls other skills by reference and MUST NOT contain inlined skill content from other classes.
- **FR-021**: A project without any `.axm` file MUST be a valid library; compilation MUST succeed and produce a bundle without a `main.axc`.

#### File extensions

- **FR-022**: The compiler MUST accept `.ax` files for class / abstract class / interface definitions and `.axm` files for the optional main entry point, and MUST reject other extensions in the source directory with a clear error.

#### Compiler outputs and DRY guarantees

- **FR-023**: The compiler MUST emit an output **directory** (not a single file) containing exactly:
  - `_fields/{ClassName}.fields` — one file per class that declares its own fields
  - `_skills/{ClassName}.{skill}.skill` — one file per skill (including overrides the child owns)
  - `_manifest.axc` — the class graph, inheritance relations, interface implementations, and skill registry
  - `main.axc` — present only if a `.axm` was provided
- **FR-024**: The compiler MUST NOT duplicate content across the output bundle. Specifically:
  - A skill file MUST reference other skills by path, never embed their bodies.
  - A class's fields MUST be stored once in `_fields/{ClassName}.fields` and referenced (by path) by every skill that needs them.
  - An inherited skill MUST be referenced from the parent's `.skill` file, never copied into the child's namespace.
- **FR-025**: Each `.skill` file MUST contain the metadata block (class, skill, visibility, override mode, parameters, inherited-fields path, own-fields path, dependency list of referenced skills) and the natural-language body, in a deterministic schema described in the runtime contract section.
- **FR-026**: The `_manifest.axc` file MUST enumerate every class (with abstract/concrete marker, parent, implemented interfaces, fields file path, and skill list with visibility + override-mode tags), every interface (with required-skill list), and the entry-point path if present.

#### Compiler error catalog

- **FR-027**: The compiler MUST detect and report each of the following errors, blocking emission of the bundle when any occur:
  1. Unimplemented abstract skill
  2. Interface contract violation
  3. Invalid `base.*` reference
  4. Visibility violation
  5. Sealed skill override
  6. Unknown reference (skill, field, or class)
  7. Cyclical inheritance
  8. Override mode mismatch (child overrides a skill that is neither `virtual` nor `abstract`)
  9. Duplicate class name (same name in two `.ax` files)
  10. Multiple `@main` skills (more than one `.axm`, or multiple `@main` in one file)
- **FR-028**: Every compiler error MUST report four elements: (1) source file path, (2) line and column, (3) a clear human-readable message, (4) a suggested fix whenever a concrete fix is feasible.
- **FR-029**: The compiler MUST exit with a non-zero status when any error is emitted and MUST NOT write a partial bundle on failure.

#### Runtime contract

- **FR-030**: A compiled Axon bundle MUST be self-describing such that an LLM runtime (Claude) reading only the bundle directory can (a) load `_manifest.axc` first to understand the class graph, (b) resolve any referenced skill or field to its file, (c) begin execution at `main.axc` if present, and (d) treat the bundle as a callable library if `main.axc` is absent.
- **FR-031**: The runtime contract MUST specify, in the spec document, the precise instructions Claude follows when reading a bundle, including: manifest-first ordering, how to resolve `this.*` and `base.*` against the manifest, how to honor visibility at call resolution time, how to execute `parallel { }` versus each `pipe` strategy, and how to surface runtime errors to the user.

#### Deliverable: `spec.md` content scope

The Axon specification document itself (the artifact this feature produces) MUST cover every section listed below. These requirements describe **what the spec document must contain**, not how the compiler is implemented.

- **FR-032**: The spec MUST contain a **Language overview** section covering Axon's vision, philosophy, and a comparison to traditional OOP (state lives in classes not instances; semantics are LLM-driven; logic is free-speech; runtime is an LLM).
- **FR-033**: The spec MUST contain a **Formal grammar** section expressing Axon's syntax in EBNF (or an equivalent unambiguous notation) sufficient for a competent engineer to write a parser without further clarification.
- **FR-034**: The spec MUST contain a **Syntax reference** section presenting every construct (class, abstract class, interface, skill in each override mode, fields block, each visibility modifier, `this.*`, `base.*`, cross-class call, `parallel`, both `pipe` strategies, `@main`) with at least one complete example each.
- **FR-035**: The spec MUST contain a **Semantic rules** section covering: inheritance resolution order (depth-first along the single-parent chain), visibility enforcement at every reference site, threading semantics for `parallel` and both `pipe` strategies, skill resolution (own → parent chain → composition target), and parameter binding (by name; positional support is a deferred extension — see open questions).
- **FR-036**: The spec MUST contain a **Compiler architecture** section describing each phase (lexer → parser → resolver → validator → emitter), its inputs, outputs, and responsibilities, without prescribing a specific implementation language.
- **FR-037**: The spec MUST contain a **Compiler error catalog** section enumerating every error in FR-027, with an example source snippet that triggers the error, the exact error message format, and the suggested fix.
- **FR-038**: The spec MUST contain an **Output bundle format** section that fully specifies the file structure, naming conventions, and content schema for `.fields`, `.skill`, `_manifest.axc`, and `main.axc` — precisely enough that two independent implementations would produce byte-equivalent bundles for the same input.
- **FR-039**: The spec MUST contain a **Runtime contract** section describing what Claude is expected to do when reading the bundle (per FR-030, FR-031).
- **FR-040**: The spec MUST contain an **Example programs** section including (a) the small one-class example, (b) the medium abstract-base + concrete-child + interface example, (c) the complex multi-class example with threading and composition, and (d) the full compiled bundle output of the medium example to make the DRY guarantees concrete.
- **FR-041**: The spec MUST contain an **Open questions / future extensions** section that, at minimum, lists `overloading` as a deferred v2 feature, and flags any other items that may need future refinement.

### Key Entities

- **Project**: A directory containing zero or more `.ax` source files and at most one `.axm` source file. The unit of compilation.
- **Class**: A static, non-instantiable namespace of behavior, named, optionally `extends`-ing one parent and `implements`-ing zero or more interfaces. Owns a fields block and a set of skills. May be concrete or abstract.
- **Abstract class**: A class that may contain abstract skills and cannot be invoked directly from `main`. Concrete descendants must implement every inherited abstract skill.
- **Interface**: A named contract listing required skill signatures (no bodies, no fields). Implemented by classes; multiple implementation is permitted.
- **Skill**: A named, parameterized unit of LLM instruction. Has a visibility (`@public` / `@protected` / `@private`), an override mode (`abstract` / `virtual` / `sealed` / default), zero or more parameters with optional literal defaults, and a body of natural-language instruction bullets (except `abstract` skills, which have no body).
- **Field**: A named slot of class-scoped shared memory, untyped, optionally with a literal default, governed by the same visibility rules as skills.
- **Modifier / Decorator**: An `@`-prefixed token (`@public`, `@protected`, `@private`, `@main`) applied to a member or skill.
- **Instruction**: A `- free speech text` bullet inside a skill body, interpreted by the LLM at runtime.
- **Main**: The optional entry-point skill (`@main skill main { }`) defined in a `.axm` file, acting as an orchestrator.
- **Compiler**: The classical-code program that reads sources, validates them, and emits the bundle. Has at least the phases lexer, parser, resolver, validator, emitter.
- **Bundle**: The compiled output directory containing `_fields/`, `_skills/`, `_manifest.axc`, and optionally `main.axc`. The artifact handed to Claude at runtime.
- **Manifest** (`_manifest.axc`): The single file inside the bundle that enumerates every class, interface, and the entry point, and is read first by the runtime.
- **Runtime**: Claude (the LLM) reading the bundle, resolving references via the manifest, and executing skills.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A competent engineer, given **only** the resulting `spec.md`, can build a working Axon compiler — including parser, resolver, validator, and emitter — without asking the spec author any clarifying questions. (Measured by: at least one independent engineer completes a compiler from the spec alone, and the produced compiler accepts every example program in the spec.)
- **SC-002**: 100% of the constructs from the original feature brief (classes, abstract classes, interfaces, four skill override modes, three visibility modifiers, fields, single inheritance, implicit composition, `this.*`, `base.*`, `parallel`, both `pipe` strategies, `@main`, both file extensions) appear in both the formal grammar section and the syntax reference section with at least one complete example each.
- **SC-003**: 100% of the 10 compiler errors in FR-027 appear in the error catalog section with an example trigger, the exact error message format, and a suggested fix.
- **SC-004**: Two independent compiler implementations built from the spec produce **byte-equivalent** bundles for the same input project across all three example programs (small, medium, complex). This validates the DRY guarantees and the bundle format are specified precisely.
- **SC-005**: For every example program in the spec, when its compiled bundle is handed to Claude with no additional instructions beyond "execute this bundle," Claude reads `_manifest.axc` first and then executes the program correctly without asking for clarification.
- **SC-006**: All three example programs (small, medium, complex) compile without error using the spec's syntax — verified by manual review against the formal grammar.
- **SC-007**: The medium example's spec section includes the full bundle output (all `.fields`, `.skill`, `_manifest.axc`, and `main.axc` files), and inspection confirms that **no skill body content appears in more than one file** (DRY guarantee made concrete).
- **SC-008**: A developer reading only the error catalog section can identify, for each of the 10 errors, (a) what source code triggers it, (b) what the message will say, and (c) at least one valid fix — without consulting any other section of the spec.

## Assumptions

The following defaults were applied where the original brief did not specify a detail. Each is a deliberate, documented choice rather than an open question.

- **Parameter passing is by name**: All example call sites in the brief (`research(topic: "Apple Inc")`, `generate_questions(topic: topic, amount: 10)`) use named arguments. The spec will define **named-argument calls as the canonical form**. Positional arguments are deferred to a future version (listed under open questions).
- **Default parameter values are literals only**: Numbers, strings, and booleans. Field references and skill calls inside a default value are out of scope for v1 and would parse-error.
- **Cross-class field reads are permitted for `@public` fields**: The complex example reads `ResearchCompany.report` from `main.axm`, so the spec must allow reading a `@public` field of another class from outside. **Cross-class field writes from outside the owning class are NOT permitted in v1**; state is mutated only by skills of the owning class. This will be stated explicitly in the semantic rules section.
- **Inheritance resolution is depth-first along the single-parent chain**: Because Axon enforces single inheritance, the diamond problem cannot arise and the lookup order is unambiguous (this class → parent → grandparent → ...).
- **Composition is implicit and resolved project-wide**: The compiler treats any `ClassName.skill_name(...)` reference as a project-wide lookup against the discovered set of `.ax` files. No `uses` / `import` declaration is needed or accepted.
- **Skills inside `parallel { }` share no intermediate state**: This is a language guarantee, not a runtime hint. The compiler is not required to detect attempted shared mutation; the developer takes responsibility for not introducing it. The spec will document this clearly.
- **`pipe { }` blocks support two or more stages**: The synchronization strategy declared on the block applies pairwise between consecutive stages.
- **Runtime errors are surfaced via the LLM's normal output**: When Claude cannot execute an instruction unambiguously, it reports the issue in plain language to the user. The spec does not prescribe a structured runtime error format beyond "Claude must clearly identify the failing skill and the issue."
- **Compilation is a project-wide operation**: The compiler operates on a source directory as a whole; per-file compilation with linking is out of scope for v1.
- **The bundle is the only artifact the runtime sees**: Claude is never handed the original `.ax` / `.axm` sources at runtime; the spec must therefore make the bundle self-describing (manifest-first design).
- **The implementation language of the compiler is unspecified**: The spec describes inputs, outputs, phases, and behavior. Any language whose toolchain can read the source directory and write the bundle directory is acceptable.

## Open Questions / Future Extensions

The following items are explicitly **deferred** to a later version. The spec must list them in its "Open questions / future extensions" section (FR-041).

- **Skill overloading**: Allowing multiple skills with the same name and different parameter signatures within a single class. Deferred to v2 because Axon's untyped, free-speech parameter model makes signature-based dispatch ambiguous without further design.
- **Positional arguments at call sites**: The v1 spec mandates named arguments. Positional forms could be added later if a clean precedence rule is defined.
- **Cross-class field writes**: Writing `OtherClass.field = value` is not permitted in v1. A future version may introduce a `@settable` field marker or a public setter convention.
- **Field-level default expressions**: Defaults that reference other fields, other classes' values, or skill calls. v1 restricts defaults to literals.
- **Generic / parameterized classes**: Not part of v1.
- **A `uses` / `import` declaration**: Deliberately omitted in favor of implicit composition. May be revisited if large projects suffer from name collisions.
- **Multi-file `@main`**: Currently one `.axm` per project. A future version could allow multiple entry points selected by CLI argument.
- **Runtime error taxonomy**: v1 leaves runtime errors to be surfaced by the LLM in natural language. A future version may define structured runtime error categories.
- **Standard library**: There is no built-in library of classes (e.g., `FileExporter`, `EmailSender` are user-defined in the examples, not language-provided). A future version may ship a standard library.
