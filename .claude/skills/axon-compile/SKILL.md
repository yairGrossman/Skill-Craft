---
name: axon-compile
description: Compiles an Axon project from .ax and .axm source files into Claude Code skills under .claude/skills/
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

## Class Context

**Class:** AxonCompiler
**Visibility:** @public
**Parameters:** source_directory
**Own fields:** see ../../shared/AxonCompiler/fields.md
**Inherited fields:** none
**Depends on:** none

## Operating Constraints

- NEVER interpret instruction bullet text — preserve it verbatim
- NEVER write any skill files if any validation error exists
- NEVER write a skill file for @private skills
- NEVER write a skill file for inherited-unchanged skills
- ALWAYS collect ALL errors before reporting — never stop at the first one
- ALWAYS write AxonProject.manifest.md last
- ALWAYS replace `call ClassName.skill_name(...)` with `/classname-skillname` in emitted SKILL.md files
- For any rule you are uncertain about, read `docs/axon/spec.md` before proceeding

## Execution Steps

### 1. Discover sources

- Scan source_directory for all `.ax` files and at most one `.axm` file
- If more than one `.axm` file exists, report an E10 error and stop
- If no files are found, report that the project is empty and stop

### 2. Parse sources

- For each `.ax` file parse: class/abstract class/interface name, extends clause,
  implements list, fields block with each field's visibility and optional default,
  each skill with its visibility, override mode, parameters, and instruction body
- For the `.axm` file parse: the `@main skill main` declaration and its instruction body
- Treat every instruction bullet as opaque — do not interpret its content
- If any file does not match the Axon grammar in `docs/axon/spec.md §2`, report a
  parse error with file name and line number and stop

### 3. Build class graph

- Build a map from every class and interface name to its full parsed declaration
- If two files declare the same class name, report an E9 error and stop
- Verify all `extends` references point to an existing class in the graph
- Verify all `implements` references point to an existing interface in the graph
- Detect inheritance cycles by walking the `extends` chain — if a class is visited
  twice, report an E7 error listing the full cycle path

### 4. Validate

Apply every semantic rule from `docs/axon/spec.md §4`. Check all 10 error conditions
from `docs/axon/spec.md §6`:

- **E1** — every abstract skill in the ancestor chain must be implemented by concrete classes
- **E2** — every interface contract must be fully satisfied with `@public` skills
- **E3** — every `base.*` reference must point to an existing member in the ancestor chain
- **E4** — visibility must be respected at every call site and field reference
- **E5** — sealed skills must not be overridden
- **E6** — every referenced class, skill, and field must exist in the project
- **E7** — inheritance chains must contain no cycles
- **E8** — child overrides must not re-mark skills with `abstract` or `virtual` modifiers
- **E9** — no two files may declare the same class name
- **E10** — at most one `.axm` file per project

Collect ALL errors found. If any errors exist, report them all following this format:

```
ERROR in <file_path>, line <N>, column <M>:
  <one-line summary>

  <explanation>

  Suggested fix — <description>:

    <code suggestion>
```

State clearly that no files were written. Stop here.

### 5. Clean up previous compilation

- Check if `.claude/shared/AxonProject.manifest.md` exists
- If it does not exist, skip this step — nothing to clean up
- If it exists, read it to get the list of all previously compiled skill folders
  and class folders produced by the last compilation of this project
- Delete every listed skill folder from `.claude/skills/`
- Delete every listed class folder from `.claude/shared/`
- Delete `.claude/shared/AxonProject.manifest.md` itself
- Report how many folders were removed

### 6. Emit shared fields files

- Create `.claude/shared/` if it does not exist
- For each class in the class graph that declares its own fields block:
  - Create folder `.claude/shared/ClassName/`
  - Write `fields.md` inside that folder with this exact structure:

    ```markdown
    # ClassName — fields

    | Field | Visibility | Default |
    |---|---|---|
    | field_name | @private | none |
    | field_name | @protected | value |
    ```

### 7. Emit skill files

- Create `.claude/skills/` if it does not exist
- For each `@public` or `@protected` skill owned by a declaring class:
  - Convert `ClassName.skill_name` to a hyphenated lowercase folder name:
    - `Greeter.greet` → `greeter-greet`
    - `ResearchCompany.write_report` → `researchcompany-writereport`
    - `QuestionGenerator.generate_questions` → `questiongenerator-generatequestions`
  - Create folder `.claude/skills/classname-skillname/`
  - Write `SKILL.md` inside that folder using this exact template:

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

    Bind $ARGUMENTS to parameters in declaration order or by name if named form is used.

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
    - Resolve `this.field_name` against own fields and inherited fields
    - Resolve `base.skill_name` by invoking the skill listed under Inherited fields
    - If an instruction is ambiguous, report the failing instruction and stop

    ## Instructions

    - instruction bullet exactly as written in the source file
    - call instructions written as /classname-skillname with their arguments
    - all other instruction bullets preserved verbatim

    ## Calls
    - /classname-otherskill
    - /parentname-skill
    (or "none" if this skill makes no calls)
    ```

  - Do NOT write a skill file for `@private` skills
  - Do NOT write a skill file for skills a child inherits unchanged from its parent

- If a `.axm` file was present:
  - Create folder `.claude/skills/main/`
  - Write `SKILL.md` inside using this exact template:

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
    - parallel blocks preserved with their structure
    - pipe blocks preserved with their strategy
    - all other instructions preserved verbatim

    ## Calls
    - /classname-skillname
    - /classname-otherskill
    ...
    ```

### 8. Emit project manifest

Write `.claude/shared/AxonProject.manifest.md` with this exact structure:

```markdown
# AxonProject manifest

## Classes
- ClassName [concrete/abstract]
  extends: ParentName (or none)
  implements: InterfaceName, ... (or none)
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
- List every available `/skillname` command the user can now invoke
