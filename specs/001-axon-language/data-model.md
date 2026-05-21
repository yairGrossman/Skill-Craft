# Phase 1 Data Model: Axon Language Entities

**Branch**: `001-axon-language` | **Date**: 2026-05-21

This document formalizes the conceptual entities that the Axon specification describes. Each entity lists its attributes, the validation rules the compiler enforces on it, and its relationships to other entities. These are language-level entities — they are conceptual model, not implementation classes.

---

## Entity diagram (text)

```
Project
  ├── 0..N AxFile               (.ax)
  │     └── 1 ClassDecl  OR  1 InterfaceDecl
  ├── 0..1 AxmFile              (.axm)
  │     └── 1 MainSkill
  └── 1 CompiledBundle (output)
        ├── 1 Manifest          (_manifest.axc)
        ├── 0..N FieldsFile     (_fields/{Class}.fields)
        ├── 0..N SkillFile      (_skills/{Class}.{skill}.skill)
        └── 0..1 MainAxc        (main.axc)

ClassDecl
  ├── 0..1 extends → ClassDecl  (single inheritance)
  ├── 0..N implements → InterfaceDecl
  ├── 0..1 FieldsBlock
  └── 0..N Skill

InterfaceDecl
  └── 0..N SkillSignature

Skill
  ├── 0..N Parameter
  └── 0..N Instruction          (free-speech bullets; opaque to compiler)

CompiledBundle.Manifest
  └── references all ClassDecls, InterfaceDecls, the MainSkill (if any),
      and all bundle files by relative path
```

---

## Entities

### Project

The unit of compilation.

| Attribute | Type | Notes |
|---|---|---|
| `source_dir` | path | the input directory the compiler reads |
| `ax_files` | list of AxFile | 0..N |
| `axm_file` | AxmFile? | 0 or 1 |
| `output_bundle` | CompiledBundle | always exactly one |

**Validation rules** (compiler-enforced):
- The project MUST contain at most one `.axm` file (error: *Multiple `@main` skills*).
- All declared class names across all `.ax` files MUST be unique (error: *Duplicate class name*).
- File extensions in `source_dir` MUST be `.ax` or `.axm` (error: rejected file extension).

---

### AxFile

A single `.ax` source file.

| Attribute | Type | Notes |
|---|---|---|
| `path` | path | absolute or project-relative |
| `payload` | ClassDecl \| InterfaceDecl | exactly one declaration per file |

**Validation rules**:
- An `.ax` file MUST declare exactly one of: `class`, `abstract class`, or `interface`. Multiple top-level declarations in one file are a parse error.
- An `.ax` file MUST NOT contain an `@main` skill (error: *Misplaced @main*).

---

### AxmFile

The optional main entry-point file.

| Attribute | Type | Notes |
|---|---|---|
| `path` | path | always one of `main.axm` |
| `payload` | MainSkill | exactly one |

**Validation rules**:
- An `.axm` file MUST declare exactly one `@main skill main { ... }` block (error: *Multiple @main skills*).
- An `.axm` file MUST NOT declare any class or interface.

---

### ClassDecl

A class declaration. May be concrete or abstract.

| Attribute | Type | Notes |
|---|---|---|
| `name` | Identifier | unique within Project |
| `kind` | enum { concrete, abstract } | `class` vs `abstract class` |
| `extends` | ClassDecl? | at most one parent (single inheritance) |
| `implements` | list of InterfaceDecl | 0..N |
| `fields_block` | FieldsBlock? | 0 or 1 |
| `skills` | list of Skill | 0..N |

**Validation rules**:
- A class with `kind = concrete` MUST implement every abstract skill inherited from its ancestor chain (error: *Unimplemented abstract skill*).
- For every interface in `implements`, the class MUST provide a `@public` skill matching each required skill signature (error: *Interface contract violation*).
- The inheritance chain (`extends` walked transitively) MUST NOT contain a cycle (error: *Cyclical inheritance*).
- Field names and skill names MUST be unique within the class (no duplicate member within one ClassDecl).

**Inheritance lookup order** (semantic rule): When resolving `this.member` or a member reference inside a skill body, the resolver consults the owning class first, then walks `extends` parents depth-first until found. Single inheritance guarantees this lookup is unambiguous.

---

### InterfaceDecl

An interface declaration.

| Attribute | Type | Notes |
|---|---|---|
| `name` | Identifier | unique within Project |
| `signatures` | list of SkillSignature | 0..N |

**Validation rules**:
- An interface MUST NOT declare a `fields` block (parse error).
- An interface MUST NOT contain skill bodies — only signatures (parse error if a body is present).

---

### FieldsBlock

The single `fields { ... }` block of a class.

| Attribute | Type | Notes |
|---|---|---|
| `owner` | ClassDecl | back-reference |
| `entries` | list of FieldDecl | 0..N |

**Validation rules**:
- At most one `fields` block per class (parse error otherwise).
- Each entry name MUST be unique within the block.

---

### FieldDecl

A single field entry inside a FieldsBlock.

| Attribute | Type | Notes |
|---|---|---|
| `name` | Identifier | unique within owning class |
| `visibility` | enum { public, protected, private } | `@public` / `@protected` / `@private` |
| `default` | Literal? | optional literal; string, integer, or boolean only |

**Validation rules**:
- `visibility` MUST be present (no implicit default).
- `default`, if present, MUST be one of the three literal kinds defined in research R5. Field references inside defaults are a parse error.

**Inheritance**:
- A `@public` or `@protected` field is inherited by descendants and accessible to them.
- A `@private` field is NOT inherited (not visible to children).

---

### Skill

A skill declaration inside a class.

| Attribute | Type | Notes |
|---|---|---|
| `owner` | ClassDecl | back-reference |
| `name` | Identifier | unique within owning class |
| `visibility` | enum { public, protected, private } | required |
| `override_mode` | enum { abstract, virtual, sealed, default } | `default` means no explicit modifier |
| `parameters` | list of Parameter | 0..N |
| `body` | list of Instruction | empty iff `override_mode = abstract` |

**Validation rules**:
- A skill with `override_mode = abstract` MUST have an empty `body` and MUST live inside an abstract class (otherwise parse error or *Override mode mismatch*).
- A skill with `override_mode ∈ { virtual, sealed, default }` MUST have a body.
- If `owner.extends` defines a skill with the same `name`:
  - That parent skill MUST be `virtual` or `abstract`, otherwise the child declaration triggers *Override mode mismatch*.
  - The child skill's `visibility` MUST be the same as or wider than the parent's (semantic rule; the spec will declare this precisely under "Visibility on override").
- A skill MAY reference `base.member` in its body only if `owner.extends` is non-null and the referenced member exists in the ancestor chain (otherwise *Invalid base.* reference*).
- A skill MAY reference `this.member` only if `member` is a field or skill of the owning class (after inheritance lookup) and is visible from inside this class (otherwise *Unknown reference*).
- A skill MAY call `OtherClass.skill_name(...)` only if `OtherClass` exists in the project, `skill_name` is `@public`, and the argument list satisfies the called skill's parameters (otherwise *Unknown reference* or *Visibility violation*).

---

### SkillSignature

A signature-only declaration inside an interface.

| Attribute | Type | Notes |
|---|---|---|
| `name` | Identifier | unique within owning interface |
| `visibility` | enum { public } | interface skills must be `@public` |
| `parameters` | list of Parameter | 0..N |

**Validation rules**:
- An interface signature's `visibility` MUST be `@public`. Non-public signatures are a parse error (interfaces are contracts to outsiders).

---

### Parameter

A parameter on a Skill or SkillSignature.

| Attribute | Type | Notes |
|---|---|---|
| `name` | Identifier | unique within enclosing skill |
| `default` | Literal? | optional |

**Validation rules**:
- Parameter names within a single skill MUST be unique.
- If `default` is present, the parameter is optional at call sites.
- Type is not declared (per FR-008). The LLM infers type from context.

---

### Instruction

A single `- free speech text` bullet.

| Attribute | Type | Notes |
|---|---|---|
| `text` | string | opaque to compiler; preserved verbatim |

**Validation rules**:
- The compiler does not validate `text` content. It is preserved byte-for-byte (modulo newline normalization) and emitted into the corresponding `.skill` file.

---

### MainSkill

The optional `@main` orchestrator skill.

| Attribute | Type | Notes |
|---|---|---|
| `parameters` | always empty | the entry point takes no parameters |
| `body` | list of Instruction \| ThreadingBlock | the only place ThreadingBlock can syntactically appear inside the body at the top level |

**Validation rules**:
- A `@main` skill MUST be inside an `.axm` file (otherwise *Misplaced @main*).
- At most one `@main` skill per file and at most one `.axm` per project (otherwise *Multiple @main skills*).
- The body MUST NOT contain inlined skill content from other classes; it may only contain instructions that are calls and threading blocks (FR-020). The compiler enforces this by checking that every non-block instruction in the body has the form `- call ClassName.skill_name(...)` or `- call ThisOnlyInsideMain...` — i.e., the body is structural.

*Note*: ThreadingBlock can also appear inside a regular skill's body in principle, but the brief only shows it inside `@main`. The spec will explicitly permit threading blocks in any skill body and define that they desugar identically.

---

### ThreadingBlock

A `parallel { ... }` or `pipe(strategy: ...) { ... }` block.

| Attribute | Type | Notes |
|---|---|---|
| `kind` | enum { parallel, pipe } | block keyword |
| `strategy` | enum { per_item, on_complete }? | required iff `kind = pipe`, forbidden iff `kind = parallel` |
| `branches` | list of Instruction | each Instruction inside the block must be a call (no nested threading blocks in v1) |

**Validation rules**:
- A `parallel` block MUST NOT include a `strategy` argument.
- A `pipe` block MUST include exactly `strategy: per_item` or `strategy: on_complete`.
- Each entry inside the block MUST be a call instruction (`- call ClassName.skill_name(...)`).
- Nested threading blocks (a `parallel` inside a `pipe`, etc.) are out of scope for v1 (parse error).

---

### CompiledBundle

The compiler output.

| Attribute | Type | Notes |
|---|---|---|
| `manifest` | Manifest | exactly one (`_manifest.axc`) |
| `fields_files` | list of FieldsFile | one per class that declares its own fields |
| `skill_files` | list of SkillFile | one per skill owned by a concrete declaration (inherited but not overridden skills are NOT re-emitted under the child's name; see FR-024) |
| `main_axc` | MainAxc? | present iff project had a `.axm` |

**Validation rules** (DRY guarantees from FR-024):
- A SkillFile MUST NOT embed the body of any other SkillFile. It references them by relative bundle-path.
- For every ClassDecl with own fields, a single FieldsFile exists in `_fields/` named `{ClassDecl.name}.fields`. The same FieldsFile is referenced from any SkillFile that needs it.
- An inherited (non-overridden) skill of a child class is NOT emitted as a SkillFile under the child's name. The manifest's child-class skill list points to the parent's existing SkillFile.

---

### Manifest

The `_manifest.axc` file.

| Attribute | Type | Notes |
|---|---|---|
| `classes` | list of ClassEntry | one entry per ClassDecl |
| `interfaces` | list of InterfaceEntry | one entry per InterfaceDecl |
| `entry_point` | path? | `main.axc` if MainSkill exists, else absent |

The Manifest is the first file the runtime reads. Its contents are precisely specified by the bundle-format contract (see `contracts/bundle-format.md`).

---

### FieldsFile, SkillFile, MainAxc

These are output-file entities — their structural schema is specified in `contracts/bundle-format.md`. They are listed here for completeness but their detailed content is the runtime contract, not the language data model.

---

## State transitions

Most entities are immutable after parse. Two state transitions matter:

1. **Skill resolution** during the resolver phase:
   - Initial state: skill body contains unresolved `this.*`, `base.*`, and `ClassName.skill_name(...)` references.
   - Transition: resolver looks each reference up against the project's class graph.
   - Final state: each reference is annotated with the absolute path to the resolved entity (skill or field), or the resolver records an error.
2. **Bundle emission** during the emitter phase:
   - Initial state: resolved AST + manifest scaffolding.
   - Transition: emitter writes FieldsFiles first, then SkillFiles, then MainAxc, finally Manifest. (Manifest last because it embeds the paths of everything else.)
   - Final state: a complete `CompiledBundle` directory written to disk.

---

## Coverage trace to spec FRs

| Entity | Primary FRs satisfied |
|---|---|
| Project | FR-019 (one `.axm` max), FR-022 (file extensions) |
| ClassDecl | FR-001, FR-002, FR-004, FR-005 |
| InterfaceDecl | FR-003 |
| FieldsBlock / FieldDecl | FR-011, FR-012, FR-013, FR-014 |
| Skill | FR-006, FR-007, FR-008, FR-009, FR-010, FR-014 |
| MainSkill | FR-019, FR-020, FR-021 |
| ThreadingBlock | FR-015, FR-016, FR-017 |
| CompiledBundle | FR-023, FR-024, FR-025 |
| Manifest | FR-026, FR-030 |
| Instruction | FR-018 |
