# Quickstart: Authoring and Validating the Axon Spec

**Branch**: `001-axon-language` | **Date**: 2026-05-21

This quickstart explains how to author the canonical Axon specification document and how to validate the result before declaring the feature complete. It is a pointer to the work, not the work itself; the canonical deliverable lives at `docs/axon/spec.md` after this feature is implemented.

---

## What you are producing

A single markdown document — `docs/axon/spec.md` — that contains 10 sections in this exact order (matching FR-032 through FR-041):

1. **Language overview** — vision, philosophy, comparison to traditional OOP.
2. **Formal grammar** — ISO/IEC 14977 EBNF; copy the rules from [contracts/grammar.ebnf](./contracts/grammar.ebnf) inline.
3. **Syntax reference** — every construct with at least one complete example.
4. **Semantic rules** — numbered prose rules per research decision R3.
5. **Compiler architecture** — phases (lexer → parser → resolver → validator → emitter).
6. **Compiler error catalog** — copy the 10 errors from [contracts/error-catalog.md](./contracts/error-catalog.md).
7. **Output bundle format** — copy the schemas from [contracts/bundle-format.md](./contracts/bundle-format.md).
8. **Runtime contract** — what Claude does when reading the bundle.
9. **Example programs** — small + medium + complex, plus the medium example's full compiled bundle.
10. **Open questions / future extensions** — copy from `spec.md`'s "Open Questions" section.

Alongside the document, populate `docs/axon/examples/` with the three example projects (each a directory of `.ax` / `.axm` files) and `docs/axon/examples-compiled/medium/` with the byte-faithful bundle for the medium example.

---

## How to author the spec (one-time setup)

The authoring sequence below is the order in which work should proceed during implementation. Each step has a clear acceptance signal.

1. **Set up the docs tree**:
   ```
   docs/
   └── axon/
       ├── spec.md                        (empty, to be authored)
       ├── examples/{small,medium,complex}/
       └── examples-compiled/medium/
   ```

2. **Drop the contracts into place**:
   - The grammar from `contracts/grammar.ebnf` becomes the body of section 2 (Formal grammar).
   - The bundle format from `contracts/bundle-format.md` becomes section 7.
   - The error catalog from `contracts/error-catalog.md` becomes section 6.

3. **Write the three example programs** as runnable Axon source. The brief's existing examples are the starting point; verify each one against the grammar (step 5 below).

4. **Hand-compile the medium example** into a full bundle directory at `docs/axon/examples-compiled/medium/`, strictly following the bundle-format contract. This is the artifact that demonstrates FR-024's DRY guarantees concretely.

5. **Mechanically validate** (research R10):
   - Paste the grammar into an EBNF validator. Confirm each example program parses without error.
   - Have a second reader produce the medium bundle independently from the bundle-format spec alone. The two bundles must be byte-equal.

6. **Author the prose sections** (1, 3, 4, 5, 8, 9, 10). Each section MUST cite at least one of the FRs in spec.md.

7. **Final coverage check**: confirm every FR (FR-001 through FR-041) traces to at least one section of the deliverable.

---

## What "done" looks like

A reviewer can pick up the canonical `docs/axon/spec.md` cold and answer "yes" to all of these:

- I understand what Axon is and why it exists (section 1).
- I can describe the syntax of every construct without consulting the brief (sections 2 and 3).
- I know what the compiler must reject and what it must accept (sections 4 and 6).
- I know what byte-level output the compiler must produce for a given input (section 7).
- I know what Claude does when handed the bundle (section 8).
- I have three working example programs and one full compiled bundle as ground truth (section 9).
- I know what is deliberately deferred to v2 (section 10).

If a reviewer cannot answer one of those questions from the spec alone, the affected section needs more work.

---

## A minimal Axon program (the smallest end-to-end example)

Used as the small example in section 9 of the deliverable. This is also the "hello world" test for any compiler implementation built from the spec.

`docs/axon/examples/small/greeter.ax`:
```
class Greeter {

  fields {
    @private last_greeting
  }

  @public
  skill greet(name) {
    - greet name warmly
    - store the greeting in this.last_greeting
  }

  @public
  skill recall {
    - return this.last_greeting
  }
}
```

`docs/axon/examples/small/main.axm`:
```
@main
skill main {
  - call Greeter.greet(name: "Yair")
  - call Greeter.recall
}
```

Compiling this project must produce a bundle containing:
- `_manifest.axc` listing one class (`Greeter`, concrete, no parent, no interfaces) with two skills (`greet`, `recall`)
- `_fields/Greeter.fields` listing `@private last_greeting`
- `_skills/Greeter.greet.skill` and `_skills/Greeter.recall.skill`
- `main.axc`

If you can hand this bundle to Claude and Claude (a) reads the manifest, (b) executes main, (c) greets "Yair" and (d) recalls the greeting — the language works end-to-end. That is the floor for "this spec is implementable."

---

## Cross-references

- Feature spec: [spec.md](./spec.md)
- Plan: [plan.md](./plan.md)
- Research decisions: [research.md](./research.md)
- Data model: [data-model.md](./data-model.md)
- Contracts: [contracts/](./contracts/)
- Requirements checklist: [checklists/requirements.md](./checklists/requirements.md)
