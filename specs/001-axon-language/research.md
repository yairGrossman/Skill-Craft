# Phase 0 Research: Axon Language Specification

**Branch**: `001-axon-language` | **Date**: 2026-05-21

Notational and design decisions that must be resolved before drafting the canonical spec, so the spec uses one consistent notation throughout. Each decision below names the choice, the reasoning, and the alternatives rejected.

---

## R1. Grammar formalism

**Decision**: **ISO/IEC 14977 EBNF** (also known as "standard EBNF"), with the standard symbols `=`, `,`, `|`, `[ ]`, `{ }`, `( )`, `?`, `*`, `+`, `;` as production terminators, and double-quoted terminal strings.

**Rationale**:
- It is the most widely taught and recognized BNF dialect; the future compiler implementer is overwhelmingly likely to recognize it on sight.
- It cleanly expresses Axon's actual needs: optional production parts (`extends`, `implements`), repetition (multiple skills in a class, multiple instructions in a skill body), and alternation (`class | abstract class | interface`).
- It is a pure notation — no operator-precedence baked in — which suits Axon, a language with no expression grammar (only declarations and instruction bullets).

**Alternatives considered**:
- **PEG (parsing expression grammar)**: technically unambiguous by construction (ordered choice) and well-suited to writing the future parser. Rejected because the spec is a contract for *any* implementer, not a parser implementation. PEG's ordered-choice semantics leak implementation intent into the contract.
- **ABNF (RFC 5234)**: clean and well-known in IETF circles, but its `/` for alternation and lack of grouping conventions make production rules harder to read than EBNF for language designers.
- **W3C-style EBNF** (used in XML specs): close to ISO EBNF but with `?` / `*` / `+` postfix only and no `[ ]` / `{ }`. Slightly less expressive; rejected to keep `[optional]` and `{repeated}` shorthands available.

**Implication for the spec**: the formal grammar section will introduce the EBNF metasyntax in two paragraphs at the top, then list approximately 25–40 production rules.

---

## R2. Bundle file format

The bundle contains three structurally distinct file types: `.fields`, `.skill`, and `.axc` (manifest and main). Each is human-readable per the brief's examples.

**Decision**: **Custom line-oriented "key: value" format** with section headers, *not* YAML/TOML/JSON. The format is defined precisely in the spec's bundle-format section.

**Rationale**:
- The brief's own examples already use this style (`CLASS: Research`, `SKILL: research`, `VISIBILITY: @public`, etc.). Adopting an off-the-shelf format would force rewriting those examples and would obscure the deliberate minimalism.
- The runtime is Claude — an LLM. The format only needs to be tractable for an LLM, which has no trouble with simple `key: value` files but might be slowed by JSON's punctuation overhead or YAML's indentation pitfalls.
- A custom format keeps the bundle small and the format spec short. Any LLM (or human) can read the bundle without a library.
- Determinism (required for SC-004's byte-equivalence target) is easier to enforce in a custom format than in YAML, where serializers vary in quoting and key order.

**Alternatives considered**:
- **YAML**: human-readable but ambiguous (anchors, multi-document, type coercion); two compliant emitters may produce non-equivalent bytes for the same logical content. Rejected on determinism grounds.
- **JSON**: deterministic if keys are sorted, but heavier punctuation and lacks comments, making the bundle harder for a human to skim during debugging.
- **TOML**: nicer for config but its array-of-tables and dotted-key conventions don't suit Axon's nested-but-flat file content.

**Implication for the spec**: the bundle-format section will give a small grammar (also EBNF) for the custom format, list every key that can appear in each file type, and specify ordering rules so output is deterministic.

---

## R3. How to express semantic rules

**Decision**: **Numbered, prose semantic rules grouped by topic**, each rule cross-referencing the FR it satisfies and the grammar production it constrains. No denotational or operational-semantics formalism.

**Rationale**:
- Axon's semantics are partially executed by an LLM. A denotational semantics is not meaningful for instruction bullets that mean "whatever Claude understands them to mean."
- The semantic rules the spec MUST nail down are the ones the **classical** compiler enforces: visibility, override compatibility, inheritance lookup, interface-contract checking, threading-block translation. Prose rules with worked examples are sufficient and intelligible.
- Each rule will follow a three-part template: **Rule** (one sentence), **Example** (a short Axon snippet showing the rule in action), **Compiler behavior** (accept / reject + which FR-027 error if reject).

**Alternatives considered**:
- **Inference rules in natural-deduction style**: too academic for the target audience.
- **Pseudo-code algorithms**: useful for the resolver section but would conflate "what the language means" with "how the compiler implements it." Pseudo-code is acceptable in the *Compiler architecture* section but not in *Semantic rules*.

**Implication for the spec**: Semantic rules section will contain roughly 20–30 numbered rules. Each cites at least one FR and at least one error catalog entry.

---

## R4. Parameter binding model

**Decision**: **Named-argument binding only in v1**, formalized as: at every call site, every argument MUST be of the form `name: value`; the compiler MUST verify that every argument name corresponds to a parameter of the called skill and that every non-defaulted parameter is supplied.

**Rationale**:
- Every example call site in the brief uses named arguments. Positional arguments would require defining a parameter-order convention (declaration order) and a precedence rule for mixing named and positional, neither of which the brief specifies.
- Named-only matches the spec's own assumption already recorded under "Parameter passing is by name." Defer positional to the Open Questions list.
- Named-only is easier for the LLM runtime to interpret robustly: there is no positional ambiguity.

**Alternatives considered**:
- **Mixed positional + named (Python-style)**: requires a tie-break rule and complicates the grammar. Rejected.
- **Positional only**: contradicts every example in the brief.

**Implication for the spec**: One semantic rule pinning this down. One grammar production for call-arguments restricting them to `Identifier ":" Value`.

---

## R5. Value literals supported in defaults and arguments

**Decision**: Three literal kinds — **string** (double-quoted, with `\"` and `\\` escapes), **integer** (decimal, optional leading `-`), **boolean** (`true` | `false`). No floats, no null, no lists, no nested structures.

**Rationale**:
- The brief's examples use only these three kinds (`amount = 10`, `is_validated = false`, `topic: "Apple Inc"`).
- The values flow into LLM instructions where they appear as natural-language tokens. Richer literal types (floats, lists, dicts) would create unspoken serialization questions: "What does the LLM see when a parameter is a list?" Best deferred.
- A list of strings (e.g., `topics: ["Apple", "Google"]`) is expressible inside an instruction bullet as `- research these companies: Apple, Google` — the free-speech model already handles collections.

**Alternatives considered**:
- **Add floats**: low value (LLM doesn't care about float vs integer precision); adds grammar surface; rejected.
- **Add lists / objects**: would require defining how the LLM should interpret structured arguments; rejected, defer to v2 if needed.

**Implication for the spec**: One short subsection in syntax reference enumerating the three literal types, and a corresponding `Literal` production in the grammar.

---

## R6. Instruction-bullet syntax precision

**Decision**: An instruction bullet is `"-"` + one mandatory space + one line of free-speech text terminated by a newline. Multi-line instructions are formed by **multiple consecutive bullets**, not by line continuation. There is no escape syntax inside bullets — the text is treated literally up to the end of line.

**Rationale**:
- Keeps the parser trivial. The lexer treats `-` at the start of a line (modulo leading whitespace) as a bullet token and consumes the rest of the line as opaque text.
- Forbids accidental syntax confusion (e.g., a developer writing `- if x then { do_thing }` does not produce a nested block; the `{ }` are part of the literal instruction text).
- Multi-bullet composition keeps each instruction atomic, which the LLM finds easier to plan around.

**Alternatives considered**:
- **Allow line continuation with `\`**: adds parser complexity for marginal benefit. Rejected.
- **Allow embedded `{ }` blocks inside an instruction for grouping**: would collide with the existing block delimiter. Rejected.

**Implication for the spec**: Two grammar productions (`Instruction = "-" " " Text Newline ;` and `SkillBody = { Instruction }`) plus a paragraph noting that bullet text is opaque to the compiler.

---

## R7. How to specify "free speech logic" in the spec

**Decision**: The spec will state explicitly that **the compiler treats instruction-bullet content as an opaque string and performs no analysis or validation of it**. The semantics of conditionals, iterations, and rules expressed in instruction bullets are entirely the responsibility of the LLM runtime. The spec will not attempt to formalize natural-language semantics.

**Rationale**:
- This is the language's defining design choice. Trying to constrain or validate natural-language instructions would defeat the point.
- Anchors the contract cleanly: the compiler validates *structure and references*; the LLM interprets *content*. Each side of the contract has clear responsibilities.

**Alternatives considered**:
- **Define a fixed vocabulary of "control words" (if, for, while, until, etc.) the LLM should recognize**: would re-introduce the keywords the language explicitly rejects. Defeats the philosophy.
- **Provide a "best practices for writing instruction bullets" appendix**: useful for users, but belongs in a user guide, not the spec. Out of scope.

**Implication for the spec**: One subsection under "Semantic rules" stating the opacity rule, with the brief's existing examples cited as illustration.

---

## R8. Cross-class field-read syntax inside skill bodies

**Decision**: Inside a skill body, reading another class's `@public` field uses `OtherClass.field_name` (the same dotted syntax as a skill call without parentheses or arguments). The compiler distinguishes a field reference from a skill call by looking up `field_name` in the target class's field list at resolution time — there is no syntactic difference between the two on the call site beyond the parentheses.

**Rationale**:
- Matches the brief's complex example where `main.axm` reads `ResearchCompany.report` (no parentheses).
- A single syntactic rule (`Identifier "." Identifier [ "(" ArgList ")" ]`) covers both cases; the compiler resolver decides which kind of reference it is.
- Skill-call syntax always includes parentheses, even with zero arguments (e.g., `this.recall` is a field access; `this.recall()` would not parse). Actually, wait — see the next paragraph.

**Refinement**: Looking at the brief's examples, zero-argument skill calls **omit parentheses** (e.g., `- call this.validate_sources`, `- call this.recall`). To disambiguate, the grammar treats *any dotted identifier inside an instruction's text* as opaque (per R6 / R7). Only call-position references inside the *structural* parts of the language (top-level skill calls in `main`, threading-block contents, parameter passing) are parsed as references — and these always require the leading `call` keyword for skill invocation. **A field read in a structural position** (e.g., `body: ResearchCompany.report` as an argument value) is identified as a field reference because (a) it lacks the leading `call`, and (b) `report` resolves to a field in `ResearchCompany`'s field list.

**Decision (refined)**: A dotted reference in argument-value position is parsed as a value expression. The resolver classifies it as either (a) a `@public` field read (if it matches a field of the target class) or (b) an error if the name does not resolve.

**Alternatives considered**:
- **Require explicit syntax for field reads** (e.g., `@read ResearchCompany.report`): clutters the syntax and contradicts the brief's example. Rejected.
- **Allow only literal arguments, never references**: would defeat the orchestration use case shown in the complex example. Rejected.

**Implication for the spec**: One grammar production for `ArgumentValue = Literal | DottedReference ;` and one semantic rule stating how the resolver classifies a `DottedReference`.

---

## R9. Where the canonical spec deliverable lives

**Decision**: `docs/axon/spec.md` in the repository root, with example sources at `docs/axon/examples/` and the reference compiled bundle at `docs/axon/examples-compiled/medium/`. The spec-kit metadata files (`specs/001-axon-language/spec.md`, `plan.md`, etc.) remain under `specs/` and are *not* the deliverable — they are the process artifacts.

**Rationale**:
- Engineers looking for "the Axon language spec" should find it in `docs/`, not in `specs/001-axon-language/`. The latter is a spec-kit working directory, naming is process-coupled, and there is no signal to a casual contributor that it is the canonical reference.
- Keeps the deliverable independent of spec-kit conventions; the spec can be linked to from a future README or website without committing to spec-kit forever.

**Alternatives considered**:
- **Put the canonical spec at the repo root as `AXON-SPEC.md`**: surfaces it well but clutters the top-level directory once additional docs accrue. Rejected.
- **Keep the canonical spec inside `specs/001-axon-language/`**: tightly couples the deliverable to the directory's spec-kit-numbered name. Future contributors would have to know what `001-` means.

**Implication for the plan**: Project Structure section reflects this layout.

---

## R10. Validation strategy for the deliverable

**Decision**: Three independent validation passes, all manual:

1. **Coverage matrix** — a small table embedded at the end of the deliverable (or kept in the spec-kit checklist) mapping each FR-001 through FR-041 to the spec section that satisfies it. Every FR must trace to at least one section.
2. **Example-against-grammar** — paste each of the three example programs into a freely available EBNF validator (e.g., the ANTLR / Railroad-Diagrams toolchain, or any small Python parser sketched from the grammar) and confirm no syntax errors.
3. **Reviewer cross-check on bundle byte-equivalence** — two reviewers independently produce, by hand, the medium example's compiled bundle from the spec's bundle-format section alone. The bundles must be byte-equivalent. This is a proxy for SC-004 until a real compiler exists.

**Rationale**:
- All three checks are runnable without writing a compiler — appropriate for a spec-authoring cycle.
- Pass 3 specifically validates that the bundle-format section is precise enough (FR-038). If two reviewers produce different bundles, the format spec is ambiguous and must be tightened.

**Alternatives considered**:
- **Skip mechanical validation; rely on review only**: faster but weaker; rejected because SC-001 demands a *competent engineer* be able to build a compiler unaided, which means the spec must survive mechanical scrutiny.
- **Build a partial reference parser as part of this cycle**: out of scope; defer to the next spec-kit cycle that plans the compiler.

**Implication for the spec / plan**: The plan's "Testing" entry in Technical Context reflects these three passes.

---

## Summary of decisions

| # | Topic | Decision |
|---|---|---|
| R1 | Grammar formalism | ISO/IEC 14977 EBNF |
| R2 | Bundle file format | Custom line-oriented key: value format |
| R3 | Semantic-rule notation | Numbered prose rules with example + compiler behavior |
| R4 | Parameter binding | Named-only in v1; positional deferred |
| R5 | Literals | string, integer, boolean (no float/null/list/object in v1) |
| R6 | Instruction bullet syntax | `- ` + opaque line; multi-bullet, no continuation |
| R7 | Free-speech opacity | Compiler does not analyze instruction text |
| R8 | Cross-class field reads | Dotted reference in arg-value position; resolved by resolver |
| R9 | Deliverable location | `docs/axon/spec.md` and `docs/axon/examples*/` |
| R10 | Validation strategy | Coverage matrix + grammar check + reviewer byte-check |

All `NEEDS CLARIFICATION` items from Technical Context are now resolved. Ready for Phase 1.
