---
name: axon-compile
description: Compiles an Axon project from .ax and .axm source files into Claude Code skills under .claude/skills/. Fully self-contained — no external spec file required.
argument-hint: "source_directory (path to the folder containing your .ax and .axm files)"
user-invocable: true
disable-model-invocation: false
metadata:
  author: Axon
  source: .claude/skills/axon-compile/SKILL.md
---

## User Input

```text
$ARGUMENTS
```

The value of `$ARGUMENTS` is the `source_directory` — the path to the folder containing
the `.ax` and `.axm` source files to compile.

---

## Class Context

**Class:** AxonCompiler
**Visibility:** @public
**Parameters:** source_directory
**Own fields:** see ../../shared/AxonCompiler/fields.md
**Inherited fields:** none
**Depends on:** none

---

## Global Operating Constraints

- NEVER interpret instruction bullet text — preserve it verbatim character-for-character
- NEVER write any skill files if any validation error exists
- NEVER write a skill file for `@private` skills (they are not invokable)
- NEVER write a skill file for skills a child inherits unchanged from its parent
- NEVER invent field defaults — if a field has no default in source, write `none`
- ALWAYS collect ALL errors before reporting — never stop at the first one
- ALWAYS write `AxonProject.manifest.md` last
- ALWAYS replace `call ClassName.skill_name(...)` with `/classname-skillname` in emitted SKILL.md files
- This skill is fully self-contained — do NOT look for external spec files

---

## Axon Language Reference

This section embeds everything you need to know about the Axon language. Do not consult any external files.

### Core philosophy

- Axon is a static, object-oriented language for orchestrating LLM agents
- No instances exist — classes are namespaces of behavior
- No explicit types — the LLM infers types from context
- No `if`, `for`, `while` keywords — natural language inside instruction bullets handles all logic
- Single inheritance only — eliminates the diamond problem
- Multiple interfaces allowed per class

### File extensions

- `.ax` files contain class, abstract class, or interface declarations (exactly one per file)
- `.axm` files contain the `@main skill main { }` declaration (at most one per project)

### Top-level declarations

A `.ax` file MUST declare exactly one of:

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

### Main file (`.axm`)

```
@main
skill main {
  - call ClassName.skill_name(args)
  parallel { ... }
  pipe(strategy: per_item) { ... }
}
```

Rules:
- Exactly one `.axm` file per project (zero is also valid — library mode)
- The `@main` skill takes no parameters
- The body is a sequence of calls and threading blocks — never inline content from other classes

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

Two `.ax` files declare a class or interface with the same name.

Suggested fix: rename one, or merge them if they were meant to be the same declaration.

### E10 — Multiple `@main` skills

The project contains more than one `.axm` file, or a single `.axm` contains more than one `@main` skill.

Suggested fix: merge the main files into one, or delete the unintended one.

---

## Execution Steps

### 1. Discover sources

- Scan `source_directory` recursively for all `.ax` files
- Scan for all `.axm` files
- If more than one `.axm` file exists, record an E10 error
- If no source files exist at all, report "empty project" and stop

### 2. Parse sources

- For each `.ax` file, parse exactly one top-level declaration following the Language Reference above
- For each `.axm` file, parse exactly one `@main skill main { ... }` block
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

Apply every semantic rule (SR-1 through SR-13). Detect every error condition (E1 through E10):

- For each concrete class, walk the ancestor chain — for each `abstract` skill, verify the concrete descendant implements it (else E1)
- For each `implements`, verify every required `@public` signature is provided with matching visibility (else E2)
- For every `base.*` reference, verify the parent exists and defines the member (else E3)
- For every call site, verify visibility rules are respected (else E4)
- For every override of a `sealed` skill, record E5
- For every reference to a non-existent class/skill/field, record E6 with a "did you mean" suggestion
- For every override that re-marks with `abstract` or `virtual`, record E8
- Collect ALL errors found

If any errors exist, emit them all using the format above, state that no files were written, and stop.

### 5. Clean up previous compilation

- Check if `.claude/shared/AxonProject.manifest.md` exists
- If absent, skip this step
- If present, read it and find every previously emitted skill folder and class folder
- Delete each listed skill folder from `.claude/skills/`
- Delete each listed class folder from `.claude/shared/`
- Delete `.claude/shared/AxonProject.manifest.md`
- Report how many folders were removed

### 6. Emit shared fields files

- Create `.claude/shared/` if it does not exist
- For each class that declares its own `fields` block:
  - Create folder `.claude/shared/ClassName/`
  - Write `fields.md` inside with this exact structure:

    ```markdown
    # ClassName — fields

    | Field | Visibility | Default |
    |---|---|---|
    | field_name | @private | none |
    | field_name | @protected | actual_default_from_source |
    ```

  - For fields with no default in source, write `none` — DO NOT invent values

### 7. Emit skill files

- Create `.claude/skills/` if it does not exist

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

- instruction bullet exactly as written in source
- call instructions written as /classname-skillname with their arguments
- all other instruction bullets preserved verbatim

## Calls
- /classname-otherskill
- /parentname-skill
(or "none" if this skill makes no calls)
```

**Skip emitting a skill file for:**
- `@private` skills (not invokable)
- Skills a child inherits unchanged from its parent (the parent's file remains canonical)

**If a `.axm` file is present:**

- Create folder `.claude/skills/main/`
- Write `SKILL.md` using this exact template:

```markdown
---
name: main
description: entry point — orchestrates the full project workflow
user-invocable: true
disable-model-invocation: false
---

## Operating Constraints

- Execute instructions in order unless inside a parallel or pipe block
- For parallel blocks: launch all calls as concurrent independent agents
  with no shared intermediate state; wait for all to complete before continuing
- For pipe(strategy: per_item): stream each item from producer to consumer
  as it is emitted; consumer runs once per item
- For pipe(strategy: on_complete): run producer to full completion then
  pass all output to consumer; consumer runs once

## Instructions

- call instructions written as /classname-skillname with their arguments
- parallel blocks preserved with their structure and indentation
- pipe blocks preserved with their strategy
- all other instructions preserved verbatim

## Calls
- /classname-skillname
- /classname-otherskill
```

### 8. Emit project manifest

Write `.claude/shared/AxonProject.manifest.md` with this exact structure:

```markdown
# AxonProject manifest

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

### 9. Report success

- List every folder and file written
- Confirm the project compiled successfully
- List every `/skillname` command now invokable
