# Skill Craft language — VS Code Extension

Syntax highlighting, snippets, and language support for the **Skill Craft** programming language (`.skillc`, `.skillcm`).

---

## What is Skill Craft?

Skill Craft is a high-level, intent-driven language where you describe *what* to do using natural language instructions inside structured **skills**. It compiles to executable Claude Code skills.

---

## File Types

| Extension | Purpose |
|-----------|---------|
| `.skillc`  | Class and skill definitions |
| `.skillcm` | Main entry point (orchestrates calls) |

---

## Language Overview

### Classes and Fields

```Skill Craft
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

### Abstract Classes and Inheritance

```Skill Craft
abstract class Research {

  fields {
    @protected sources
    @public    report
    @private   is_validated = false
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
    - draft a structured report from this.sources
    - store the result in this.report
  }
}
```

### Implementing and Extending

```Skill Craft
class ResearchCompany extends Research implements Researchable {

  fields {
    @private preferred_database = SEC EDGAR
  }

  @protected
  skill gather_sources(topic) {
    - search financial databases (starting with this.preferred_database) for filings related to topic
    - store all results in this.sources
  }

  @protected
  skill validate_sources {
    - check that every source in this.sources is from a reputable financial outlet
    - set this.is_validated to true once all sources pass
  }

  @protected
  skill write_report {
    - call base.write_report
    - add a financial highlights section to this.report
  }
}
```

### Main Entry Point (`.skillcm`)

```Skill Craft
@main
skill main {
  - call Greeter.greet(name: Yair)
  - call Greeter.recall
}
```

### Parallel Execution

Run multiple skills concurrently with `parallel {}`:

```Skill Craft
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")

  parallel {
    - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
    - call EmailSender.send(recipient: "team@co.com", subject: "Apple research complete", body: ResearchCompany.report)
  }
}
```

### Pipe (Streaming)

Process items as they are produced (`per_item`) or after all are ready (`on_complete`):

```Skill Craft
pipe(strategy: per_item) {
  - call QuestionGenerator.generate_questions(topic: "Apple Inc", amount: 5)
  - call EmailSender.send(recipient: "team@co.com", subject: "Follow-up question", body: ResearchCompany.report)
}
```

---

## Snippets

| Prefix | Description |
|--------|-------------|
| `class` | Class with fields and a skill |
| `aclass` | Abstract class skeleton |
| `iface` | Interface declaration |
| `skill` | Public skill |
| `vskill` | Virtual skill (overridable) |
| `askill` | Abstract skill signature |
| `parallel` | Parallel concurrent block |
| `pipe-item` | Pipe with `per_item` strategy |
| `pipe-batch` | Pipe with `on_complete` strategy |
| `main` | `@main` entry point |

---

## Access Modifiers

| Modifier | Scope |
|----------|-------|
| `@public` | Accessible from anywhere |
| `@protected` | Accessible within the class and subclasses |
| `@private` | Accessible only within the class |

---

## Skill Modifiers

| Modifier | Meaning |
|----------|---------|
| `abstract` | No body — subclass must implement |
| `virtual` | Has a default body — subclass may override |
| `@main` | Entry point skill (used in `.skillcm` files) |
