# Contract: Axon Compiled Bundle Format

**Status**: draft, to be embedded into the canonical spec (`docs/axon/spec.md`) as the "Output bundle format" section.

**Cross-reference**: implements FR-023, FR-024, FR-025, FR-026, FR-030, FR-031.

This document specifies the on-disk shape of an Axon compiled bundle precisely enough that two independent compiler implementations would produce **byte-equivalent** bundles for the same input project (Success Criterion SC-004). It is the contract between the compiler (which produces bundles) and the LLM runtime (which consumes them).

---

## 1. Directory layout

Every Axon compiled bundle is a directory with the following layout. Files and directories present in `()` are optional.

```
<bundle_root>/
  _manifest.axc                              (always present)
  (main.axc)                                 (present iff project had a .axm file)
  _fields/
    <ClassName>.fields                       (one per class that declares its own fields)
    ...
  _skills/
    <ClassName>.<skill_name>.skill           (one per skill owned by a declaring class — see §1.2)
    ...
```

### 1.1 File and directory ordering

The compiler MUST emit files such that:

1. The directories `_fields/` and `_skills/` are created before any contained files.
2. Within `_fields/`, files MUST be sorted by class name lexicographically (ASCII).
3. Within `_skills/`, files MUST be sorted first by class name then by skill name, both lexicographically.
4. `_manifest.axc` is the **last** file written, after all referenced files exist.

This ordering, together with the deterministic content rules in §3–§6 below, is what makes the bundle byte-equivalent across implementations.

### 1.2 Which skills appear under `_skills/`

A `SkillFile` exists in `_skills/` if and only if the skill is **owned** by some class declaration — meaning that class either (a) originally declared the skill, or (b) overrides a virtual/abstract parent skill with its own body. Inherited-but-not-overridden skills do **not** get a separate file under the child's namespace; the manifest's child-class entry points to the parent's existing SkillFile. This is the DRY guarantee from FR-024.

Examples:
- `Research.write_report` is declared in `Research` → emits `_skills/Research.write_report.skill`.
- `ResearchCompany` overrides `write_report` → emits `_skills/ResearchCompany.write_report.skill`.
- `ResearchCompany` inherits `research` from `Research` unchanged → emits **no** `_skills/ResearchCompany.research.skill`. The manifest links `ResearchCompany.research` to `_skills/Research.research.skill`.

---

## 2. Common file conventions

All bundle files share these rules:

- **Encoding**: UTF-8 without BOM.
- **Line endings**: LF (`\n`) only. No CRLF in any emitted file.
- **Trailing newline**: every file MUST end with exactly one LF.
- **Whitespace**: exactly one space after each `:` separator; no leading whitespace on any structural line. Indentation in list payloads (see §3 and §5) uses exactly **two spaces** per level.
- **Comments**: not supported in any bundle file (the compiler must not emit any).
- **Section headers**: where present, written in uppercase followed by a single LF and a separator line of equal length using `=` characters. Section headers appear only in the manifest (see §6).
- **Key order**: within any file type, the keys MUST appear in the order specified in this document. No alphabetization within a file unless explicitly required.

---

## 3. `.fields` file schema (`_fields/<ClassName>.fields`)

Holds the fields declared by exactly one class. Inherited fields are **not** re-listed here — they remain in their parent's `.fields` file and are joined at runtime via the manifest.

### 3.1 Format

```
CLASS: <ClassName>
<visibility> <field_name>[ = <literal>]
<visibility> <field_name>[ = <literal>]
...
```

### 3.2 Rules

- The first line is the `CLASS:` header. Exactly one space follows the colon. The class name MUST match the file name (without the `.fields` extension).
- Each subsequent non-empty line is one field declaration.
- Field declarations MUST appear in **source order** — the order they appear in the original `fields { }` block. The compiler MUST NOT reorder them.
- `<visibility>` is one of `@public`, `@protected`, `@private`.
- A field with no default is written as `<visibility> <field_name>`.
- A field with a default is written as `<visibility> <field_name> = <literal>` with exactly one space on each side of `=`. The literal is rendered identically to its source form (string literals keep their surrounding quotes; integers and booleans are bare).
- No blank lines between fields. No trailing whitespace on any line.

### 3.3 Example

For `Research`'s field block (from the brief's medium example):

File: `_fields/Research.fields`
```
CLASS: Research
@protected sources
@protected report
@private is_validated = false
```

---

## 4. `.skill` file schema (`_skills/<ClassName>.<skill_name>.skill`)

Holds one skill, fully resolved.

### 4.1 Format

```
CLASS: <ClassName>
SKILL: <skill_name>
VISIBILITY: <visibility>
OVERRIDE_MODE: <override_mode_or_provenance>
PARAMS: <comma_separated_param_list_or_none>
INHERITED FIELDS FROM: <path_or_none>
OWN FIELDS: <path_or_none>
DEPENDS ON:
  - <bundle_relative_path>
  - <bundle_relative_path>
  ...
BODY:
  - <instruction text>
  - <instruction text>
  ...
```

### 4.2 Rules

- All eight header keys (`CLASS`, `SKILL`, `VISIBILITY`, `OVERRIDE_MODE`, `PARAMS`, `INHERITED FIELDS FROM`, `OWN FIELDS`, `DEPENDS ON`) MUST be present in this exact order, even if their value is empty/none.
- `<override_mode_or_provenance>` is one of:
  - `default` — original implementation in this class, no parent had it
  - `virtual` — original implementation marked virtual
  - `sealed` — original implementation marked sealed
  - `inherited (from <ParentClass>)` — emitted only when the manifest's child entry references this file due to inheritance; not used in the body file itself (the body file always reflects the owning class's declared mode)
  - `overrides <ParentClass>.<skill>` — when this skill overrides a parent virtual/abstract
  - `implements abstract from <ParentClass>` — when this skill provides an implementation of a parent abstract
  - `implements <Interface>` — when this skill satisfies an interface contract
  - When more than one provenance applies (e.g., overrides parent AND implements interface), they are joined with `; ` and listed in this priority order: override → abstract impl → interface impl.
- `<comma_separated_param_list_or_none>`: if the skill has no parameters, the value is the literal word `none`. If it has parameters, list them by `name` only (no defaults — defaults are interpreter-side information and live in the manifest if needed). Separate with `, `.
- `INHERITED FIELDS FROM`: bundle-relative path to the parent class's `.fields` file if this skill's owning class has a parent with a `.fields` file, else the literal word `none`. If the inheritance chain has multiple ancestors with fields, list them comma-separated, root-most first.
- `OWN FIELDS`: bundle-relative path to this class's `.fields` file, else `none`.
- `DEPENDS ON`: a YAML-style indented list of bundle-relative paths to every skill file referenced (directly or via `this.*` / `base.*` / `ClassName.skill`) in the body. The list MUST be sorted lexicographically. If empty, the line `DEPENDS ON:` is followed by no list items and a single blank-content marker is **not** emitted (the next section header follows directly).
- `BODY`: an indented list of instructions, written exactly as they appeared in the source (per FR-018, the compiler preserves bullet text verbatim). Each instruction line begins with `  - ` (two spaces, dash, one space). If the skill is `abstract`, the body section is absent — the `.skill` file for an abstract skill is NOT emitted at all (abstract skills only appear in the manifest's signature list).

### 4.3 Example (DRY guarantee in action)

Source (excerpt):
```
class ResearchCompany extends Research implements Researchable {
  @public
  skill research(topic) {                  // inherited from Research unchanged
    // (declared in Research, not in ResearchCompany)
  }

  @protected
  skill write_report {                     // overrides Research.write_report
    - call base.write_report
    - add a financial highlights section to this.report
  }

  @protected
  skill gather_sources(topic) {            // implements Research.gather_sources
    - search financial databases for the topic
    - store all results in this.sources
  }
  ...
}
```

The bundle contains:

`_skills/Research.research.skill`:
```
CLASS: Research
SKILL: research
VISIBILITY: @public
OVERRIDE_MODE: default
PARAMS: topic
INHERITED FIELDS FROM: none
OWN FIELDS: _fields/Research.fields
DEPENDS ON:
  - _skills/Research.gather_sources.skill
  - _skills/Research.validate_sources.skill
  - _skills/Research.write_report.skill
BODY:
  - call this.gather_sources(topic)
  - call this.validate_sources
  - call this.write_report
```

`_skills/ResearchCompany.write_report.skill`:
```
CLASS: ResearchCompany
SKILL: write_report
VISIBILITY: @protected
OVERRIDE_MODE: overrides Research.write_report
PARAMS: none
INHERITED FIELDS FROM: _fields/Research.fields
OWN FIELDS: _fields/ResearchCompany.fields
DEPENDS ON:
  - _skills/Research.write_report.skill
BODY:
  - call base.write_report
  - add a financial highlights section to this.report
```

Note: `_skills/ResearchCompany.research.skill` is **not** present in the bundle — `ResearchCompany.research` is inherited unchanged from `Research`. The manifest (§6) records that the child's `research` skill resolves to `_skills/Research.research.skill`. This is the DRY guarantee made byte-concrete.

---

## 5. `main.axc` schema

The compiled main file. Same overall shape as a `.skill` file but with a different header and no class context.

### 5.1 Format

```
ENTRY: main
DEPENDS ON:
  - <bundle_relative_path>
  ...
BODY:
  - <instruction text>
  ...
```

### 5.2 Rules

- `ENTRY:` is always followed by the literal `main`.
- `DEPENDS ON` and `BODY` follow the same rules as in `.skill` files (§4.2).
- Threading blocks (`parallel { }` / `pipe(strategy: ...) { }`) are emitted into the BODY using a structured form:

  ```
  BODY:
    - parallel:
        - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
        - call EmailSender.send(recipient: "team@co.com", subject: "Done", body: ResearchCompany.report)
    - pipe (strategy: per_item):
        - call FileReader.read_documents
        - call SummaryWriter.write_summary
  ```

  The `parallel:` and `pipe (strategy: <name>):` markers replace a normal `- ` instruction prefix. Each contained call is indented by four spaces from the block marker.

---

## 6. `_manifest.axc` schema

The first file the runtime reads. Enumerates the project's class graph, interface contracts, and entry point. Uses section headers.

### 6.1 Format

```
AXON BUNDLE v1
==============

CLASSES:

  <ClassName> [<kind>]
    extends: <ParentClassName | none>
    implements: <InterfaceName{, InterfaceName} | none>
    fields: <path | none>
    inherited fields: <path{, path} | none>            (omitted entirely if extends = none)
    skills:
      - <skill_name>            [<visibility>, <override_mode_or_provenance>]
      ...

  <ClassName2> [<kind>]
    ...

INTERFACES:

  <InterfaceName>
    required skills:
      - <skill_name>            [<visibility>]
      ...

ENTRY POINT:
  <main.axc | none>
```

### 6.2 Rules

- The header line `AXON BUNDLE v1` and its `=` underline are constants. The `=` line MUST be exactly 14 characters (the length of `AXON BUNDLE v1`).
- Section headers `CLASSES:`, `INTERFACES:`, and `ENTRY POINT:` appear in this order, each preceded by exactly one blank line.
- `<kind>` is `[abstract]` or `[concrete]`.
- Class entries within `CLASSES:` MUST be sorted lexicographically by class name.
- Interface entries within `INTERFACES:` MUST be sorted lexicographically.
- Within a class's `skills:` list, entries MUST be sorted lexicographically by skill name.
- For inherited-but-not-overridden skills, the override-mode tag is `inherited from <ParentClass>` and points (via the manifest semantics) to the parent's skill file.
- For implemented interface skills, the tag includes `implements <InterfaceName>`.
- If no `.axm` was provided, the `ENTRY POINT:` line reads `  none`.

### 6.3 Example (medium example)

```
AXON BUNDLE v1
==============

CLASSES:

  Research [abstract]
    extends: none
    implements: none
    fields: _fields/Research.fields
    skills:
      - gather_sources       [@protected, abstract]
      - research             [@public, default]
      - validate_sources     [@protected, abstract]
      - write_report         [@protected, virtual]

  ResearchCompany [concrete]
    extends: Research
    implements: Researchable
    fields: _fields/ResearchCompany.fields
    inherited fields: _fields/Research.fields
    skills:
      - gather_sources       [@protected, implements abstract from Research]
      - research             [@public, inherited from Research]
      - validate_sources     [@protected, implements abstract from Research]
      - write_report         [@protected, overrides Research.write_report]

INTERFACES:

  Researchable
    required skills:
      - research             [@public]

ENTRY POINT:
  main.axc
```

---

## 7. Byte-equivalence checklist

For two compiler implementations to produce byte-equivalent bundles for the same project, both MUST observe:

1. UTF-8 without BOM, LF-only line endings, exactly one trailing LF per file.
2. Two-space indentation in all list payloads.
3. Single space after every `:` separator.
4. No tabs anywhere in any file.
5. Sorted ordering wherever §1.1, §3.2, §4.2, §6.2 specify sorting; source-order ordering wherever they specify source order.
6. Identical filename casing (class and skill names preserve source casing).
7. No emission of files for abstract skills (only manifest entries).
8. No emission of files for inherited-but-not-overridden skills (only manifest entries pointing to parent).

A compiler that fails any item above is non-conforming.
