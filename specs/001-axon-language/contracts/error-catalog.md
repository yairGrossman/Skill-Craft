# Contract: Axon Compiler Error Catalog

**Status**: draft, to be embedded into the canonical spec (`docs/axon/spec.md`) as the "Compiler error catalog" section.

**Cross-reference**: implements FR-027, FR-028, FR-029.

This document specifies the ten compiler errors that an Axon compiler MUST detect, the exact message format, an example source snippet that triggers each one, and a suggested fix the compiler MUST emit. It is the contract between the compiler (which produces errors) and the developer (who must understand and resolve them).

---

## Common message format

Every error MUST contain four elements (FR-028):

1. **Source file path** (project-relative)
2. **Line and column** (1-indexed)
3. **Human-readable message**
4. **Suggested fix** (concrete code or change, whenever feasible)

The canonical rendered format:

```
ERROR in <file_path>, line <N>, column <M>:
  <one-line summary>

  <longer explanation, optional, wrapped at ~80 columns>

  Suggested fix — <one-line description>:

    <indented code suggestion>
```

If multiple errors are detected in a project, the compiler MUST emit them all (not just the first), separated by one blank line each, and exit non-zero (FR-029). No partial bundle is written on any error.

---

## E1 — Unimplemented abstract skill

**Triggered when** a concrete class extends an abstract ancestor but does not declare every inherited abstract skill.

**Example source** (`research_company.ax`):
```
abstract class Research {
  @protected abstract skill gather_sources(topic)
  @protected abstract skill validate_sources
}

class ResearchCompany extends Research {
  @protected
  skill gather_sources(topic) {
    - search financial databases for the topic
  }
  // validate_sources is missing
}
```

**Message**:
```
ERROR in research_company.ax, line 7, column 1:
  Class 'ResearchCompany' inherits from abstract class 'Research'
  but does not implement abstract skill 'validate_sources'.

  Suggested fix — add an implementation:

    @protected
    skill validate_sources {
      - your implementation here
    }
```

---

## E2 — Interface contract violation

**Triggered when** a class declares `implements <Interface>` but does not provide a `@public` skill matching one of the interface's required signatures (or provides it with the wrong visibility).

**Example source** (`research_company.ax`):
```
interface Researchable {
  @public skill research(topic)
}

class ResearchCompany implements Researchable {
  @protected
  skill research(topic) {                    // wrong visibility
    - ...
  }
}
```

**Message**:
```
ERROR in research_company.ax, line 6, column 1:
  Class 'ResearchCompany' claims to implement interface 'Researchable'
  but skill 'research' has visibility @protected; interface contracts require @public.

  Suggested fix — change the visibility:

    @public
    skill research(topic) { ... }
```

A second sub-case: a required skill is missing entirely. The message replaces the visibility line with "but does not provide skill 'research'" and the suggested fix is to add the skill stub.

---

## E3 — Invalid `base.*` reference

**Triggered when** a skill body uses `base.<member>` in a class that has no `extends` clause, or references a member that does not exist in the ancestor chain.

**Example source A** (no parent — `greeter.ax`):
```
class Greeter {
  @public
  skill greet {
    - call base.recall                       // Greeter has no parent
  }
}
```

**Message**:
```
ERROR in greeter.ax, line 4, column 12:
  'base.recall' is invalid: class 'Greeter' does not extend any class.

  Suggested fix — either remove the base.* reference, or have Greeter extend
  a class that defines 'recall':

    - call this.recall          (if Greeter defines recall locally)
```

**Example source B** (parent exists but member does not):
```
class A { }
class B extends A {
  @public
  skill foo {
    - call base.does_not_exist
  }
}
```

**Message**:
```
ERROR in <file>, line 5, column 12:
  'base.does_not_exist' is invalid: class 'A' does not define 'does_not_exist'.

  Suggested fix — either define 'does_not_exist' in 'A' or one of its ancestors,
  or remove the reference.
```

---

## E4 — Visibility violation

**Triggered when** a `@private` member is referenced from outside its owning class, or a `@protected` member is referenced from outside its inheritance chain.

**Example source** (`main.axm`):
```
@main
skill main {
  - call ResearchCompany.fetch_raw_data(topic: "Apple Inc")    // fetch_raw_data is @private
}
```

**Message**:
```
ERROR in main.axm, line 3, column 8:
  Cannot call '@private' skill 'fetch_raw_data' from outside class 'ResearchCompany'.

  Skill 'fetch_raw_data' is declared @private and is only callable from within
  ResearchCompany.

  Suggested fix — either change visibility to @public or @protected, or call a
  public skill that uses it internally (e.g. ResearchCompany.research).
```

The `@protected`-violation variant uses analogous wording ("from outside the inheritance chain of class 'X'").

---

## E5 — Sealed skill override

**Triggered when** a child class declares a skill that the parent (or any ancestor) has marked `sealed`.

**Example source**:
```
class A {
  @public
  sealed skill foo {
    - do something
  }
}

class B extends A {
  @public
  skill foo {                                // illegal
    - do something else
  }
}
```

**Message**:
```
ERROR in <file>, line 10, column 1:
  Class 'B' cannot override skill 'foo': it is declared 'sealed' in class 'A'.

  Suggested fix — remove the override from 'B'. If 'B' needs different behavior,
  introduce a new skill with a different name, or change 'A.foo' from 'sealed'
  to 'virtual' if the design permits.
```

---

## E6 — Unknown reference

**Triggered when** a skill body references a class, skill, or field that does not exist in the project.

**Example source** (`main.axm`):
```
@main
skill main {
  - call NoSuchClass.do_thing(topic: "x")
}
```

**Message**:
```
ERROR in main.axm, line 3, column 8:
  Unknown reference: class 'NoSuchClass' is not defined in this project.

  Suggested fix — check the spelling, or add a 'no_such_class.ax' file
  declaring 'class NoSuchClass { ... }'.
```

Variants:
- Unknown skill on a known class: "Class 'X' has no skill 'Y'." Suggested fix: list nearby names if Levenshtein distance ≤ 2 to a real skill.
- Unknown field: "Class 'X' has no field 'Y'."

The compiler SHOULD perform a "did you mean?" suggestion when a close match exists.

---

## E7 — Cyclical inheritance

**Triggered when** the `extends` chain contains a cycle.

**Example source** (across three files):
```
class A extends C { }
class B extends A { }
class C extends B { }
```

**Message**:
```
ERROR in a.ax, line 1, column 1:
  Cyclical inheritance detected:

    A → C → B → A

  Suggested fix — break the cycle by removing one of these 'extends' clauses,
  or restructure the hierarchy so that no class transitively extends itself.
```

The cycle path MUST be printed starting at the class declared in the file the error points to.

---

## E8 — Override mode mismatch

**Triggered when** a child class declares a skill whose parent's same-named skill is neither `virtual` nor `abstract` — i.e., the parent's skill is `sealed` (covered by E5) or `default` (covered here).

**Example source**:
```
class A {
  @public
  skill foo {                                // default mode — overridable
    - do something
  }

  @public
  skill bar {                                // also default, but the child can override
    - do something
  }
}

class B extends A {
  @public
  skill bar {                                // OK — default parents are overridable
    - new behavior
  }
}
```

Wait — re-reading FR-007 carefully:

> default (has body, child MAY override)

The default mode **is** overridable. So E8 only fires when the parent is explicitly `sealed`, which is already E5. **E8 collapses into E5 in practice**. To preserve a distinct E8, the spec will use it for a different mismatch:

**Triggered when** a child declares a skill with an explicit `virtual` or `abstract` modifier while overriding (override modifiers on the child make no sense — a child re-declaring an inherited skill is by definition an override; trying to also mark it `abstract` or `virtual` is a category error).

**Example source**:
```
class A {
  @public
  virtual skill foo {
    - parent body
  }
}

class B extends A {
  @public
  abstract skill foo                         // a concrete class cannot have abstract skill;
                                             // also: overriding by re-marking as abstract is invalid
}
```

**Message**:
```
ERROR in <file>, line 10, column 1:
  Override mode mismatch on 'B.foo': a child class cannot mark an overriding
  skill as 'abstract' or 'virtual'. The override mode is determined by the
  declaring (ancestor) class.

  Suggested fix — remove the 'abstract'/'virtual' modifier from the child:

    @public
    skill foo {
      - your override body
    }
```

A second sub-case: the child re-declares the parent's skill as `sealed`. Sealed status flows from the **first** definition and may be re-affirmed (no-op) but not downgraded. The spec will define this precisely.

---

## E9 — Duplicate class name

**Triggered when** two `.ax` files declare a class (or interface) with the same name.

**Example source**:
- `greeter.ax`: `class Greeter { ... }`
- `greeter2.ax`: `class Greeter { ... }`

**Message**:
```
ERROR in greeter2.ax, line 1, column 1:
  Duplicate class name 'Greeter'. Already declared in greeter.ax (line 1).

  Suggested fix — rename one of the classes, or merge them into a single
  declaration if they were meant to be the same.
```

The error points to the **second** occurrence (in lexicographic file order if the compiler scans deterministically). The first occurrence is referenced by file + line in the message.

---

## E10 — Multiple `@main` skills

**Triggered when** either (a) the project contains more than one `.axm` file, or (b) a single `.axm` contains more than one `@main` skill declaration.

**Example case A** — two `.axm` files: `main.axm`, `main2.axm`.

**Message**:
```
ERROR: Project contains multiple .axm files:

  - main.axm
  - main2.axm

  A project must declare at most one @main entry point.

  Suggested fix — merge the two main files into one, or delete the one
  that is not the intended entry point.
```

**Example case B** — single file with two `@main`:
```
@main
skill main {
  - ...
}

@main
skill main {
  - ...
}
```

**Message**:
```
ERROR in main.axm, line 6, column 1:
  Multiple @main skills declared in a single file. Exactly one @main is permitted.

  Suggested fix — keep only one @main skill block and remove the others.
```

Note this case A does not have a single source file/line; the format relaxes "Line N, Column M" for project-wide errors. The spec will say so explicitly.

---

## Coverage trace

| Error | FR-027 enum entry | Catalog entry above |
|---|---|---|
| 1. Unimplemented abstract skill | yes | E1 |
| 2. Interface contract violation | yes | E2 |
| 3. Invalid `base.*` reference | yes | E3 |
| 4. Visibility violation | yes | E4 |
| 5. Sealed skill override | yes | E5 |
| 6. Unknown reference | yes | E6 |
| 7. Cyclical inheritance | yes | E7 |
| 8. Override mode mismatch | yes | E8 |
| 9. Duplicate class name | yes | E9 |
| 10. Multiple `@main` skills | yes | E10 |

All ten errors covered.
