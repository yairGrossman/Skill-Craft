# Axon — Spec Kit Prompt

Paste the content below into Spec Kit's `/specify` command.

---

## /specify

Build the specification for a new programming language called **Axon**.

Axon is an object-oriented programming language designed to orchestrate LLM agents (specifically Claude). It applies classical OOP concepts — classes, inheritance, encapsulation, abstraction, interfaces, threading — to prompt engineering. The compiler is classical code. The runtime is an LLM that reads the compiled output and executes the resulting skills.

The evolution Axon represents:
- Raw prompts ≈ assembly language
- Skills / slash commands ≈ functions in C
- Axon ≈ full OOP language for LLMs

### Core philosophy

1. **LLM-driven semantics** — types are not declared; the LLM infers them from context. The runtime is intelligent enough to understand intent.
2. **Free speech logic** — Axon has no `if`, `else`, `for`, `while` keywords. Conditional logic, iteration, and rules are expressed in natural language inside instruction bullets. The LLM understands them.
3. **Single inheritance only** — eliminates the diamond problem cleanly. Multiple contracts are achieved through interfaces.
4. **Static classes only** — there are no instances. Classes are namespaces of behavior. State lives in fields, which are class-scoped shared memory between skills.
5. **DRY compilation** — the compiler never duplicates content. Inherited skills are referenced from the parent's compiled file, not copied. Fields are stored in dedicated files and referenced by skills.
6. **Optional entry point** — `main` is optional. A valid Axon project may be just a library of classes and skills, with no main.

---

### Language constructs

#### Classes
- Static. No instantiation. No constructors.
- Can be regular (`class`) or abstract (`abstract class`).
- Can inherit from at most one other class (`extends`).
- Can implement multiple interfaces (`implements`).

**Example — simple class:**
```
class QuestionGenerator {

  fields {
    @private generated_questions
  }

  @public
  skill generate_questions(topic, amount = 10) {
    - generate amount questions about the topic
    - store the questions in this.generated_questions
  }
}
```

#### Abstract classes
- May contain both implemented and abstract skills.
- May contain fields.
- Cannot be invoked from `main` directly.
- Concrete children must implement every abstract skill, or compilation fails.

**Example — abstract class:**
```
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
    - if this.is_validated is false, show an error and stop
    - structure this.sources into a well-formatted report
    - store the result in this.report
  }
}
```

#### Interfaces
- Contain only skill signatures (no bodies).
- Cannot have fields.
- A class can implement multiple interfaces.

**Example — interfaces:**
```
interface Researchable {
  @public skill research(topic)
}

interface Exportable {
  @public skill export_to_pdf(filename)
  @public skill export_to_md(filename)
}
```

A class implementing them:
```
class ResearchCompany extends Research implements Researchable, Exportable {
  ...
}
```

#### Skills (functions)
A skill is a named, reusable unit of LLM instruction. Skills support four override modes:

| Modifier | Has body? | Child must override? | Child may override? |
|---|---|---|---|
| `abstract` | No | Yes | Yes (required) |
| `virtual` | Yes | No | Yes |
| `sealed` | Yes | No | No |
| (default) | Yes | No | Yes |

Skills accept zero or more parameters with optional default values. Parameters are not typed.

**Example — each override mode:**
```
abstract class BaseAgent {

  // abstract — child MUST implement
  @protected
  abstract skill gather_data

  // virtual — child MAY override
  @protected
  virtual skill process_data {
    - clean the data in this.raw_data
    - store processed data in this.clean_data
  }

  // sealed — child CANNOT override
  @public
  sealed skill report_metrics {
    - count items in this.clean_data
    - return the count
  }

  // default — has body, child may override
  @public
  skill run {
    - call this.gather_data
    - call this.process_data
    - call this.report_metrics
  }
}
```

#### Fields
- Shared memory across all skills of a class.
- Not typed — LLM infers types from context.
- Support optional default values.
- Follow encapsulation visibility rules.
- Inherited by child classes.

**Example — fields block:**
```
fields {
  @public report
  @protected sources
  @private is_validated = false
  @private max_sources = 50
}
```

#### Encapsulation
Three visibility modifiers apply to both skills and fields:

- `@public` — accessible from anywhere
- `@protected` — accessible from this class and its descendants
- `@private` — accessible only from within this class

**Example — all three visibility levels:**
```
class ResearchCompany {

  fields {
    @public report
    @protected sources
    @private raw_data
  }

  @public
  skill research(topic) {
    - call this.fetch_raw_data(topic)
    - call this.validate_sources
    - call this.format_output
  }

  @protected
  skill validate_sources {
    - check each source in this.sources
    - remove invalid sources
  }

  @private
  skill fetch_raw_data(topic) {
    - search databases for the topic
    - store results in this.raw_data
  }

  @private
  skill format_output {
    - format this.sources into this.report
  }
}
```

From outside this class:
- `ResearchCompany.research(...)` → allowed (`@public`)
- `ResearchCompany.fetch_raw_data(...)` → compiler error, cannot call `@private` skill from outside

#### Inheritance
- Declared with `extends ParentClass`.
- A child class inherits all non-private skills and fields of the parent.
- A child references parent members using `base.member_name`.
- A class refers to its own members using `this.member_name`.

**Example — three override patterns:**

**1. Pure inheritance (no override)** — child doesn't declare the skill, inherits parent's version as-is.

**2. Full override** — child completely replaces parent's implementation:
```
class ResearchCompany extends Research {

  @protected
  skill write_report {
    - completely new implementation, ignoring base
    - format this.sources as a company report
    - store in this.report
  }
}
```

**3. Super-call (decorator pattern)** — child extends parent's behavior using `base.*`:
```
class ResearchCompany extends Research {

  @protected
  skill write_report {
    - call base.write_report
    - add a financial highlights section
    - add quarterly summary
  }
}
```

#### Composition
- Composition is implicit. No declaration is required.
- Any class can call any other class's public skills directly: `ClassName.skill_name(...)`.
- The compiler resolves these references at compile time.

**Example — composition:**
```
class ResearchCompany extends Research {

  @public
  skill research(topic) {
    - call this.gather_sources(topic)
    - call QuestionGenerator.generate_questions(topic: topic, amount: 10)
    - call FileExporter.export_to_pdf(content: this.report, filename: "report.pdf")
  }
}
```

No `uses` declaration needed — the compiler resolves `QuestionGenerator` and `FileExporter` from the project's `.ax` files automatically.

#### Threading
Two threading primitives:

**Parallel** — fire-and-forget concurrent execution, no shared resource between agents:
```
@main
skill main {
  parallel {
    - call ResearchCompany.research(topic: "Apple Inc")
    - call QuestionGenerator.generate_questions(topic: "Apple Inc", amount: 10)
    - call NewsScraper.fetch_latest(query: "Apple Inc")
  }
}
```

**Pipe** — producer-consumer pipeline with explicit synchronization strategy:

`per_item` — the consumer receives each item as the producer emits it:
```
@main
skill main {
  pipe(strategy: per_item) {
    - call FileReader.read_documents
    - call SummaryWriter.write_summary
  }
}
```

`on_complete` — the consumer waits until the producer is fully done:
```
@main
skill main {
  pipe(strategy: on_complete) {
    - call FileReader.read_documents
    - call SummaryWriter.write_summary
  }
}
```

#### Main
- Optional entry point declared as `@main skill main { }`.
- Lives in a `.axm` file (at most one per project).
- Acts as an **orchestrator** — calls other skills by reference, never contains their content directly.
- A project without `main` is a valid library.

**Example `.axm` file:**
```
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")

  parallel {
    - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
    - call EmailSender.send(recipient: "team@co.com", subject: "Done", body: ResearchCompany.report)
  }
}
```

---

### Syntax rules

| Element | Syntax |
|---|---|
| Block delimiter | `{ }` |
| Single instruction inside a skill | `- free speech instruction text` |
| Modifier / decorator | `@modifier` |
| Reference to a member of current class | `this.member_name` |
| Reference to a member of parent class | `base.member_name` |
| Call an external class's skill | `ClassName.skill_name(param: value, ...)` |

User-supplied content inside instructions uses free speech. Lists, conditions, and iterations are expressed naturally:

**Example — free speech logic:**
```
- if this.is_validated is false, show an error
- if the amount is greater than 100, split into batches of 50
- generate this.amount questions about the topic
- for each source in this.sources, validate its credibility
- research these companies: Apple Inc, Google, Meta
- keep retrying until the response is valid, up to 3 attempts
```

There are no `if`, `for`, or `while` keywords. The LLM interprets the natural-language instruction.

---

### File extensions

| Extension | Purpose |
|---|---|
| `.ax` | Class, abstract class, or interface definitions |
| `.axm` | Main entry point file (optional, at most one per project) |

**Example project layout:**
```
my_project/
  research.ax            # abstract class Research
  research_company.ax    # class ResearchCompany extends Research
  question_generator.ax  # class QuestionGenerator
  file_exporter.ax       # class FileExporter
  researchable.ax        # interface Researchable
  main.axm               # entry point
```

---

### Compiler

#### Inputs
- All `.ax` files in the project source directory.
- At most one optional `.axm` file.

#### Output — a compiled bundle directory
The compiler emits a folder, not a single file. The folder structure preserves the DRY principle: nothing is duplicated.

```
output/
  _fields/
    {ClassName}.fields           # one file per class with its own fields
  _skills/
    {ClassName}.{skill}.skill    # one file per skill, self-contained
  _manifest.axc                  # class graph, inheritance, interfaces
  main.axc                       # only present if .axm was provided
```

**DRY guarantees:**
- A skill file never embeds the content of another skill — it references them by path.
- A class's fields are stored once in `_fields/{ClassName}.fields` and referenced by every skill of that class that needs them.
- An inherited skill is referenced from the parent's `.skill` file, never copied into the child's namespace.

**Example — `_fields/Research.fields`:**
```
CLASS: Research
@protected sources
@protected report
@private is_validated = false
```

**Example — `_skills/ResearchCompany.research.skill`:**
```
CLASS: ResearchCompany
SKILL: research
VISIBILITY: @public
OVERRIDE_MODE: inherited (from Research)
PARAMS: topic
INHERITED FIELDS FROM: _fields/Research.fields
OWN FIELDS: _fields/ResearchCompany.fields
DEPENDS ON:
  - _skills/ResearchCompany.gather_sources.skill
  - _skills/ResearchCompany.validate_sources.skill
  - _skills/ResearchCompany.write_report.skill
BODY:
  - call ResearchCompany.gather_sources(topic)
  - call ResearchCompany.validate_sources
  - call ResearchCompany.write_report
```

The body references resolved skills by path — it never contains their content.

**Example — `_manifest.axc`:**
```
AXON BUNDLE v1
==============

CLASSES:

  Research [abstract]
    extends: none
    implements: none
    fields: _fields/Research.fields
    skills:
      - research            [@public, default]
      - write_report        [@protected, virtual]
      - gather_sources      [@protected, abstract]
      - validate_sources    [@protected, abstract]

  ResearchCompany [concrete]
    extends: Research
    implements: Researchable, Exportable
    own fields: _fields/ResearchCompany.fields
    inherited fields: _fields/Research.fields
    skills:
      - research            [@public, inherited from Research]
      - write_report        [@protected, overrides Research.write_report]
      - gather_sources      [@protected, implements abstract from Research]
      - validate_sources    [@protected, implements abstract from Research]
      - export_to_pdf       [@public, implements Exportable]
      - export_to_md        [@public, implements Exportable]

  QuestionGenerator [concrete]
    extends: none
    implements: none
    fields: _fields/QuestionGenerator.fields
    skills:
      - generate_questions  [@public, default]

INTERFACES:

  Researchable
    required skills:
      - research            [@public]

  Exportable
    required skills:
      - export_to_pdf       [@public]
      - export_to_md        [@public]

ENTRY POINT:
  main.axc
```

#### Compiler errors (must block compilation)

| Error | Description |
|---|---|
| Unimplemented abstract skill | A concrete class does not implement an abstract skill inherited from its parent |
| Interface contract violation | A class claims to implement an interface but is missing one or more required skills |
| Invalid `base.*` reference | `base.member` used in a class that has no parent |
| Visibility violation | A `@private` member is called from outside its class, or a `@protected` member from outside the inheritance chain |
| Sealed skill override | A child class attempts to override a `sealed` skill |
| Unknown reference | A skill, field, or class referenced in code does not exist in the project |
| Cyclical inheritance | The inheritance chain contains a cycle |
| Override mode mismatch | A child tries to override a skill that is neither `virtual` nor `abstract` |
| Duplicate class name | The same class name is defined in two different `.ax` files |
| Multiple `@main` skills | More than one `.axm` file in the project, or multiple `@main` skills in a single file |

Each error must report:
1. The source file
2. The line and column
3. A clear human-readable message
4. A suggested fix when feasible

**Example error output:**
```
ERROR in research_company.ax, line 14, column 3:
  Class 'ResearchCompany' inherits from abstract class 'Research'
  but does not implement abstract skill 'validate_sources'.

  Suggested fix — add an implementation:

    @protected
    skill validate_sources {
      - your implementation here
    }
```

```
ERROR in main.axm, line 5, column 8:
  Cannot call '@private' skill 'fetch_raw_data' from outside class 'ResearchCompany'.

  Skill 'fetch_raw_data' is declared @private and is only callable from within ResearchCompany.

  Suggested fix — either change visibility to @public or @protected, or call a public skill that uses it internally (e.g. ResearchCompany.research).
```

#### Runtime
The output bundle is read by Claude. Claude first reads `_manifest.axc` to understand the class graph, then resolves and executes skills as instructed. If `main.axc` is present, execution begins there. If not, the bundle is a library Claude can be asked to use.

---

### Toolchain

```
.ax sources + optional .axm
        ↓
   Axon compiler        ←  errors block compilation
        ↓
   compiled bundle (folder)
        ↓
   Claude reads manifest and executes
```

---

### Complete example programs

#### Small example — one class, no inheritance

`greeter.ax`:
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

`main.axm`:
```
@main
skill main {
  - call Greeter.greet(name: "Yair")
  - call Greeter.recall
}
```

---

#### Medium example — abstract base, concrete child, interface

`researchable.ax`:
```
interface Researchable {
  @public skill research(topic)
}
```

`research.ax`:
```
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
    - if this.is_validated is false, raise an error and stop
    - structure this.sources into a clean, well-formatted report
    - store the result in this.report
  }
}
```

`research_company.ax`:
```
class ResearchCompany extends Research implements Researchable {

  fields {
    @private company_ticker
    @private fiscal_year = 2025
  }

  @protected
  skill gather_sources(topic) {
    - search financial databases for the topic
    - search SEC filings for this.company_ticker
    - store all results in this.sources
  }

  @protected
  skill validate_sources {
    - remove sources older than 2 years from this.sources
    - flag any contradictions you find
    - set this.is_validated to true
  }

  @protected
  skill write_report {
    - call base.write_report
    - add a financial highlights section to this.report
    - add a fiscal year summary for this.fiscal_year
  }
}
```

`main.axm`:
```
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")
}
```

---

#### Complex example — multiple classes, threading, composition, main

`research.ax` and `research_company.ax` — as in the medium example.

`question_generator.ax`:
```
class QuestionGenerator {

  fields {
    @private generated_questions
  }

  @public
  skill generate_questions(topic, amount = 10, style = "recall") {
    - generate amount questions about topic in the given style
    - store the questions in this.generated_questions
    - return this.generated_questions
  }
}
```

`file_exporter.ax`:
```
class FileExporter {

  @public
  skill export_to_pdf(content, filename) {
    - format content as a pdf document
    - save it with the given filename
  }

  @public
  skill export_to_md(content, filename) {
    - format content as a markdown document
    - save it with the given filename
  }
}
```

`email_sender.ax`:
```
class EmailSender {

  @public
  skill send(recipient, subject, body) {
    - compose an email to recipient
    - send it with the given subject and body
  }
}
```

`main.axm`:
```
@main
skill main {

  - call ResearchCompany.research(topic: "Apple Inc")

  parallel {
    - call FileExporter.export_to_pdf(
        content: ResearchCompany.report,
        filename: "apple_report.pdf"
      )
    - call FileExporter.export_to_md(
        content: ResearchCompany.report,
        filename: "apple_report.md"
      )
    - call QuestionGenerator.generate_questions(
        topic: "Apple Inc",
        amount: 20,
        style: "critical thinking"
      )
  }

  - call EmailSender.send(
      recipient: "team@company.com",
      subject: "Apple Inc research complete",
      body: ResearchCompany.report
    )
}
```

This program demonstrates:
- Abstract inheritance (`ResearchCompany extends Research`)
- Interface implementation (`implements Researchable`)
- Composition (calls to `QuestionGenerator`, `FileExporter`, `EmailSender` without any `uses` declaration)
- Threading (`parallel` block running three skills concurrently)
- Free speech logic in skill bodies
- A main orchestrator that only references skills, never contains their content

---

### What this spec must produce

Produce a complete `spec.md` for Axon containing:

1. **Language overview** — vision, philosophy, comparison to traditional OOP.
2. **Formal grammar** — EBNF or equivalent specification of the syntax.
3. **Syntax reference** — every construct with at least one complete example (use the examples in this prompt as a baseline).
4. **Semantic rules** — inheritance resolution order, visibility enforcement, threading semantics, skill resolution, parameter binding.
5. **Compiler architecture** — parser, resolver, emitter; describe each phase's responsibilities and outputs.
6. **Compiler error catalog** — every error with example, message, and suggested fix.
7. **Output bundle format** — exact file structure, naming conventions, content schema for `.fields`, `.skill`, `_manifest.axc`, and `main.axc` files.
8. **Runtime contract** — what Claude is expected to do when reading the bundle.
9. **Example programs** — include all three example programs from this prompt (small, medium, complex), plus the corresponding compiled bundle output for the medium example to make the DRY guarantees concrete.
10. **Open questions / future extensions** — note `overloading` as a deferred v2 feature; flag anything else that may need future refinement.

The spec should be precise enough that a competent engineer can build the Axon compiler from it without further clarification.
