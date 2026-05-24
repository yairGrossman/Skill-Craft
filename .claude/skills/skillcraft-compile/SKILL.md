---
name: skillcraft-compile
description: Compiles a Skill Craft project from .skillc and .skillcm source files into Claude Code skills under .claude/skills/. Fully self-contained — no external spec file required.
argument-hint: "source_directory (path to the folder containing your .skillc and .skillcm files)"
user-invocable: true
disable-model-invocation: false
metadata:
  author: Skill Craft
  source: .claude/skills/skillcraft-compile/SKILL.md
---

## User Input

```text
$ARGUMENTS
```

The value of `$ARGUMENTS` is the `source_directory` — the path to the folder containing
the `.skillc` and `.skillcm` source files to compile.

---

## Class Context

**Class:** SkillCraftCompiler
**Visibility:** @public
**Parameters:** source_directory
**Own fields:** see ../../shared/SkillCraftCompiler/fields.md
**Inherited fields:** none
**Depends on:** none

---

## Global Operating Constraints

- NEVER interpret instruction bullet text — preserve it verbatim character-for-character
- NEVER write any skill files if any validation error exists
- NEVER write a skill file for `@private` skills (they are not invokable)
- NEVER write a skill file for `abstract` skills — they have no body and are not invokable; they appear only in the manifest as contract requirements
- NEVER write a skill file for skills a child inherits unchanged from its parent
- NEVER invent field defaults — if a field has no default in source, write `none`
- ALWAYS collect ALL errors before reporting — never stop at the first one
- ALWAYS write `SkillCraftProject.manifest.md` last
- ALWAYS replace `call ClassName.skill_name(...)` with `/classname-skillname` in emitted SKILL.md files
- ENRICH each non-call instruction bullet with 1–4 specific sub-bullets (see Step 7a) — enrichment is distinct from validation; SR-3 applies only to validation
- ALWAYS wrap the `source-hash` frontmatter value in double quotes — the value contains colons and pipes that YAML would otherwise misparse
- This skill is fully self-contained — do NOT look for external spec files

---

## Skill Craft language Reference

This section embeds everything you need to know about the Skill Craft language. Do not consult any external files.

### Core philosophy

- Skill Craft is a static, object-oriented language for orchestrating LLM agents
- No instances exist — classes are namespaces of behavior
- No explicit types — the LLM infers types from context
- No `if`, `for`, `while` keywords — natural language inside instruction bullets handles all logic
- Single inheritance only — eliminates the diamond problem
- Multiple interfaces allowed per class

### File extensions

- `.skillc` files contain class, abstract class, or interface declarations (exactly one per file)
- `.skillcm` files contain the `@main skill main { }` declaration (at most one per project)

### Top-level declarations

A `.skillc` file MUST declare exactly one of:

**Class:**
```
class ClassName extends ParentName implements InterfaceA, InterfaceB {
  // optional fields block, then any number of skills
}
```

**Abstract class:**
```
abstract class ClassName extends ParentName implements InterfaceA {
  // may contain abstract skills with no body
}
```

**Interface:**
```
interface InterfaceName {
  // skill signatures only, no bodies, no fields
}
```

`extends` and `implements` are both optional. Only one `extends` parent is allowed. Any number of `implements` interfaces is allowed (comma-separated).

### Fields block

Inside a class (NOT inside an interface):
```
fields {
  @public field_name
  @protected field_name = default_value
  @private field_name = "quoted value with spaces"
}
```

Rules:
- At most one `fields` block per class
- Each field MUST have a visibility modifier (`@public`, `@protected`, or `@private`)
- Defaults are optional — if absent, the field has no default
- Default values may be: unquoted single words, quoted strings, integers, booleans (`true`/`false`)
- Interfaces MAY NOT have fields

### Skill declarations

```
@public
skill skill_name(param1, param2 = default) {
  - free speech instruction
  - call this.other_skill
  - call base.parent_skill
  - call OtherClass.public_skill(arg1, arg2)
}
```

**Visibility modifiers (required):** `@public`, `@protected`, `@private`

**Override modes (optional, before `skill` keyword):**
- `abstract` — no body, child MUST implement (only allowed in abstract classes)
- `virtual` — has body, child MAY override
- `sealed` — has body, child CANNOT override
- (default — no modifier) — has body, child MAY override

**Parameters:**
- Zero or more, comma-separated
- Each may have an optional default value (same value rules as fields)
- No type annotations

**Body:**
- A sequence of instruction bullets (`- text`)
- Bullets are free-speech text — the compiler does NOT interpret their content
- Bullets that begin with `call ` are call expressions and ARE parsed by the compiler

### Call expressions

Three forms:

**This-call (same class):**
```
- call this.skill_name
- call this.skill_name(arg)
```

**Base-call (parent class):**
```
- call base.skill_name
- call base.skill_name(arg)
```

**Cross-call (any other class):**
```
- call OtherClass.skill_name
- call OtherClass.skill_name(topic: Apple Inc, amount: 10)
- call OtherClass.skill_name(Apple Inc, 10)
```

Arguments may be **named** (`param: value`) or **positional** (`value`). Mixing in the same call is not allowed.

Multi-word values do not require quotes — the comma between arguments and the closing parenthesis act as natural delimiters:
```
- call generate(topic: Apple Inc, style: critical thinking)
```

Quoted strings are also accepted but never required:
```
- call generate(topic: "Apple Inc", style: "critical thinking")
```

### Threading blocks

Threading blocks appear only inside skill bodies (most commonly in `@main`):

**Parallel** (fire-and-forget, no shared state):
```
parallel {
  - call ClassA.skill_one
  - call ClassB.skill_two
}
```

**Pipe with `per_item` strategy** (stream each item as produced):
```
pipe(strategy: per_item) {
  - call Reader.read_documents
  - call Writer.write_summary
}
```

**Pipe with `on_complete` strategy** (batch — wait for producer to finish):
```
pipe(strategy: on_complete) {
  - call Reader.read_documents
  - call Writer.write_summary
}
```

### Main file (`.skillcm`)

A `.skillcm` file may contain zero or more **local skills** plus exactly one `@main` skill. Local skills may appear before or after `@main`.

```
skill local_skill_name(param1, param2 = default) {
  - free speech instruction
  - call ClassName.skill_name(args)
}

@main
skill main {
  - call local_skill_name(param1: value)
  - call ClassName.skill_name(args)
  parallel { ... }
  pipe(strategy: per_item) { ... }
}
```

Rules:
- Exactly one `.skillcm` file per project (zero is also valid — library mode)
- The `@main` skill takes no parameters
- Local skills have NO visibility modifier — they are implicitly private to the `.skillcm` file
- Local skills accept zero or more parameters (same syntax as class skills)
- Local skills are called from `@main` using `call local_skill_name(...)` — no class prefix
- Local skills CANNOT be called from `.skillc` class files — this is an E4 error
- Local skills ARE enriched (Step 7a) the same way class skills are

### Free-speech logic inside bullets

There are no `if`, `for`, `while` keywords. Logic is expressed naturally:
```
- if this.is_validated is false, show an error
- for each source in this.sources, validate its credibility
- keep retrying until the response is valid, up to 3 attempts
```

The compiler treats these as opaque text and emits them verbatim. The runtime LLM interprets them.

---

## Semantic Rules

These are the rules the compiler MUST enforce during validation:

### SR-1 — Single inheritance
A class may have at most one `extends` parent. Multiple `extends` clauses are a parse error.

### SR-2 — Inheritance lookup
`this.member` resolves against the owning class first, then walks the `extends` chain. `base.member` starts at the parent of the calling class.

### SR-3 — Instruction opacity
The compiler does NOT interpret instruction bullet text. Only call expressions are parsed. All other text is preserved verbatim.

### SR-4 — Argument binding
Arguments at a call site MUST be either all named or all positional. Mixing in a single call is not allowed. Named match by parameter name in any order. Positional match by declaration order. Required parameters (those without defaults) MUST be supplied.

### SR-5 — Default values
Defaults may be: quoted strings, integers, booleans (`true`/`false`), or unquoted single words. Field references, skill calls, and expressions as defaults are not allowed.

### SR-6 — Field visibility on inheritance
`@public` and `@protected` fields are inherited by children. `@private` fields are NOT inherited.

### SR-7 — Override mode rules
- `abstract` skills MUST be implemented in concrete children
- `virtual` skills MAY be overridden
- `sealed` skills MUST NOT be overridden
- (default) skills MAY be overridden
- A child overriding a skill MUST NOT re-mark it with `abstract` or `virtual` modifiers — the mode is fixed by the declaring ancestor

### SR-8 — Visibility on override
A child's override visibility MUST be the same as or wider than the parent's. (`@private` cannot be widened — it isn't inherited at all.)

### SR-9 — Visibility enforcement at call sites
- `@private` skills are callable only from within their owning class
- `@protected` skills are callable from within the class and its descendants
- `@public` skills are callable from anywhere

### SR-10 — Cross-class field reads
A `@public` field may be read from outside its owning class via `OtherClass.field_name`. Cross-class WRITES are not allowed in v1.

### SR-11 — Threading semantics
- `parallel` blocks: agents are independent, no shared state, all must complete before continuing
- `pipe(strategy: per_item)`: consumer runs once per item as the producer emits
- `pipe(strategy: on_complete)`: consumer runs once after producer fully completes

### SR-12 — Multi-stage pipes
A pipe may have more than two stages. The strategy applies pairwise between consecutive stages.

### SR-13 — Main body restriction
The body of `@main` MAY contain only call instructions and threading blocks. It MUST NOT contain inlined skill content.

### SR-14 — Local skill scope
Skills declared in a `.skillcm` file without a visibility modifier are implicitly `@private` to that file. They may be called by `@main` or by other local skills in the same `.skillcm` file. A `.skillc` skill attempting to call a local `.skillcm` skill is an E4 visibility violation. Local skill names MUST NOT collide with each other — a duplicate local skill name is an E9 variant.

---

## Compiler Errors

Collect ALL errors before reporting. Each error MUST include source file, line and column, a human-readable message, and a concrete suggested fix.

### Format

```
ERROR in <file_path>, line <N>, column <M>:
  <one-line summary>

  <longer explanation>

  Suggested fix — <description>:

    <indented code suggestion>
```

### E1 — Unimplemented abstract skill

A concrete class extends an abstract ancestor but does not implement every inherited abstract skill.

Suggested fix: add `@<visibility> skill <name> { ... }` to the child class.

### E2 — Interface contract violation

A class declares `implements <Interface>` but does not provide a `@public` skill matching one of the interface's required signatures (or provides it with the wrong visibility).

Suggested fix: change visibility to `@public`, or add the missing skill stub.

### E3 — Invalid `base.*` reference

A skill body uses `base.<member>` in a class that has no `extends` clause, or references a member that does not exist in the ancestor chain.

Suggested fix: remove `base.*`, or have the class extend a class that defines the member.

### E4 — Visibility violation

A `@private` member referenced from outside its owning class, or a `@protected` member referenced from outside the inheritance chain.

Suggested fix: change visibility, or call a public skill that uses it internally.

### E5 — Sealed skill override

A child class declares a skill that the parent (or any ancestor) has marked `sealed`.

Suggested fix: remove the override, or change the parent's `sealed` to `virtual` if the design permits.

### E6 — Unknown reference

A skill body references a class, skill, or field that does not exist in the project. Suggest the closest existing name (Levenshtein distance ≤ 2) if any.

Suggested fix: check spelling, or add the missing declaration.

### E7 — Cyclical inheritance

The `extends` chain contains a cycle (e.g., A → B → A).

Suggested fix: break the cycle by removing one of the `extends` clauses.

### E8 — Override mode mismatch

A child class declares a skill with an explicit `abstract` or `virtual` modifier while overriding a parent skill. The mode is fixed by the declaring ancestor.

Suggested fix: remove the modifier from the override.

### E9 — Duplicate class name

Two `.skillc` files declare a class or interface with the same name.

Suggested fix: rename one, or merge them if they were meant to be the same declaration.

### E10 — Multiple `@main` skills

The project contains more than one `.skillcm` file, or a single `.skillcm` contains more than one `@main` skill.

Suggested fix: merge the main files into one, or delete the unintended one.

---

## Execution Steps

### 1. Discover sources

- Scan `source_directory` recursively for all `.skillc` files
- Scan for all `.skillcm` files
- If more than one `.skillcm` file exists, record an E10 error
- If no source files exist at all, report "empty project" and stop

### 2. Parse sources

- For each `.skillc` file, parse exactly one top-level declaration following the Language Reference above
- For each `.skillcm` file, parse zero or more local skill declarations (`skill name(...) { ... }` with no `@` modifier) and exactly one `@main skill main { ... }` block, in any order; local skills: record name, parameters, and body bullets (same parsing as class skills); if two local skills share the same name, record an E9 error
- Identify all skill bodies — within each body, treat non-call bullets as opaque text
- For each call instruction (`- call ...`), parse the target and arguments
- If a file violates the grammar, record a parse error with file name, line, and column

### 3. Build class graph

- Build a map: class/interface name → its full parsed declaration
- If two declarations share the same name, record an E9 error
- Resolve every `extends` reference — verify the parent exists and is a class (not an interface)
- Resolve every `implements` reference — verify the target exists and is an interface
- Walk every `extends` chain — if any class is visited twice during a walk, record an E7 error with the full cycle path

### 4. Validate

Apply every semantic rule (SR-1 through SR-14). Detect every error condition (E1 through E10):

- For each concrete class, walk the ancestor chain — for each `abstract` skill, verify the concrete descendant implements it (else E1)
- For each `implements`, verify every required `@public` signature is provided with matching visibility (else E2)
- For every `base.*` reference, verify the parent exists and defines the member (else E3)
- For every call site, verify visibility rules are respected (else E4)
- For every override of a `sealed` skill, record E5
- For every reference to a non-existent class/skill/field, record E6 with a "did you mean" suggestion
- For every override that re-marks with `abstract` or `virtual`, record E8
- For each call in a `.skillc` skill body that references a local `.skillcm` skill name, record an E4 error (local skills are private to `.skillcm`)
- For each call in `@main` or a local skill of the form `call name(...)` (no `ClassName.` prefix, not `this.*` or `base.*`), verify `name` exists as a local skill in the same `.skillcm` — if not, record an E6 unknown reference error
- Collect ALL errors found

If any errors exist, emit them all using the format above, state that no files were written, and stop.

### 5. Load previous compilation state

- Check if `.claude/shared/SkillCraftProject.manifest.md` exists
- If absent: fresh compilation — set `previous_skill_folders` = empty set, `previous_class_folders` = empty set
- If present: read it, extract the **Skill folders** list → `previous_skill_folders`, extract the **Class folders in shared** list → `previous_class_folders`
- Do NOT delete anything yet — deletion happens in Step 8.5 after the new manifest is fully known
- Track three counters: `created = 0`, `updated = 0`, `unchanged = 0`

### 5a. Fingerprint computation

A **source fingerprint** is a compact string derived from parsed source that uniquely represents the content of one emitted file. It is stored in the `source-hash` frontmatter field of each emitted file and used in subsequent compilations to detect changes without reading the full file.

**Skill fingerprint** — concatenate, joined by `|`:
1. `visibility:<@public|@protected>` — the skill's visibility modifier
2. `mode:<default|virtual|sealed>` — the skill's override mode (`default` if no modifier)
3. `params:<p1,p2=default2,...>` — comma-separated parameter names; if a parameter has a default, append `=<default>` immediately after the name (no spaces); write empty string if no params
4. Each instruction bullet verbatim, in declaration order

Example for `@public virtual skill greet(name, lang = en) { - greet name warmly - store in last_greeting }`:
```
visibility:@public|mode:virtual|params:name,lang=en|greet name warmly|store in last_greeting
```

**Fields fingerprint** — concatenate, joined by `|`, one entry per field:
```
<field_name>:<visibility>:<default>
```
Example: `api_key:@private:default|report:@protected:none`

**Main fingerprint** — concatenate, joined by `|`: for each local skill in declaration order: `local:<name>|params:<...>|<bullet1>|<bullet2>|...`, then all `@main` instruction bullets verbatim.

**How to use during emit (Steps 6 and 7):**
1. Compute the fingerprint from parsed source
2. Check if the target file already exists
3. If it exists: read only its `source-hash` frontmatter line (do not read the whole file)
4. Compare computed fingerprint to stored fingerprint:
   - **Same** → skip writing, increment `unchanged`
   - **Different or file absent** → write the file (full content), increment `created` or `updated`
   - Enriched sub-bullets are generated from source text; they do NOT affect the fingerprint — the fingerprint is always computed from the original parsed source

### 6. Emit shared fields files

- Create `.claude/shared/` if it does not exist
- For each class that declares its own `fields` block:
  - Create folder `.claude/shared/ClassName/`
  - Write `fields.md` inside with this exact structure:

    ```markdown
    ---
    source-hash: "field_name:@private:none|field_name:@protected:actual_default"
    ---

    # ClassName — fields

    | Field | Visibility | Default |
    |---|---|---|
    | field_name | @private | none |
    | field_name | @protected | actual_default_from_source |
    ```

  - For fields with no default in source, write `none` — DO NOT invent values
  - Apply the fingerprint check from Step 5a before writing — skip if fingerprint matches

### 7. Emit skill files

- Create `.claude/skills/` if it does not exist

### 7a. Instruction enrichment

Before writing each skill file, enrich every non-call instruction bullet by generating 1–4 specific sub-bullets that answer one or more of:
- **Which tool / library / API** — e.g. "Use Python's `reportlab` library (pip install reportlab arabic-reshaper python-bidi)"
- **What input format to expect** — e.g. "Expect a JSON object with a top-level `questions` array; each item has `text` (string), `options` (string[]), `answer` (0-based index)"
- **What output format / structure to produce** — e.g. "Produce a 3-section PDF: questions pages, answer-chart page, solutions page"
- **Encoding / locale / direction** — e.g. "Configure RTL base direction using python-bidi's `get_display()`; reshape characters with arabic-reshaper before passing to reportlab"
- **Validation / error handling** — e.g. "If the file is missing or unreadable, print a clear error and exit before generating any output"

Rules for enrichment:
- Preserve the original bullet verbatim as the parent bullet; sub-bullets are indented children
- Only add sub-bullets that add meaningful precision — skip if the original is already concrete (e.g. "call json.load()")
- Do NOT alter the semantic meaning of the original instruction
- Call instructions (converted to `/classname-skillname`) receive NO enrichment — they are already precise

Use the skill's class name, skill name, parameters, and full instruction list as context when deciding what sub-bullets to generate.

**For each `@public` or `@protected` skill owned by a declaring class:**

- Convert `ClassName.skill_name` to a hyphenated lowercase folder name:
  - `Greeter.greet` → `greeter-greet`
  - `ResearchCompany.write_report` → `researchcompany-writereport`
  - `QuestionGenerator.generate_questions` → `questiongenerator-generatequestions`
- Create folder `.claude/skills/classname-skillname/`
- Write `SKILL.md` inside using this exact template:

```markdown
---
name: classname-skillname
description: one sentence describing what this skill does
argument-hint: "param1, param2"
user-invocable: true
disable-model-invocation: false
source-hash: "params:param1,param2|instruction bullet one|instruction bullet two"
---

## User Input

$ARGUMENTS

Bind $ARGUMENTS to parameters in declaration order, or by name if named form is used.

## Class Context

**Class:** ClassName
**Visibility:** @public or @protected
**Override mode:** default / virtual / sealed
**Parameters:** param1, param2 = default (or "none")
**Own fields:** see ../../shared/ClassName/fields.md (or "none")
**Inherited fields:** see ../../shared/ParentClassName/fields.md (or "none")
**Depends on:** /classname-otherskill, /parentname-skill (or "none")

## Operating Constraints

- Read own fields and inherited fields files before executing any instruction
- Resolve `this.field_name` against own and inherited fields
- Resolve `base.skill_name` by invoking the skill listed under Inherited fields
- Persist any field writes back to the corresponding fields file
- If an instruction is ambiguous, report the failing instruction and stop

## Instructions

(non-call bullets — each followed by enrichment sub-bullets)
- instruction bullet exactly as written in source
  - [specific tool / library / method to use]
  - [expected input format and validation]
  - [expected output format or side-effect]
  - [error handling or edge case — only if relevant]

(call bullets — no enrichment)
- /classname-skillname (arguments)

## Calls
- /classname-otherskill
- /parentname-skill
(or "none" if this skill makes no calls)
```

- Apply the fingerprint check from Step 5a before writing each file — skip if fingerprint matches

**Skip emitting a skill file for:**
- `@private` skills (not invokable)
- `abstract` skills (no body — not invokable; record them in the manifest only as contract requirements)
- Skills a child inherits unchanged from its parent (the parent's file remains canonical)

**If a `.skillcm` file is present:**

- Create folder `.claude/skills/main/`
- Apply the fingerprint check from Step 5a before writing — skip if fingerprint matches
- Write `SKILL.md` using this exact template:

```markdown
---
name: main
description: entry point — orchestrates the full project workflow
user-invocable: true
disable-model-invocation: false
source-hash: "local:skill_name|params:...|bullet|...|main bullet one|main bullet two"
---

## Operating Constraints

- Execute instructions in order unless inside a parallel or pipe block
- For parallel blocks: launch all calls as concurrent independent agents
  with no shared intermediate state; wait for all to complete before continuing
- For pipe(strategy: per_item): stream each item from producer to consumer
  as it is emitted; consumer runs once per item
- For pipe(strategy: on_complete): run producer to full completion then
  pass all output to consumer; consumer runs once
- When an instruction says `call local_skill_name(...)`, execute the matching
  local skill defined in the ## Local Skills section of this file

## Local Skills

(present only if the `.skillcm` declares at least one local skill; omit this entire section otherwise)

### local_skill_name
**Parameters:** param1, param2 = default (or "none")
**Calls:** /classname-skillname (or "none")

- instruction bullet exactly as written in source
  - [enrichment sub-bullets — same rules as Step 7a]
- /classname-skillname (arguments)

## Instructions

- call local_skill_name(param: value)
- /classname-skillname (arguments)
- parallel blocks preserved with their structure and indentation
- pipe blocks preserved with their strategy
- all other instructions preserved verbatim

## Calls
- /classname-skillname
- /classname-otherskill
```

**Local skill emit rules:**
- Local skills do NOT get their own SKILL.md folder — they are inlined into `main/SKILL.md` under `## Local Skills`
- Each local skill becomes a `### skill_name` subsection with its parameters, calls, and enriched body
- Class skill calls inside local skill bodies ARE converted to `/classname-skillname`
- Calls to local skills in `@main` body are preserved as `call skill_name(...)` — not converted
- If no local skills exist, omit the `## Local Skills` section entirely

### 8. Emit project manifest

Write `.claude/shared/SkillCraftProject.manifest.md` with this exact structure:

```markdown
# SkillCraftProject manifest

## Classes
- ClassName [concrete|abstract]
  extends: ParentName (or none)
  implements: InterfaceA, InterfaceB (or none)
  fields: shared/ClassName/fields.md (or none)
  skills:
    - classname-skillname (own) → .claude/skills/classname-skillname/SKILL.md
    - parentname-skill (inherited from ParentName) → .claude/skills/parentname-skill/SKILL.md

## Interfaces
- InterfaceName
  requires: skill1, skill2

## Entry point
- main → .claude/skills/main/SKILL.md (or none)

## Skill folders
- classname-skillname
- classname-otherskill
- main

## Class folders in shared
- ClassName
- ParentName
```

### 8.5. Delete obsolete files

After all emit steps complete, compute what is no longer needed:

- `removed_skill_folders` = `previous_skill_folders` − `new_skill_folders`
- `removed_class_folders` = `previous_class_folders` − `new_class_folders`

For each folder in `removed_skill_folders`: delete `.claude/skills/<folder>/` and its contents
For each folder in `removed_class_folders`: delete `.claude/shared/<folder>/` and its contents

Track `deleted` counter = total folders removed.

### 9. Report success

Report a compact incremental summary:

```
Compiled successfully.

  created:   N  (new files)
  updated:   N  (changed files)
  unchanged: N  (skipped — fingerprint matched)
  deleted:   N  (removed — no longer in source)

Invokable skills:
  /classname-skillname
  /classname-otherskill
  /main
```
