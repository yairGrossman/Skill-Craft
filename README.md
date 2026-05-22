# Axon

Axon is an object-oriented programming language for orchestrating AI agents (specifically Claude). Instead of writing prompts directly, you write structured classes and skills — and the Axon compiler turns them into a self-describing bundle that Claude reads and executes.

**Both the compiler and the runtime are Claude.** There is no classical code involved. The compiler is an Axon skill — a precise set of instructions that Claude follows to parse source files, validate structural rules, and emit the bundle.

**The idea in one sentence**: take all the discipline that makes software maintainable — encapsulation, inheritance, interfaces, visibility rules — and apply it to prompt engineering.

---

## Table of Contents

- [Installation](#installation)
- [Why Axon Exists](#why-axon-exists)
- [Core Concepts](#core-concepts)
- [A Quick Tour of the Syntax](#a-quick-tour-of-the-syntax)
- [Example: Hello World](#example-hello-world)
- [Example: Inheritance and Interfaces](#example-inheritance-and-interfaces)
- [Example: Multi-Agent Orchestration](#example-multi-agent-orchestration)
- [How the Compiler Works](#how-the-compiler-works)
- [The Output Bundle](#the-output-bundle)
- [How Claude Executes a Bundle](#how-claude-executes-a-bundle)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## Installation

One command installs everything you need to develop in Axon:
- the **axon-compile** skill for Claude Code
- the **Axon VS Code extension** (syntax highlighting + snippets)
- a ready-to-run **example project** in an `axon/` folder

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/yairGrossman/Axon/main/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/yairGrossman/Axon/main/install.sh | bash
```

Run from inside any project folder. After installation, open the `axon/` folder in Claude Code and run `/axon-compile` to compile the example.

---

## Why Axon Exists

When you build with LLMs today, prompts live in strings scattered across your code. They are hard to reuse, impossible to inherit, and easy to duplicate. There is no visibility system to prevent one agent from stepping on another's instructions.

Axon treats prompts as first-class citizens of a type system:

| Traditional code | Axon |
|---|---|
| Methods on objects | **Skills** on classes |
| Instance variables | **Fields** (class-scoped shared memory) |
| `public` / `protected` / `private` | Same — enforced by the compiler |
| Inheritance, abstract methods | Inheritance, `abstract` / `virtual` / `sealed` skills |
| Interfaces | Interfaces with required skill signatures |
| Threading primitives | `parallel {}` and `pipe(strategy:) {}` blocks |

The instructions inside skills are **free-speech natural language** — you write what you want Claude to do, not how to do it. The compiler enforces the structure; Claude handles the reasoning.

---

## Core Concepts

### Classes

A **class** is a static namespace of behavior. There are no instances and no constructors — a class is more like a named agent persona than a Java object.

```axon
class Greeter {
  fields {
    @private last_greeting
  }

  @public
  skill greet(name) {
    - greet name warmly
    - store the greeting in this.last_greeting
  }
}
```

### Skills

A **skill** is a named unit of LLM instruction. Its body is a list of `- instruction` bullets that Claude reads and executes.

Skills have three properties:

- **Visibility** — `@public`, `@protected`, or `@private`
- **Override mode** — `abstract` (must be implemented by a child), `virtual` (may be overridden), `sealed` (cannot be overridden), or default (may be overridden)
- **Parameters** — untyped; Claude infers types from context

### Fields

**Fields** are class-scoped shared memory. All skills in a class share the same fields. They follow the same visibility rules as skills.

```axon
fields {
  @private   api_key = "default"
  @protected report
}
```

### Visibility

| Modifier | Who can see it |
|---|---|
| `@public` | Any class, any file |
| `@protected` | This class and its descendants |
| `@private` | This class only |

The compiler enforces these rules at every call site. Violations are caught at compile time, not runtime.

---

## A Quick Tour of the Syntax

```
.ax   →  class / abstract class / interface definition
.axm  →  the optional entry point (at most one per project)
```

To compile a project, give Claude the Axon compiler skill and your source directory. Claude reads the skill, parses your `.ax` and `.axm` files, validates all structural rules, and emits a **bundle directory** you hand back to Claude to execute:

```
my-project-compiled/
├── _manifest.axc
├── _fields/
│   └── Greeter.fields
├── _skills/
│   ├── Greeter.greet.skill
│   └── Greeter.recall.skill
└── main.axc
```

---

## Example: Hello World

The smallest possible Axon program. One class, two skills, one entry point.

**`greeter.ax`**
```axon
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

**`main.axm`**
```axon
@main
skill main {
  - call Greeter.greet(name: "Yair")
  - call Greeter.recall
}
```

Compile it, hand the bundle to Claude, and Claude will greet "Yair" and then recall the greeting. No raw prompts. No copy-pasting. No duplication.

---

## Example: Inheritance and Interfaces

This is where Axon starts to pay off. Suppose you want a reusable "research" workflow that different specializations (company research, academic research, etc.) can implement differently.

**`researchable.ax`** — an interface
```axon
interface Researchable {
  skill research(topic)
}
```

**`research.ax`** — an abstract base class
```axon
abstract class Research {

  fields {
    @protected sources
    @protected report
    @private is_validated = false
  }

  @public
  skill research(topic) {
    - call this.gather_sources(topic)
    - call this.validate_sources
    - call this.write_report
  }

  @protected
  abstract skill gather_sources(topic)

  @protected
  abstract skill validate_sources

  @protected
  virtual skill write_report {
    - draft a structured report summarizing the validated sources in this.sources
    - store the draft in this.report
  }
}
```

**`research_company.ax`** — a concrete implementation
```axon
class ResearchCompany extends Research implements Researchable {

  fields {
    @private preferred_database = "SEC EDGAR"
  }

  @protected
  skill gather_sources(topic) {
    - search financial databases (starting with this.preferred_database) for filings related to topic
    - store all results in this.sources
  }

  @protected
  skill validate_sources {
    - check that every source in this.sources is from a primary or reputable financial outlet
    - set this.is_validated to true once all sources pass the check
  }

  @protected
  skill write_report {
    - call base.write_report
    - add a financial highlights section to this.report
  }
}
```

What happens here:

- `Research` defines the *workflow* (`research` calls gather → validate → write). It cannot be invoked directly because it is `abstract`.
- `ResearchCompany` fills in the three hooks. The `write_report` override calls `base.write_report` first, then adds its own step.
- The compiler verifies that `ResearchCompany` implements every `abstract` skill and satisfies the `Researchable` interface. If anything is missing, compilation fails with a precise error and a suggested fix.
- In the compiled bundle, `Research.write_report.skill` appears **once**. `ResearchCompany.write_report.skill` references it by path — no duplication.

---

## Example: Multi-Agent Orchestration

Axon's `parallel` and `pipe` blocks let you describe concurrent agent workflows without any framework code.

**`main.axm`**
```axon
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")

  parallel {
    - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
    - call EmailSender.send(recipient: "team@co.com", subject: "Apple research complete", body: ResearchCompany.report)
  }

  pipe(strategy: per_item) {
    - call QuestionGenerator.generate_questions(topic: "Apple Inc", amount: 5)
    - call EmailSender.send(recipient: "team@co.com", subject: "Follow-up question", body: ResearchCompany.report)
  }
}
```

- The `parallel` block runs the PDF export and the email send as **concurrent fire-and-forget agents** — they do not share state with each other.
- The `pipe(strategy: per_item)` block streams questions to the email sender as they are generated, rather than waiting for all five to be ready first.
- No `import` or `uses` declarations are needed anywhere. The compiler discovers all classes in the project automatically.

---

## How the Compiler Works

The Axon compiler is not classical code — it is an Axon skill that Claude follows. When you invoke the compiler skill, Claude executes these steps:

1. **Discover sources** — read all `.ax` files and at most one `.axm` file from the source directory
2. **Parse structure** — for each file, identify the class/abstract class/interface declaration, its fields, its skills with visibility and override mode, and its instruction bullets (treated as opaque text)
3. **Resolve references** — build the class graph, walk inheritance chains, and for every `call` instruction verify that the referenced class and skill exist and are accessible
4. **Validate rules** — enforce all structural rules: abstract skills implemented, interface contracts satisfied, visibility respected, sealed skills not overridden, no cyclical inheritance, no duplicate class names, at most one `@main`
5. **Report errors** — if any validation fails, report every error (never just the first) with file, line, and a suggested fix; do not emit a partial bundle
6. **Emit bundle** — if validation passes, write the compiled bundle directory following the format specified in the language spec

Every error includes the source file, line and column, a human-readable message, and a suggested fix.

### The 10 compiler errors

| # | Error | Example trigger |
|---|---|---|
| 1 | Unimplemented abstract skill | Child class missing a required `abstract` implementation |
| 2 | Interface contract violation | Class declares `implements X` but is missing a required skill |
| 3 | Invalid `base.*` reference | `base.foo` in a class with no parent, or parent has no `foo` |
| 4 | Visibility violation | Calling a `@private` skill from outside its class |
| 5 | Sealed skill override | Child attempts to override a `sealed` skill |
| 6 | Unknown reference | Call to a class or skill that does not exist in the project |
| 7 | Cyclical inheritance | `A extends B extends C extends A` |
| 8 | Override mode mismatch | Overriding a skill that is neither `virtual` nor `abstract` |
| 9 | Duplicate class name | Two `.ax` files both declare `class Greeter` |
| 10 | Multiple `@main` skills | More than one `.axm` file, or two `@main` in one file |

---

## The Output Bundle

The bundle is what Claude reads. It is a directory, not a single file, and it is **DRY by design** — no content appears in more than one place.

```
compiled/
├── _manifest.axc           ← read first; lists every class, interface, and the entry point
├── main.axc                ← present only when an .axm entry point was provided
├── _fields/
│   └── ClassName.fields    ← one file per class that declares fields
└── _skills/
    └── ClassName.skill_name.skill  ← one file per skill
```

Each `.skill` file contains a metadata block (class, visibility, override mode, parameters, paths to inherited fields, list of dependencies) followed by the natural-language body. Skills reference other skills and fields **by path** — never by embedding their content.

The `_manifest.axc` is the map. Claude reads it first to understand the class graph, then resolves any reference from there.

---

## How Claude Executes a Bundle

1. **Load the manifest** — `_manifest.axc` gives Claude the complete picture: every class, its parent, its interfaces, its skill list, and the entry point.
2. **Find the entry point** — if `main.axc` exists, begin there. Otherwise the bundle is a library and Claude awaits a call.
3. **Execute skills** — for each skill call, Claude reads the `.skill` file, loads the referenced fields, and follows the natural-language instructions.
4. **Resolve `this.*` and `base.*`** — using the inheritance chain recorded in the manifest.
5. **Honor visibility** — Claude refuses to execute a `@private` skill called from outside its class.
6. **Run `parallel` and `pipe` blocks** — `parallel` launches concurrent agents with no shared state; `pipe(strategy: per_item)` streams items; `pipe(strategy: on_complete)` waits for the producer to finish.
7. **Surface errors** — if a skill cannot be resolved or an instruction is ambiguous, Claude reports the issue in plain language.

Claude is both the compiler and the runtime. The division of labor is intentional: the compiler skill handles structure and validation; the runtime skill handles reasoning and execution. No classical programming language is required at any stage.

---

## Project Structure

```
docs/
└── axon/
    ├── spec.md                        ← canonical Axon language specification
    ├── examples/
    │   ├── small/                     ← Greeter hello-world
    │   ├── medium/                    ← Research + ResearchCompany + interface
    │   └── complex/                   ← multi-agent orchestration with threading
    └── examples-compiled/
        └── medium/                    ← full byte-faithful compiled bundle (DRY demo)

specs/001-axon-language/               ← specification authoring artifacts
    ├── spec.md                        ← feature requirements
    ├── plan.md                        ← implementation plan
    ├── research.md                    ← notational decisions
    ├── data-model.md                  ← conceptual entity model
    ├── quickstart.md                  ← authoring guide
    └── contracts/
        ├── grammar.ebnf               ← formal EBNF grammar
        ├── bundle-format.md           ← file schemas for the compiled bundle
        └── error-catalog.md          ← all 10 compiler errors with examples
```

The canonical language specification lives at [docs/axon/spec.md](docs/axon/spec.md). It is the contract a future compiler implementation is built from — precise enough that two independent engineers should produce byte-equivalent bundles for the same input.

---

## Roadmap

The current deliverable is the **language specification** and the **Axon compiler skill** — a Claude skill that reads Axon source files and emits a compiled bundle. Because the compiler is Claude itself, there is no separate implementation project needed.

Deferred to a future version:

- Skill overloading (same name, different parameter signatures)
- Positional arguments (v1 requires named arguments at every call site)
- Cross-class field writes (v1 allows reads only)
- Field-level default expressions (v1 allows literals only)
- Generic / parameterized classes
- Multi-file entry points
- A standard library of built-in classes
