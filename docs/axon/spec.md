# The Axon Language Specification

**Version**: v1 (draft)
**Status**: Canonical reference
**Last revised**: 2026-05-21

Axon is an object-oriented programming language for orchestrating LLM agents. The Axon compiler is an Axon skill executed by Claude. There is no classical code to write. Claude reads the compiler skill, which instructs it precisely how to parse Axon source files, validate them, and emit a bundle. This document is the contract that the compiler skill and the runtime skill follow.

The sections below follow the order required by FR-032 through FR-041 of the feature specification.

---

## §1. Language overview

### 1.1 Vision

Axon is an object-oriented programming language designed for one purpose: orchestrating LLM agents — concretely, Claude. It treats a prompt the way classical programming languages treat a function: as something with a name, parameters, a visibility, a place in a class hierarchy, and a documented contract with its callers. The "executable" produced by the Axon compiler is not machine code or bytecode; it is a directory of human-readable text files (a *bundle*) that a language model reads at runtime and acts on.

The motivating idea is that the discipline OOP imposes on classical code — encapsulation, abstraction, polymorphism, inheritance, contracts — is also valuable for prompt engineering. A modern LLM-driven application accumulates ad-hoc prompts the way an early-1990s application accumulated copy-pasted snippets: scattered across files, undocumented, hard to compose, impossible to test in isolation. Axon's claim is that the cure for that disorder is the same cure that worked for classical code: name things, give them types of responsibility, make them composable, and let a compiler enforce the basic structural invariants.

### 1.2 Philosophy

Three design principles shape every decision in the rest of this document.

1. **State lives in classes, not in instances.** Axon has no `new`, no constructors, no `this` in the Java/C# sense of "the instance currently executing the method." Every class is essentially a static namespace of behavior and shared memory. A class's `fields { }` block is the only mutable state it owns; every skill of that class sees the same fields. This matches how LLM agents actually behave — they are stateless callable functions whose only memory is whatever data has been threaded into their inputs — and removes a whole category of accidental complexity (object lifetimes, identity, equality, dependency injection) from the language.

2. **Both the compiler and the runtime are Claude.** There is no classical compiler. The Axon compiler is an Axon skill that instructs Claude how to read `.ax` and `.axm` source files, validate structural rules (inheritance contracts, visibility, interface contracts, override modes), and emit the compiled bundle. The Axon runtime is a separate Axon skill that instructs Claude how to read a compiled bundle and execute its skills. Each instruction bullet inside a skill body remains opaque to both stages — the compiler validates structure and references, the runtime supplies meaning and executes behavior.

3. **Logic is free speech.** Axon defines no `if`, no `else`, no `for`, no `while`, no `switch`, no `try/catch`, no arithmetic operators, no comparison operators. Conditionals, iteration, and exception handling are expressed as natural-language instruction bullets and interpreted by the LLM. The skill body `- if the topic mentions a public company, gather recent SEC filings; otherwise, fall back to news search` is not parsed for control flow. It is preserved verbatim and handed to Claude, which is fully capable of branching on natural-language criteria. This is Axon's most disorienting departure from classical languages, and it is deliberate. Trying to formalize natural language into a fixed vocabulary of control words would defeat the language's reason for existing.

### 1.3 Comparison to traditional OOP

Axon shares the surface vocabulary of mainstream OOP — `class`, `abstract class`, `interface`, `extends`, `implements`, `@public`, `@protected`, `@private`, `virtual`, `sealed` — but the underlying execution model is different in concrete ways:

| Concept | Traditional OOP (Java/C#/C++) | Axon |
|---|---|---|
| Instantiation | `new T(args)`; objects have identity, lifetime, identity-based equality | None. A class is a static namespace. No `new`, no constructors, no destructors, no identity. |
| State | Per-instance fields, possibly per-class static fields | Per-class shared fields only. Every skill of a class sees the same field block. |
| Method dispatch | Virtual table; dispatched on runtime type of the receiver | Static dispatch by class name + skill name; the LLM is the only runtime, and the manifest names the exact skill file. |
| Logic | Statements + expressions + control flow keywords compiled to a deterministic machine | Free-speech instruction bullets interpreted by an LLM at runtime. |
| Types | Static or gradual; checked by compiler | Untyped. The LLM infers parameter types from context. |
| Exceptions | `throw` / `catch` / call-stack unwinding | None in v1. Runtime errors are surfaced by the LLM in natural language to the user. |
| Composition | Import / using / module systems | Implicit, project-wide. Every `ClassName.skill_name(...)` reference resolves against the set of `.ax` files in the project; no `import` declaration is needed or allowed. |
| Concurrency | Threads, async/await, futures, channels | Two language-level forms: `parallel { }` (fire-and-forget concurrent agents, no shared intermediate state) and `pipe(strategy: per_item | on_complete) { }` (producer/consumer). Both block forms are interpreted by the LLM runtime. |
| Output | Machine code, bytecode, or transpiled source | A directory of human-readable text files. The runtime is an LLM, which means the executable must be legible to a model, not to a CPU. |

These constraints satisfy FR-032. The remaining sections of this document formalize them.

---

## §2. Formal grammar

The formal grammar below is the structural reference that the Axon compiler skill follows when reading source files. Claude uses this grammar to understand what constitutes a valid Axon program. It is expressed in EBNF for precision and human readability, not as input to a classical parser generator.

### 2.1 EBNF metasyntax (the conventions used below)

This grammar uses ISO/IEC 14977 EBNF. The conventions are:

- A production rule has the form `LHS = RHS ;`. The `=` separates the rule's left-hand non-terminal from its right-hand definition. The `;` terminates the rule.
- Terminal strings are written in double quotes (`"class"`, `"@public"`). A terminal matches that exact sequence of characters in the source.
- Non-terminals are written without quotes (`ClassDecl`, `Identifier`). A non-terminal expands to whatever its own rule produces.
- `,` is the concatenation operator, but it is conventionally omitted in this grammar — adjacency means concatenation. (Both `A , B ;` and `A B ;` mean "an A followed by a B".)
- `|` is alternation. `A | B` means "an A or a B."
- `[ X ]` means optional: zero or one occurrence of X.
- `{ X }` means repetition: zero or more occurrences of X.
- `( X )` is grouping for precedence.
- A bracketed comment in the form `(* ... *)` is a grammar-author note, ignored by parsers.
- A guarded prose phrase in the form `? ... ?` indicates a primitive predicate the lexer must implement (e.g., `? any character except " or \ ?`). It is not further decomposed in the grammar.

Whitespace (spaces and tabs) between tokens is permitted and ignored except where explicitly forbidden — notably inside an `Instruction`, where the text between the `-` bullet and the end-of-line is consumed as an opaque line. Newlines are significant only for `Instruction` termination. Line comments and block comments are not supported in Axon v1; the compiler MUST NOT recognize any comment syntax.

The grammar contains roughly 35 production rules organized into seven groups: top-level files, declarations, fields, skills, instructions, threading blocks, and lexical primitives.

### 2.2 Production rules

```ebnf
(* -------------------------------------------------------------------------- *)
(* Top-level files                                                            *)
(* -------------------------------------------------------------------------- *)

AxFile          = ClassDecl | AbstractClassDecl | InterfaceDecl ;

AxmFile         = MainDecl ;

(* -------------------------------------------------------------------------- *)
(* Declarations                                                               *)
(* -------------------------------------------------------------------------- *)

ClassDecl       = "class" Identifier [ Extends ] [ Implements ]
                  "{" ClassBody "}" ;

AbstractClassDecl
                = "abstract" "class" Identifier [ Extends ] [ Implements ]
                  "{" ClassBody "}" ;

InterfaceDecl   = "interface" Identifier "{" { SkillSignature } "}" ;

Extends         = "extends" Identifier ;

Implements      = "implements" Identifier { "," Identifier } ;

ClassBody       = [ FieldsBlock ] { Skill } ;

MainDecl        = "@main" "skill" "main" "{" SkillBody "}" ;

(* -------------------------------------------------------------------------- *)
(* Fields                                                                     *)
(* -------------------------------------------------------------------------- *)

FieldsBlock     = "fields" "{" { FieldDecl } "}" ;

FieldDecl       = Visibility Identifier [ "=" Literal ] ;

(* -------------------------------------------------------------------------- *)
(* Skills                                                                     *)
(* -------------------------------------------------------------------------- *)

Skill           = Visibility OverrideMode "skill" Identifier
                  [ "(" ParamList ")" ]
                  ( "{" SkillBody "}" | (* abstract skills have no body *) ) ;

SkillSignature  = Visibility "skill" Identifier [ "(" ParamList ")" ] ;

OverrideMode    = "abstract" | "virtual" | "sealed" | (* empty = default *) ;

ParamList       = Param { "," Param } ;

Param           = Identifier [ "=" Literal ] ;

SkillBody       = { Instruction | ThreadingBlock } ;

(* -------------------------------------------------------------------------- *)
(* Instructions                                                               *)
(* -------------------------------------------------------------------------- *)

(*
  An Instruction is opaque to the compiler: the lexer consumes "-", one space,
  then everything up to the next newline as a single OpaqueLine token. The
  compiler preserves this text verbatim in the emitted .skill file.

  STRUCTURAL CALLS — for resolution purposes, the resolver scans Instructions
  whose text begins with the literal token "call " and parses the remainder
  as a CallExpression for reference checking. All other Instructions are
  treated as pure free-speech and not analyzed.
*)

Instruction     = "-" " " OpaqueLine Newline ;

OpaqueLine      = ? any sequence of characters except a newline ? ;

(* The structural form recognized inside OpaqueLine for reference resolution: *)

CallExpression  = "call" ( ThisCall | BaseCall | CrossCall ) ;

ThisCall        = "this" "." Identifier [ "(" ArgList ")" ] ;

BaseCall        = "base" "." Identifier [ "(" ArgList ")" ] ;

CrossCall       = Identifier "." Identifier [ "(" ArgList ")" ] ;

ArgList         = NamedArgList | PositionalArgList ;
NamedArgList    = NamedArg { "," NamedArg } ;
PositionalArgList = ArgumentValue { "," ArgumentValue } ;
NamedArg        = Identifier ":" ArgumentValue ;
ArgumentValue   = Value | DottedReference ;
Value           = QuotedString | UnquotedValue ;
QuotedString    = '"' { any character except unescaped '"' } '"' ;
UnquotedValue   = ? any sequence of characters up to the next "," or ")" ? ;

DottedReference = Identifier "." Identifier ;
                  (* used for cross-class @public field reads, e.g., ResearchCompany.report *)

(* -------------------------------------------------------------------------- *)
(* Threading blocks                                                           *)
(* -------------------------------------------------------------------------- *)

ThreadingBlock  = ParallelBlock | PipeBlock ;

ParallelBlock   = "parallel" "{" { Instruction } "}" ;

PipeBlock       = "pipe" "(" "strategy" ":" PipeStrategy ")"
                  "{" { Instruction } "}" ;

PipeStrategy    = "per_item" | "on_complete" ;

(* -------------------------------------------------------------------------- *)
(* Modifiers and literals                                                     *)
(* -------------------------------------------------------------------------- *)

Visibility      = "@public" | "@protected" | "@private" ;

Literal         = StringLit | IntegerLit | BooleanLit ;

StringLit       = '"' { StringChar } '"' ;

StringChar      = ? any character except " or \ ?
                | "\\" ( '"' | "\\" ) ;

IntegerLit      = [ "-" ] Digit { Digit } ;

BooleanLit      = "true" | "false" ;

Identifier      = Letter { Letter | Digit | "_" } ;

Letter          = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
                | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T"
                | "U" | "V" | "W" | "X" | "Y" | "Z"
                | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j"
                | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t"
                | "u" | "v" | "w" | "x" | "y" | "z" ;

Digit           = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;

Newline         = ? U+000A or U+000D U+000A ? ;
```

### 2.3 Notes on the grammar

- An `.ax` file contains exactly one `AxFile` payload — one of `ClassDecl`, `AbstractClassDecl`, or `InterfaceDecl`. Multiple top-level declarations in one file are a parse error (see §4, SR-22).
- An `.axm` file contains exactly one `AxmFile` payload — that is, exactly one `MainDecl`. Multiple `@main` skills in one file produce error E10 (§6).
- `OpaqueLine` is intentionally unbounded — the compiler skill reads it as a single line and does not re-tokenize its contents. The compiler skill scans the leading characters of each `OpaqueLine` to detect the `call ` prefix and parses the remainder as a `CallExpression` for cross-reference checking. This is the boundary between the compiler skill's structural responsibilities and the runtime skill's free-speech responsibilities (research R6, R7).
- `DottedReference` is used only in argument-value position, not in instruction-text position. Inside `OpaqueLine` text, dotted identifiers are part of the opaque string and the compiler does not resolve them.
- `UnquotedValue` is an LLM-interpreted rule — the compiler skill reads up to the next delimiter (`,` or `)`). This is why the LLM compiler is better suited than a classical parser: it handles the ambiguity of natural-language values by understanding intent rather than requiring strict tokenization.
- Override-mode modifiers `abstract`, `virtual`, `sealed` are mutually exclusive in a single `Skill` production. The grammar admits at most one because `OverrideMode` is a single non-terminal that expands to a single keyword.
- A `Skill` with an empty `OverrideMode` and no `{ SkillBody }` brace block is a parse error. Only `abstract` skills are permitted to omit the body. This constraint is structural (see §4, SR-23) and is enforced by the validator.

This grammar satisfies FR-033 and is the production grammar against which the three example programs in §9 must parse without error (SC-006).

---

## §3. Syntax reference

This section presents every Axon language construct with at least one complete worked example, per FR-034. The constructs are grouped functionally: declarations first, then members, then calls, then threading. Each construct's grammar reference points back to the production in §2 that defines it.

### 3.1 Class declaration

A concrete class is declared with the `class` keyword followed by an identifier and a brace-delimited body. The body may contain at most one `fields { }` block and any number of skill declarations.

**Grammar reference**: `ClassDecl` (§2.2).

```axon
class Greeter {
  // body
}
```

A class with no body is legal:

```axon
class Empty {}
```

### 3.2 Fields block and field declarations

Every class may declare at most one `fields { }` block, which contains zero or more field declarations. Each field declaration has a visibility modifier, an identifier, and an optional literal default value. Fields are untyped: their type is inferred at runtime by the LLM from how the field is used (FR-008, FR-011).

**Grammar reference**: `FieldsBlock`, `FieldDecl` (§2.2).

```axon
class Greeter {

  fields {
    @private last_greeting
  }
}
```

A class can declare multiple fields with mixed visibility and defaults:

```axon
class Counter {

  fields {
    @public total = 0
    @protected step = 1
    @private debug_mode = false
  }
}
```

The defaults in the example above are integer (`0`), integer (`1`), and boolean (`false`). String defaults use double-quoted literals: `@private greeting = "hello"`.

### 3.3 Skill declaration

A skill is the named, parameterized unit of LLM instruction. Every skill declaration begins with a visibility modifier, optionally an override-mode modifier (omitted in the small example — see §3.7), the `skill` keyword, an identifier, an optional parameter list in parentheses, and a brace-delimited body containing zero or more instruction bullets.

**Grammar reference**: `Skill`, `ParamList`, `Param`, `SkillBody`, `Instruction` (§2.2).

**Skill with parameters and instructions**:

```axon
@public
skill greet(name) {
  - greet name warmly
  - store the greeting in this.last_greeting
}
```

**Skill with no parameters and one instruction**:

```axon
@public
skill recall {
  - return this.last_greeting
}
```

**Skill with no instructions** (legal — a no-op):

```axon
@public
skill noop {}
```

**Parameter with a literal default**:

```axon
@public
skill generate_questions(topic, amount = 10) {
  - generate `amount` thoughtful questions about `topic`
}
```

The parameter `amount` defaults to the integer literal `10`. At the call site, `amount` may be omitted.

### 3.4 Literal values (defaults and arguments)

Axon does not enforce types on field defaults or argument values. Parameters and fields are untyped — the LLM infers meaning from context. A value like `Apple Inc`, `10`, `false`, or `critical thinking style` is valid in any position. The LLM compiler understands intent without requiring the developer to annotate types.

For structured `call` expressions where the compiler needs to parse argument boundaries, the comma between arguments and the closing parenthesis serve as delimiters. Multi-word values in named arguments are delimited by the comma of the next argument or the closing parenthesis — quotes are not required:

```axon
- call generate_questions(topic: Apple Inc, amount: 10, style: critical thinking)
```

Quoted strings are also accepted for developers who prefer them:

```axon
- call generate_questions(topic: "Apple Inc", amount: 10, style: "critical thinking")
```

Both forms are valid and equivalent. The LLM compiler understands both.

### 3.5 Visibility modifiers

Three visibility modifiers govern member access (FR-013, FR-014). They apply uniformly to fields and skills.

**Grammar reference**: `Visibility` (§2.2).

| Modifier | Means | Visible from |
|---|---|---|
| `@public` | Universally accessible | Anywhere in the project |
| `@protected` | Accessible within the inheritance chain | The owning class and any descendant |
| `@private` | Strictly local | Only inside the owning class |

A skill declares its visibility on the line above the `skill` keyword:

```axon
@public
skill greet(name) { ... }

@protected
skill helper { ... }

@private
skill internal { ... }
```

A field declares its visibility inline:

```axon
fields {
  @public total = 0
  @protected step = 1
  @private last_greeting
}
```

### 3.6 `this.*` member reference

Inside a skill body, `this.member` refers to a field or skill of the owning class (after inheritance lookup). The form `this.field_name` reads the field; the form `this.skill_name(...)` calls the skill.

**Grammar reference**: `ThisCall` (§2.2). Inside an opaque instruction line, `this.member` appears as part of the bullet text; the resolver recognizes the `call this.X` form for cross-reference checking (§5.3).

```axon
@public
skill greet(name) {
  - greet name warmly
  - store the greeting in this.last_greeting   // reads/writes a field
}

@public
skill compose {
  - call this.greet(name: "Yair")              // calls another skill of this class
  - call this.recall
}
```

A skill MAY refer to a `this.member` only if that member exists in the owning class (after inheritance lookup) and is visible from inside the class. A `this.private_field_of_some_other_class` is not legal — `this` always means "this class," not "this instance" (Axon has no instances).

### 3.7 Call instructions and cross-class calls

A call instruction is an instruction bullet whose text begins with the literal `call ` (lowercase, one trailing space). The resolver parses the remainder as a `CallExpression` for cross-reference checking. Three call forms exist:

- `this.skill_name(...)` — same-class call (§3.6).
- `base.skill_name(...)` — parent-class call (introduced in §3.x of the inheritance section, see US2).
- `ClassName.skill_name(...)` — cross-class call.

A cross-class call invokes a `@public` skill of another class in the project. No `import` / `uses` declaration is required; the compiler resolves `ClassName` against the project-wide set of `.ax` files (FR-010).

**Grammar reference**: `CallExpression`, `CrossCall` (§2.2).

```axon
@main
skill main {
  - call Greeter.greet(name: "Yair")
  - call Greeter.recall
}
```

Arguments at call sites may be **named** or **positional** — the developer chooses whichever is more natural. Named and positional forms may not be mixed in the same call.

**Named arguments** — provide the parameter name followed by a colon and the value. May be provided in any order. Defaulted parameters may be omitted:
```axon
- call generate_questions(topic: Apple Inc, style: critical thinking)
- call Greeter.greet(name: Yair)
```

**Positional arguments** — provide values in parameter declaration order. Defaulted parameters at the end may be omitted:
```axon
- call generate_questions(Apple Inc)
- call Greeter.greet(Yair)
```

**Multi-word values** do not require quotes. The comma between arguments and the closing parenthesis act as natural delimiters. Quoted strings are accepted for developers who prefer them but are never required.

**Zero-argument calls** omit parentheses:
```axon
- call Greeter.recall
- call this.validate_sources
```

### 3.8 `@main` skill in `.axm` files

The entry point of an Axon project is an optional `@main skill main { }` block, declared in a single `.axm` file. The body of `main` is a list of instruction bullets that orchestrate calls to other skills.

**Grammar reference**: `MainDecl`, `AxmFile` (§2.2).

```axon
@main
skill main {
  - call Greeter.greet(name: "Yair")
  - call Greeter.recall
}
```

The `@main` decorator is **only** legal at the top of an `.axm` file — using it inside an `.ax` file is error E10 / "Misplaced @main." A project MAY have zero `.axm` files (in which case the compiled bundle is a library — see FR-021); it MUST have at most one (FR-019).

### 3.9 `DottedReference` in argument-value position

When passing a value to a skill at a call site, the value may be either a literal (§3.4) or a **dotted reference** of the form `ClassName.field_name`. A dotted reference reads a `@public` field of another class. This form is used to thread output from one skill's class into another skill's input (research R8).

**Grammar reference**: `ArgumentValue`, `DottedReference` (§2.2).

A dotted reference's behavior is decided by the resolver:
- If the target identifier resolves to a `@public` field of the named class, the call site receives that field's value at runtime.
- If the target identifier does not resolve, the resolver records an "Unknown reference" error (E6).

Example (from the complex example in §9):

```axon
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")
  - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
}
```

The second call passes `ResearchCompany.report` as the value of `content`. Because `report` is a `@public` field of `ResearchCompany`, the resolver classifies this as a public field read; at runtime, Claude reads the value from `ResearchCompany`'s state and supplies it as the `content` argument.

### 3.10 Abstract class declaration

An abstract class is declared with `abstract class` followed by an identifier and the usual brace-delimited body. An abstract class MAY contain both implemented and abstract skills. It MAY declare a `fields { }` block. It MAY NOT be invoked directly from a `@main` skill (the call must go through a concrete descendant).

**Grammar reference**: `AbstractClassDecl` (§2.2).

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

This abstract class declares three fields, one fully implemented `@public default` skill (`research`), two `abstract` skills (`gather_sources`, `validate_sources`) whose bodies must be supplied by every concrete descendant, and one `virtual` skill (`write_report`) that concrete descendants MAY override.

### 3.11 Interface declaration

An interface is declared with `interface` followed by an identifier and a brace-delimited list of skill signatures. An interface contains only signatures — no bodies. It MAY NOT declare a `fields { }` block. Multiple interfaces are permitted in a single project, and a single class MAY implement zero or more of them.

**Grammar reference**: `InterfaceDecl`, `SkillSignature` (§2.2).

```axon
interface Researchable {
  @public skill research(topic)
}
```

Every signature in an interface MUST be `@public` — interfaces are contracts to outsiders, so non-public signatures make no sense (SR-12, §4). The signature lists the skill name and its parameter list (with names only; defaults are not declared in interfaces).

### 3.12 `extends` clause

A class MAY extend at most one other class (single inheritance per FR-004). The `extends` clause appears between the class name and the body's opening brace.

**Grammar reference**: `Extends` (§2.2).

```axon
class ResearchCompany extends Research {
  // inherits Research's fields and non-private skills
}
```

A class with no `extends` clause has no parent. The `base.*` form (§3.14) is illegal in such a class (SR-13, §4).

### 3.13 `implements` clause

A class MAY implement zero or more interfaces. Interface names are comma-separated. The `implements` clause appears after any `extends` clause and before the body's opening brace.

**Grammar reference**: `Implements` (§2.2).

```axon
class ResearchCompany extends Research implements Researchable {
  // must provide a @public skill matching every Researchable signature
}
```

```axon
class Aggregator implements Researchable, Exportable {
  // must satisfy both interfaces
}
```

For every interface in `implements`, the class MUST declare a `@public` skill matching every signature listed in that interface (per SR-12 in §4); otherwise error E2 fires.

### 3.14 `base.*` super-call

Inside a skill body, `base.member` references a member of the parent class. The form `base.skill_name(...)` calls the parent's skill (or the closest ancestor's skill if the parent inherited it transitively). The form `base.field_name` reads the parent's field. `base.*` is illegal in a class with no `extends` clause (SR-13, §4).

**Grammar reference**: `BaseCall` (§2.2). Inside an opaque instruction line, the resolver recognizes the `call base.X` form for cross-reference checking (§5.3).

```axon
class ResearchCompany extends Research implements Researchable {
  @protected
  skill write_report {
    - call base.write_report                  // invokes Research.write_report
    - add a financial highlights section to this.report
  }
}
```

The first bullet calls the parent's `write_report`, which writes a base report. The second bullet then augments it. This is the classical decorator pattern.

### 3.15 Override-mode modifiers — `abstract`, `virtual`, `sealed`, default

A skill's **override mode** controls how descendants may treat it:

- **default** (no modifier): The skill has a body; child classes MAY override.
- **`virtual`**: The skill has a body; child classes MAY override. Distinguishes "this skill was designed to be overridden" from "the body happens to be present."
- **`abstract`**: The skill has NO body. Lives only in `abstract class`. Concrete descendants MUST override.
- **`sealed`**: The skill has a body; child classes MAY NOT override.

**Grammar reference**: `OverrideMode` (§2.2).

```axon
abstract class A {

  @public
  skill foo {                         // default — overridable
    - default behavior
  }

  @public
  virtual skill bar {                 // explicitly virtual — overridable
    - virtual behavior
  }

  @public
  abstract skill baz                  // no body — concrete descendants must implement

  @public
  sealed skill qux {                  // sealed — descendants may not override
    - fixed behavior
  }
}
```

**A subtle constraint on override declarations**: when a child class overrides an inherited skill, the child's declaration MUST NOT specify an override-mode modifier — it cannot re-mark the skill `abstract` or `virtual` (SR-10 in §4). The override mode is determined by the *declaring (ancestor)* class. A child override is simply a non-modifier declaration with the same name:

```axon
class B extends A {
  @public
  skill bar {                         // OVERRIDES A.bar — no modifier on the child
    - new behavior
  }
}
```

Trying to write `virtual skill bar` or `abstract skill bar` in `B` triggers error E8 (Override mode mismatch).

### 3.16 Visibility on override

A child override's visibility MUST be the same as or wider than the parent's. Specifically:

- Overriding a `@public` parent skill MUST be `@public`.
- Overriding a `@protected` parent skill MAY be `@protected` or `@public`.
- Overriding a `@private` parent skill is not meaningful — `@private` skills are not inherited at all (SR-2 lookup walks only non-private ancestors).

This is enforced by SR-14 in §4.

### 3.17 `parallel { }` block

A `parallel { }` block runs each contained call as an **independent fire-and-forget agent** with no shared intermediate state between branches. The block lives inside a skill body (typically `@main`, but legal in any skill — SR-21 in §4). Each entry inside the block is a call instruction.

**Grammar reference**: `ParallelBlock` (§2.2).

```axon
parallel {
  - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
  - call EmailSender.send(recipient: "team@co.com", subject: "Apple research complete", body: ResearchCompany.report)
}
```

The two calls launch concurrently. Each branch has its own copy of any input arguments; neither branch observes the other's intermediate state. The block returns control to the parent skill once both branches have completed.

The block contains only call instructions — nested threading blocks (a `parallel` inside a `parallel`, or a `pipe` inside a `parallel`) are not permitted in v1 (see §10.9).

### 3.18 `pipe(strategy: per_item) { }` block

A `pipe(strategy: per_item) { }` block runs a producer/consumer chain in **streaming** mode: each item the producer emits is delivered to the consumer immediately, and the consumer runs once per item. With three or more stages, the strategy applies pairwise.

**Grammar reference**: `PipeBlock`, `PipeStrategy` (§2.2).

```axon
pipe(strategy: per_item) {
  - call QuestionGenerator.generate_questions(topic: "Apple Inc", amount: 5)
  - call EmailSender.send(recipient: "team@co.com", subject: "Follow-up question", body: ResearchCompany.report)
}
```

`QuestionGenerator.generate_questions` produces a stream of questions. For each emitted question, `EmailSender.send` runs once. The LLM runtime interprets the per-item flow.

### 3.19 `pipe(strategy: on_complete) { }` block

A `pipe(strategy: on_complete) { }` block runs a producer/consumer chain in **batch** mode: the producer runs to completion, and only then is the consumer invoked, once, with the producer's complete result.

**Grammar reference**: `PipeBlock`, `PipeStrategy` (§2.2).

```axon
pipe(strategy: on_complete) {
  - call QuestionGenerator.generate_questions(topic: "Apple Inc", amount: 10)
  - call EmailSender.send(recipient: "team@co.com", subject: "All follow-up questions", body: ResearchCompany.report)
}
```

`QuestionGenerator.generate_questions` collects all 10 questions; `EmailSender.send` then runs once with the complete list. The two strategies are syntactically identical except for the `strategy:` argument value.

### 3.20 Implicit project-wide composition (no `uses` / `import`)

Every `ClassName.skill_name(...)` reference is resolved by the compiler against the project-wide set of `.ax` files (per SR-7 in §4 and FR-010). There is **no** `uses`, `import`, `using`, `include`, or any other dependency-declaration syntax in Axon v1. The compiler discovers all `.ax` files in the source directory at compile time and treats their declared classes as the project's flat namespace.

```axon
@main
skill main {
  - call Greeter.greet(name: "Yair")              // Greeter resolved from greeter.ax
  - call ResearchCompany.research(topic: "X")     // ResearchCompany resolved from research_company.ax
}
```

The cost of this design choice is the possibility of name collisions across files (handled by error E9, Duplicate class name). The benefit is that authoring a multi-class project requires no import management — `.ax` files can be added or removed freely.

---

## §4. Semantic rules

This section lists, in numbered form, every semantic rule the Axon compiler enforces beyond the bare grammar in §2. The rules are organized by topic. Each rule follows a three-part template:

- **Rule** — a single sentence stating the constraint.
- **Example** — a short Axon snippet that illustrates the constraint (often a violating snippet and its corrected form).
- **Compiler behavior** — accept or reject, and (if reject) which error from §6 fires. Each rule cross-references the FR it satisfies.

The rules are numbered SR-1 through SR-23. SR-1 through SR-8 cover constructs needed by US1 (the small example); SR-9 through SR-15 cover inheritance and interfaces (US2); SR-16 through SR-21 cover threading and composition (US3); SR-22 and SR-23 cover structural file constraints (cross-cutting).

### 4.1 Visibility, lookup, and reference resolution

#### SR-1 — Visibility enforcement at every call site and field reference

**Rule**. At every call site and every dotted field reference, the resolved target's visibility MUST permit the calling context. `@private` members are reachable only from their own class; `@protected` members are reachable from the declaring class and any descendant; `@public` members are reachable from anywhere.

**Example** (violation):

```axon
class Greeter {
  @private
  skill internal_helper { - do something private }
}

@main
skill main {
  - call Greeter.internal_helper           // VIOLATION: @private not callable from main
}
```

**Compiler behavior**: reject with E4 (Visibility violation). Cites FR-013, FR-014.

#### SR-2 — Skill lookup order

**Rule**. When resolving a `this.member` reference inside a skill body, the resolver consults the owning class first; if the member is not found there, the resolver walks the `extends` chain depth-first along the single-parent chain until found. `base.member` skips the owning class and starts at the parent.

**Example**:

```axon
class A {
  @protected
  skill helper { - do A's helper }
}

class B extends A {
  @public
  skill use { - call this.helper }      // resolved via inheritance to A.helper
}
```

**Compiler behavior**: accept. If the walk completes without finding the member, reject with E6 (Unknown reference). Cites FR-005.

#### SR-3 — Instruction-bullet opacity

**Rule**. The compiler MUST NOT parse, analyze, or validate the natural-language content of any instruction bullet beyond detecting a leading `call ` prefix for cross-reference resolution. The remainder of each bullet is preserved byte-for-byte in the emitted `.skill` file (modulo line-ending normalization, §7.2).

**Example**:

```axon
skill decide(score) {
  - if score is greater than 5, summarize the report; otherwise, request a re-run
  - if more inputs are needed, ask the user clearly
}
```

The compiler does not parse `if ... otherwise ...`, does not check that "5" is a numeric literal, and does not require any classical control-flow structure. The bullets are preserved unchanged.

**Compiler behavior**: accept (no analysis performed). Cites FR-018; research R7.

#### SR-4 — Argument binding at call sites

**Rule**. Arguments at a call site MUST be either all named or all positional. Mixing named and positional in a single call is not permitted. Named arguments match by parameter name in any order; positional arguments match by parameter declaration order. The compiler verifies that every required parameter (one without a default) is supplied. The LLM resolves semantic compatibility at runtime.

```axon
// named — any order, defaulted params may be omitted
- call generate_questions(topic: Apple Inc, style: critical thinking)

// positional — declaration order, trailing defaults may be omitted
- call generate_questions(Apple Inc)

// VIOLATION: mixing named and positional in one call
- call generate_questions(Apple Inc, style: critical thinking)
```

**Compiler behavior**: accept named-only or positional-only calls; reject mixed calls. Verify required parameters are supplied. Cites FR-008.

#### SR-5 — Default values

**Rule**. A field's default value or a parameter's default value MUST be a simple value that the LLM compiler can recognize as a constant — a quoted string, a number, a boolean (`true`/`false`), or an unquoted word. Field references, skill calls, and compound expressions as defaults are not permitted in v1.

```axon
// valid defaults
@private is_validated = false
@private max_sources = 50
@private label = research
@private greeting = "hello world"

// VIOLATION: default is a field reference
@public start = this.compute_start()
```

**Compiler behavior**: accept simple value defaults; reject references and expressions.

#### SR-6 — DottedReference classification

**Rule**. A `DottedReference` (`ClassName.field_name`) in argument-value position is resolved by the resolver. It MUST resolve to a `@public` field of the named class. A reference to a `@protected` or `@private` field is a visibility violation (E4). A reference to a non-existent class or field is an unknown reference (E6).

**Example**:

```axon
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")
  - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
}
```

Here `ResearchCompany.report` resolves to a `@public` field of `ResearchCompany`; the resolver classifies it as a field read.

**Compiler behavior**: accept if the field is `@public` and exists; reject with E4 if the field is `@protected`/`@private`; reject with E6 if it doesn't exist. Cites FR-013, FR-014; research R8.

#### SR-7 — Implicit project-wide class resolution

**Rule**. The compiler MUST resolve every `ClassName.skill_name(...)` and every `DottedReference` (`ClassName.field_name`) against the project-wide set of `.ax` files without requiring any `uses` / `import` declaration. The compiler scans every `.ax` file in the source directory; the union of their declared classes and interfaces is the project's namespace.

**Example**: a `main.axm` that calls `Greeter.greet(...)` succeeds without declaring any import, provided `greeter.ax` exists in the project.

**Compiler behavior**: accept any call to a declared class. Reject with E6 if `ClassName` does not appear in the project's `.ax` files. Cites FR-010.

#### SR-8 — Library project validity (no `.axm` is legal)

**Rule**. A project containing zero `.axm` files MUST compile successfully and produce a bundle that omits `main.axc`. The manifest's `ENTRY POINT:` line is the literal `none`. The runtime (§8.8) treats such a bundle as a callable library.

**Example**: a project containing only `greeter.ax` (no `main.axm`) compiles to a bundle with `_manifest.axc`, `_fields/Greeter.fields`, `_skills/Greeter.greet.skill`, `_skills/Greeter.recall.skill`, and no `main.axc`.

**Compiler behavior**: accept. Cites FR-021.

### 4.2 Inheritance and interfaces

#### SR-9 — Inheritance resolution order

**Rule**. When the resolver walks the `extends` chain, it does so depth-first along the single-parent chain. Because Axon enforces single inheritance (FR-004), the chain is a path, not a tree, and the lookup order is unambiguous: this class, then parent, then grandparent, and so on. The walk halts at the first class that declares the member; if the walk reaches a class with no `extends` and the member is still not found, the lookup fails (E6).

**Example**:

```axon
class A {
  @protected
  skill base_helper { - A's helper }
}

class B extends A {
  // inherits A.base_helper
}

class C extends B {
  @public
  skill use {
    - call this.base_helper        // resolves to A.base_helper via B's inheritance
  }
}
```

**Compiler behavior**: accept. The walk goes C → B → A and finds `base_helper` in A. Cites FR-005.

#### SR-10 — Override-mode compatibility

**Rule**. A child class MAY override a parent skill only if the parent skill is declared `virtual`, `abstract`, or default (no modifier). The child's own declaration MUST NOT include an `abstract` or `virtual` modifier (the override mode is determined by the parent declaration; re-marking the child is a category error). If the parent skill is `sealed`, any child override is rejected as E5. If the parent skill is default, virtual, or abstract and the child's declaration has an explicit `abstract`/`virtual` modifier, the validator rejects with E8.

**Example A** (legal override):

```axon
class A {
  @public
  virtual skill greet { - hi }
}

class B extends A {
  @public
  skill greet { - hello }     // legal override; no modifier on the child
}
```

**Example B** (E5 — sealed parent):

```axon
class A {
  @public
  sealed skill greet { - hi }
}

class B extends A {
  @public
  skill greet { - hello }     // illegal — A.greet is sealed
}
```

**Example C** (E8 — child re-marks override mode):

```axon
class A {
  @public
  virtual skill greet { - hi }
}

class B extends A {
  @public
  virtual skill greet { - hello }   // illegal — re-marking override mode
}
```

**Compiler behavior**: reject E5 in Example B; reject E8 in Example C. Cites FR-007.

#### SR-11 — Abstract class invocation prohibition

**Rule**. A `@main` skill MUST NOT directly invoke a skill on an `abstract class`. Calls go through a concrete descendant. (Inside skill bodies of an abstract class itself, `this.*` and `base.*` calls are legal because the abstract skill's body only executes via a concrete descendant.)

**Example** (violation):

```axon
abstract class Research { /* ... */ }

@main
skill main {
  - call Research.research(topic: "Apple Inc")    // VIOLATION
}
```

**Compiler behavior**: reject with E4 (Visibility violation, sub-case "abstract class invoked from main"). The suggested fix names the abstract class and recommends invoking a concrete descendant. Cites FR-002.

#### SR-12 — Interface contract enforcement

**Rule**. For every interface in a class's `implements` list, the class (transitively, across inherited skills) MUST provide a `@public` skill matching every signature in the interface. "Matching" means same name and same parameter set (parameter names compared, since parameters are named — FR-008). A class that fails to provide a matching skill, or that provides it with a visibility other than `@public`, is rejected.

**Example A** (missing skill):

```axon
interface Researchable { @public skill research(topic) }

class C implements Researchable {
  // no `research` skill declared, not inherited
}
```

**Example B** (wrong visibility):

```axon
class C implements Researchable {
  @protected
  skill research(topic) { /* ... */ }    // VIOLATION: must be @public
}
```

**Compiler behavior**: reject with E2 (Interface contract violation). Cites FR-003, FR-004.

#### SR-13 — `base.*` resolution

**Rule**. A `base.member` reference is legal only if the owning class has a non-null `extends` parent AND the named member exists somewhere in the ancestor chain (the parent class, its parent, and so on). A `base.*` reference in a class with no `extends` is rejected. A `base.member` whose name does not appear in any ancestor is rejected.

**Example A** (no parent):

```axon
class Greeter {                       // no extends
  @public
  skill greet {
    - call base.recall                // VIOLATION
  }
}
```

**Example B** (member missing in ancestor):

```axon
class A { }
class B extends A {
  @public
  skill foo {
    - call base.does_not_exist        // VIOLATION
  }
}
```

**Compiler behavior**: reject with E3 (Invalid `base.*` reference). Cites FR-009.

#### SR-14 — Visibility on override

**Rule**. When a child class overrides a parent skill, the child's visibility MUST be the same as or wider than the parent's. A `@public` parent may only be overridden with `@public`. A `@protected` parent may be overridden with `@protected` or `@public`. Overriding a `@private` parent skill is not meaningful — `@private` skills are not inherited (only the owning class can see them), so a "child override" of a `@private` parent skill is in fact a separate skill that just happens to share a name; it does not collide.

**Example** (violation):

```axon
class A {
  @public
  virtual skill greet { - hi }
}

class B extends A {
  @protected
  skill greet { - hello }       // VIOLATION: narrower than @public parent
}
```

**Compiler behavior**: reject with E4 (Visibility violation, sub-case "narrower override"). The suggested fix tells the developer to widen the child's visibility. Cites FR-013, FR-014, and the Skill validation rules in data-model.md.

#### SR-15 — DRY bundle guarantee

**Rule**. The compiler MUST NOT emit a separate `.skill` file for any skill that a child class inherits unchanged from its parent. A child's manifest entry for such a skill points to the parent's existing `.skill` file with the annotation `inherited from <ParentClass>`. A class's fields are stored once in `_fields/<ClassName>.fields` and referenced (by bundle-relative path) from every dependent `.skill` file's `INHERITED FIELDS FROM:` and `OWN FIELDS:` lines. No skill body content appears verbatim in more than one `.skill` file.

**Example**: In the medium example (§9.2), `ResearchCompany.research` is inherited unchanged from `Research`. The bundle therefore contains `_skills/Research.research.skill` but NOT `_skills/ResearchCompany.research.skill`. The manifest records this with `research [@public, inherited from Research]` under `ResearchCompany`'s class entry.

**Compiler behavior**: accept (this is a constraint on emission, not on source). Cites FR-024.

### 4.3 Threading and composition

#### SR-16 — `parallel { }` semantics

**Rule**. Each call inside a `parallel { }` block executes as an independent fire-and-forget agent with no shared intermediate state. The branches do not synchronize with each other; they may complete in any order. The block returns to the parent skill once every branch has completed. If two branches mutate the same field, the language guarantees no atomicity — the developer is responsible for avoiding that conflict.

**Example**:

```axon
parallel {
  - call FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")
  - call EmailSender.send(recipient: "team@co.com", subject: "Done", body: ResearchCompany.report)
}
```

Both calls launch simultaneously; neither observes the other's intermediate state.

**Compiler behavior**: accept. Reject if the block contains anything other than `- call ...` instructions (E6 or a parse error, depending on the violation). Cites FR-015, FR-017.

#### SR-17 — `pipe(strategy: per_item)` semantics

**Rule**. A `pipe(strategy: per_item) { }` block executes its producer (the first call inside the block) and streams each emitted item to the consumer (the second call). The consumer runs once per item. With three or more stages, the strategy applies pairwise — each stage's output streams to the next.

**Example**:

```axon
pipe(strategy: per_item) {
  - call QuestionGenerator.generate_questions(topic: "X", amount: 5)
  - call EmailSender.send(recipient: "team@co.com", subject: "Follow-up question", body: ResearchCompany.report)
}
```

The producer emits five questions; the consumer runs once per question.

**Compiler behavior**: accept. Cites FR-016.

#### SR-18 — `pipe(strategy: on_complete)` semantics

**Rule**. A `pipe(strategy: on_complete) { }` block runs the producer to completion before invoking the consumer once with the producer's complete output.

**Example**:

```axon
pipe(strategy: on_complete) {
  - call QuestionGenerator.generate_questions(topic: "X", amount: 5)
  - call EmailSender.send(recipient: "team@co.com", subject: "All questions", body: ResearchCompany.report)
}
```

`generate_questions` finishes producing all five questions; then `send` runs once with the complete set.

**Compiler behavior**: accept. Cites FR-016.

#### SR-19 — Multi-stage pipe semantics

**Rule**. A `pipe(strategy: X) { }` block MAY contain more than two calls. With N calls, the strategy applies pairwise between consecutive stages: call 1 feeds call 2 using strategy X, call 2 feeds call 3 using strategy X, and so on. The pipe block returns to the parent skill once the final stage has completed.

**Example**:

```axon
pipe(strategy: per_item) {
  - call A.produce
  - call B.transform
  - call C.consume
}
```

A streams to B item-by-item; B streams its outputs to C item-by-item. The strategy `per_item` applies to both edges.

**Compiler behavior**: accept any pipe block with ≥ 2 call instructions. A pipe block with fewer than 2 calls is a parse error. Cites FR-016; from spec.md Assumptions.

#### SR-20 — Implicit project-wide composition

**Rule**. The compiler scans every `.ax` file in the source directory and treats the union of their declared classes and interfaces as the project's namespace. Every `ClassName.skill_name(...)` reference and every `DottedReference` resolves against this union without any developer-supplied `uses` / `import` declaration. Cross-file class-name collisions are rejected as E9.

**Example**: A project with `greeter.ax` and `main.axm` requires no import; `main.axm` calling `Greeter.greet(name: "Yair")` succeeds because the compiler discovers `Greeter` in the source directory.

**Compiler behavior**: accept all cross-class references whose target exists in the project. Cites FR-010, FR-022.

#### SR-21 — Threading blocks in any skill body

**Rule**. `parallel { }` and `pipe(strategy: ...) { }` blocks are syntactically permitted in any skill body, not only inside `@main`. The compiler treats them identically wherever they appear. The block desugars in the same way during emission: an indented `- parallel:` or `- pipe (strategy: <name>):` marker in the enclosing `.skill` file's `BODY:` section followed by the contained calls indented under it.

**Example**:

```axon
class Aggregator {
  @public
  skill run(topic) {
    parallel {
      - call A.do_one(topic: topic)
      - call B.do_two(topic: topic)
    }
  }
}
```

`Aggregator.run` contains a `parallel { }` block. The compiler emits it into `_skills/Aggregator.run.skill` using the same `- parallel:` marker convention as for `main.axc`.

**Compiler behavior**: accept. From data-model.md MainSkill note.

### 4.4 Structural file constraints

#### SR-22 — One declaration per `.ax` file

**Rule**. An `.ax` file MUST contain exactly one of: a `ClassDecl`, an `AbstractClassDecl`, or an `InterfaceDecl`. Two top-level declarations in one file are a parse error. An `.ax` file MUST NOT contain a `MainDecl` (`@main` is reserved for `.axm` files).

**Example** (violation):

```axon
// file: things.ax
class Foo { }
class Bar { }    // VIOLATION — second declaration in the same file
```

**Compiler behavior**: reject as a parse error. The error message names both declarations and recommends splitting them across two files. Cites the file-payload constraints in data-model.md.

#### SR-23 — Skill body presence matches override mode

**Rule**. A skill declaration's body presence MUST be consistent with its override mode:

- A skill with `OverrideMode = abstract` MUST omit the `{ SkillBody }` block. An abstract skill with a body is a parse error.
- A skill with no override modifier, `virtual`, or `sealed` MUST include a `{ SkillBody }` block. A non-abstract skill without a body is a parse error.

**Example A** (violation):

```axon
@protected
abstract skill gather_sources(topic) {     // VIOLATION — abstract has no body
  - do something
}
```

**Example B** (violation):

```axon
@public
skill greet(name)     // VIOLATION — non-abstract requires body
```

**Compiler behavior**: reject as a parse error in both cases. Cites the Skill validation rules in data-model.md.

---

## §5. Compiler architecture

The Axon compiler is not classical code. It is an Axon skill — a precise set of instructions that Claude follows to transform `.ax` and `.axm` source files into a compiled bundle. The runtime is a second Axon skill that Claude follows to execute the bundle.

### 5.1 Stage 1 — The compiler skill

The compiler skill instructs Claude to:

1. **Discover sources** — read all `.ax` files and at most one `.axm` file from the source directory
2. **Parse structure** — for each file, identify the class, abstract class, or interface declaration; its fields block; its skills with visibility and override mode; its parameter lists; and its instruction bullets. Instruction bullets are treated as opaque text and are not interpreted.
3. **Resolve references** — build the class graph; walk inheritance chains; for every `call` instruction, verify the referenced class and skill exist and are accessible from the call site
4. **Validate rules** — enforce all structural rules: abstract skills implemented, interface contracts satisfied, visibility respected, sealed skills not overridden, no cyclical inheritance, no duplicate class names, at most one `@main`
5. **Report errors** — if any validation fails, report all errors (never just the first) with file, line, and suggested fix; do not emit a partial bundle
6. **Emit bundle** — if validation passes, write the compiled bundle directory following the format specified in §7 exactly, honoring all DRY guarantees

### 5.2 Stage 2 — The runtime skill

The runtime skill instructs Claude to:

1. **Read the manifest** — load `_manifest.axc` first to understand the class graph, inheritance chains, interface implementations, and skill locations
2. **Resolve the entry point** — if `main.axc` is present, begin execution there; otherwise treat the bundle as a callable library awaiting user instruction
3. **Execute skills** — for each skill call, locate the skill file via the manifest, load its fields context, and execute its instruction bullets in order
4. **Honor threading** — execute `parallel {}` blocks as concurrent agents with no shared intermediate state; execute `pipe(strategy: per_item)` blocks in streaming mode; execute `pipe(strategy: on_complete)` blocks in batch mode
5. **Resolve references at runtime** — `this.*` resolves against the executing class's manifest entry; `base.*` walks the ancestor chain via the manifest
6. **Surface errors** — if an instruction is ambiguous or unexecutable, report the issue in plain language identifying the failing skill and the problem

### 5.3 Toolchain

```
.ax source files + optional .axm
        ↓
Claude reads AxonCompiler.compile skill
        ↓
validates structure and references
        ↓ (errors block emission)
emits compiled bundle directory
        ↓
Claude reads AxonRuntime.execute skill
        ↓
reads _manifest.axc → executes skills
```

No classical programming language is required. Claude is both the compiler and the runtime.

---

## §6. Compiler error catalog

This section enumerates every compiler error the Axon compiler MUST detect, the exact message format, an example source snippet that triggers each error, and a suggested fix. It is the contract between the compiler (which produces errors) and the developer (who must understand and resolve them). It implements FR-027, FR-028, FR-029 and is the section a developer who has hit an error should consult first.

### 6.1 Common message format

Every error MUST contain four elements (FR-028):

1. **Source file path** (project-relative).
2. **Line and column** (1-indexed; line 1 is the first line of the file, column 1 is the first character of the line).
3. **Human-readable message** explaining the violation.
4. **Suggested fix** — concrete code or change — whenever a feasible fix exists.

The canonical rendered format:

```
ERROR in <file_path>, line <N>, column <M>:
  <one-line summary>

  <longer explanation, optional, wrapped at ~80 columns>

  Suggested fix — <one-line description>:

    <indented code suggestion>
```

If multiple errors are detected in a project, the compiler MUST emit them ALL (not just the first), separated by one blank line each, and exit non-zero (FR-029). No partial bundle is written on any error.

A small subset of errors are project-wide rather than tied to a single file/line (notably E10 sub-case A: two `.axm` files). For those errors, the `line <N>, column <M>` portion of the header is omitted and replaced by `ERROR (project-wide):`.

### 6.2 The ten errors

#### E1 — Unimplemented abstract skill

**Triggered when** a concrete class extends an abstract ancestor but does not declare every inherited abstract skill.

**Example source** (`research_company.ax`):

```axon
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

#### E2 — Interface contract violation

**Triggered when** a class declares `implements <Interface>` but does not provide a `@public` skill matching one of the interface's required signatures (or provides it with the wrong visibility).

**Example source** (`research_company.ax`):

```axon
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

A second sub-case: a required skill is missing entirely. The message replaces the visibility line with `but does not provide skill 'research'.` and the suggested fix is to add the skill stub.

#### E3 — Invalid `base.*` reference

**Triggered when** a skill body uses `base.<member>` in a class that has no `extends` clause, or references a member that does not exist in the ancestor chain.

**Example source A** (no parent — `greeter.ax`):

```axon
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

```axon
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
ERROR in b.ax, line 5, column 12:
  'base.does_not_exist' is invalid: class 'A' does not define 'does_not_exist'.

  Suggested fix — either define 'does_not_exist' in 'A' or one of its ancestors,
  or remove the reference.
```

#### E4 — Visibility violation

**Triggered when** a `@private` member is referenced from outside its owning class, or a `@protected` member is referenced from outside its inheritance chain. Two related sub-cases ride on this error: invocation of an abstract class from `main` (SR-11) and a narrower override visibility than the parent declared (SR-14).

**Example source** (`main.axm`):

```axon
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

The `@protected`-violation variant uses analogous wording (`from outside the inheritance chain of class 'X'.`). The abstract-class-from-main variant says `Cannot invoke skill on abstract class 'Research' directly from @main; route the call through a concrete descendant.` The narrower-override variant says `Override of 'B.foo' has visibility @protected; parent 'A.foo' is @public — overrides may only widen visibility, not narrow it.`

#### E5 — Sealed skill override

**Triggered when** a child class declares a skill that the parent (or any ancestor) has marked `sealed`.

**Example source**:

```axon
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
ERROR in b.ax, line 10, column 1:
  Class 'B' cannot override skill 'foo': it is declared 'sealed' in class 'A'.

  Suggested fix — remove the override from 'B'. If 'B' needs different behavior,
  introduce a new skill with a different name, or change 'A.foo' from 'sealed'
  to 'virtual' if the design permits.
```

#### E6 — Unknown reference

**Triggered when** a skill body references a class, skill, or field that does not exist in the project.

**Example source** (`main.axm`):

```axon
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

- Unknown skill on a known class: `Class 'X' has no skill 'Y'.` Suggested fix lists nearby names if Levenshtein distance ≤ 2 to a real skill.
- Unknown field: `Class 'X' has no field 'Y'.`
- Unknown member in a `this.X` or `base.X` reference: same wording, scoped to the owning class.

The compiler SHOULD perform a "did you mean?" suggestion when a close match exists.

#### E7 — Cyclical inheritance

**Triggered when** the `extends` chain contains a cycle.

**Example source** (across three files):

```axon
// a.ax
class A extends C { }

// b.ax
class B extends A { }

// c.ax
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

#### E8 — Override mode mismatch

**Triggered when** a child class declares an overriding skill with an explicit `abstract` or `virtual` modifier. The override mode is determined by the *declaring (ancestor)* class; the child's redeclaration is by definition an override and must not be re-marked as `abstract` or `virtual`. (The companion case — overriding a `sealed` skill — is caught by E5.)

**Example source**:

```axon
class A {
  @public
  virtual skill foo {
    - parent body
  }
}

class B extends A {
  @public
  abstract skill foo                         // VIOLATION
}
```

**Message**:

```
ERROR in b.ax, line 10, column 1:
  Override mode mismatch on 'B.foo': a child class cannot mark an overriding
  skill as 'abstract' or 'virtual'. The override mode is determined by the
  declaring (ancestor) class.

  Suggested fix — remove the 'abstract'/'virtual' modifier from the child:

    @public
    skill foo {
      - your override body
    }
```

A related sub-case: the child re-declares the parent's skill as `sealed`. Sealed status flows from the **first** definition and may be re-affirmed (no-op) but not introduced by the child. Re-marking an inherited skill `sealed` in the child also fires E8.

#### E9 — Duplicate class name

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

#### E10 — Multiple `@main` skills

**Triggered when** either (a) the project contains more than one `.axm` file, or (b) a single `.axm` contains more than one `@main` skill declaration. Sub-case (c) — `@main` declared inside an `.ax` file (misplaced) — is reported as E10 as well, since structurally it has the same root cause (the `@main` token is in the wrong place).

**Example case A** — two `.axm` files: `main.axm`, `main2.axm`.

**Message**:

```
ERROR (project-wide):
  Project contains multiple .axm files:

    - main.axm
    - main2.axm

  A project must declare at most one @main entry point.

  Suggested fix — merge the two main files into one, or delete the one
  that is not the intended entry point.
```

(Note: this case does not have a single source file/line; the format relaxes "line N, column M" for project-wide errors.)

**Example case B** — single file with two `@main`:

```axon
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

**Example case C** — misplaced `@main` in an `.ax` file:

```axon
// file: foo.ax  (NOT main.axm)
@main
skill main {
  - call Greeter.greet(name: "Yair")
}
```

**Message**:

```
ERROR in foo.ax, line 1, column 1:
  '@main' declared inside an .ax file. The @main entry point belongs in a
  .axm file (project-wide, at most one).

  Suggested fix — move this block to a main.axm file:

    // main.axm
    @main
    skill main {
      ...
    }
```

### 6.3 Coverage trace

| FR-027 enum entry | Catalog entry above | Semantic rule(s) that fire it |
|---|---|---|
| 1. Unimplemented abstract skill | E1 | SR-9, SR-10 |
| 2. Interface contract violation | E2 | SR-12 |
| 3. Invalid `base.*` reference | E3 | SR-13 |
| 4. Visibility violation | E4 | SR-1, SR-11, SR-14 |
| 5. Sealed skill override | E5 | SR-10 |
| 6. Unknown reference | E6 | SR-2, SR-6, SR-7, SR-20 |
| 7. Cyclical inheritance | E7 | (resolver pre-condition; see §5.3) |
| 8. Override mode mismatch | E8 | SR-10 |
| 9. Duplicate class name | E9 | (resolver pre-condition; see §5.3) |
| 10. Multiple `@main` skills | E10 | SR-22 (sub-case C) + project-wide check |

All ten errors are covered. Each catalog entry contains: trigger description, example source snippet, the exact message format with all four required elements (FR-028), and a suggested fix.

---

## §7. Output bundle format

This section specifies the on-disk shape of an Axon compiled bundle precisely enough that two independent compiler implementations would produce **byte-equivalent** bundles for the same input project (Success Criterion SC-004, FR-038). It is the contract between the compiler (which produces bundles) and the LLM runtime (which consumes them). It implements FR-023, FR-024, FR-025, and FR-026.

### 7.1 Directory layout

Every Axon compiled bundle is a directory with the following layout. Items shown in parentheses are conditional.

```
<bundle_root>/
  _manifest.axc                              (always present)
  (main.axc)                                 (present iff project had a .axm file)
  _fields/
    <ClassName>.fields                       (one per class that declares its own fields)
    ...
  _skills/
    <ClassName>.<skill_name>.skill           (one per skill owned by a declaring class — see §7.1.2)
    ...
```

#### 7.1.1 File and directory ordering

The compiler MUST emit files such that:

1. The directories `_fields/` and `_skills/` are created before any contained files.
2. Within `_fields/`, files MUST be sorted by class name lexicographically (ASCII).
3. Within `_skills/`, files MUST be sorted first by class name then by skill name, both lexicographically.
4. `_manifest.axc` is the **last** file written, after all referenced files exist.

This ordering, together with the deterministic content rules in §7.3–§7.6 below, is what makes the bundle byte-equivalent across implementations.

#### 7.1.2 Which skills appear under `_skills/`

A `SkillFile` exists in `_skills/` if and only if the skill is **owned** by some class declaration — meaning that class either (a) originally declared the skill, or (b) overrides a virtual/abstract parent skill with its own body. Inherited-but-not-overridden skills do **not** get a separate file under the child's namespace; the manifest's child-class entry points to the parent's existing SkillFile. This is the DRY guarantee from FR-024.

Examples:
- `Research.write_report` is declared in `Research` → emits `_skills/Research.write_report.skill`.
- `ResearchCompany` overrides `write_report` → emits `_skills/ResearchCompany.write_report.skill`.
- `ResearchCompany` inherits `research` from `Research` unchanged → emits **no** `_skills/ResearchCompany.research.skill`. The manifest links `ResearchCompany.research` to `_skills/Research.research.skill`.

Abstract skills NEVER produce a `.skill` file: they have no body to emit. They appear only in the manifest's class-skill list with the override-mode tag `abstract`.

### 7.2 Common file conventions

All bundle files share these rules:

- **Encoding**: UTF-8 without BOM.
- **Line endings**: LF (`\n`) only. No CRLF in any emitted file.
- **Trailing newline**: every file MUST end with exactly one LF.
- **Whitespace**: exactly one space after each `:` separator; no leading whitespace on any structural line. Indentation in list payloads (see §7.3 and §7.5) uses exactly **two spaces** per level.
- **Comments**: not supported in any bundle file (the compiler must not emit any).
- **Section headers**: where present, written in uppercase followed by a single LF and a separator line of equal length using `=` characters. Section headers appear only in the manifest (see §7.6).
- **Key order**: within any file type, the keys MUST appear in the order specified in this document. No alphabetization within a file unless explicitly required.

### 7.3 `.fields` file schema (`_fields/<ClassName>.fields`)

Holds the fields declared by exactly one class. Inherited fields are **not** re-listed here — they remain in their parent's `.fields` file and are joined at runtime via the manifest.

#### 7.3.1 Format

```
CLASS: <ClassName>
<visibility> <field_name>[ = <literal>]
<visibility> <field_name>[ = <literal>]
...
```

#### 7.3.2 Rules

- The first line is the `CLASS:` header. Exactly one space follows the colon. The class name MUST match the file name (without the `.fields` extension).
- Each subsequent non-empty line is one field declaration.
- Field declarations MUST appear in **source order** — the order they appear in the original `fields { }` block. The compiler MUST NOT reorder them.
- `<visibility>` is one of `@public`, `@protected`, `@private`.
- A field with no default is written as `<visibility> <field_name>`.
- A field with a default is written as `<visibility> <field_name> = <literal>` with exactly one space on each side of `=`. The literal is rendered identically to its source form (string literals keep their surrounding quotes; integers and booleans are bare).
- No blank lines between fields. No trailing whitespace on any line.

#### 7.3.3 Example

For `Research`'s field block (from the medium example, §9):

File: `_fields/Research.fields`
```
CLASS: Research
@protected sources
@protected report
@private is_validated = false
```

### 7.4 `.skill` file schema (`_skills/<ClassName>.<skill_name>.skill`)

Holds one skill, fully resolved.

#### 7.4.1 Format

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

#### 7.4.2 Rules

- All eight header keys (`CLASS`, `SKILL`, `VISIBILITY`, `OVERRIDE_MODE`, `PARAMS`, `INHERITED FIELDS FROM`, `OWN FIELDS`, `DEPENDS ON`) MUST be present in this exact order, even if their value is empty/none.
- `<override_mode_or_provenance>` is one of:
  - `default` — original implementation in this class, no parent had it
  - `virtual` — original implementation marked virtual
  - `sealed` — original implementation marked sealed
  - `overrides <ParentClass>.<skill>` — when this skill overrides a parent virtual/abstract
  - `implements abstract from <ParentClass>` — when this skill provides an implementation of a parent abstract
  - `implements <Interface>` — when this skill satisfies an interface contract
  - When more than one provenance applies (e.g., overrides parent AND implements interface), they are joined with `; ` and listed in this priority order: override → abstract impl → interface impl.
  - The value `inherited (from <ParentClass>)` is NOT used in the body file (which only exists when the skill is owned by the class). It appears only in the manifest (§7.6) to record an inheritance link.
- `<comma_separated_param_list_or_none>`: if the skill has no parameters, the value is the literal word `none`. If it has parameters, list them by `name` only (no defaults — defaults are interpreter-side information and live in the manifest if needed). Separate with `, `.
- `INHERITED FIELDS FROM`: bundle-relative path to the parent class's `.fields` file if this skill's owning class has a parent with a `.fields` file, else the literal word `none`. If the inheritance chain has multiple ancestors with fields, list them comma-separated, root-most first.
- `OWN FIELDS`: bundle-relative path to this class's `.fields` file, else `none`.
- `DEPENDS ON`: a YAML-style indented list of bundle-relative paths to every emitted `.skill` file referenced (directly or via `this.*` / `base.*` / `ClassName.skill`) in the body. References whose target is `abstract` (and therefore has no emitted file per §7.1.2) are omitted from this list — the runtime resolves them through the manifest at execution time, walking to the concrete descendant that supplies a body. The list MUST be sorted lexicographically. If empty, the line `DEPENDS ON:` is followed by no list items and the next section header (`BODY:`) follows directly on the next line.
- `BODY`: an indented list of instructions, written exactly as they appeared in the source (per FR-018, the compiler preserves bullet text verbatim). Each instruction line begins with `  - ` (two spaces, dash, one space). If the skill is `abstract`, the body section is absent — the `.skill` file for an abstract skill is NOT emitted at all (abstract skills only appear in the manifest's signature list).

#### 7.4.3 Example (DRY guarantee in action)

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

`_skills/Research.research.skill` (note: `gather_sources` and `validate_sources` are abstract and have no emitted file, so they are omitted from `DEPENDS ON` — runtime resolution walks the manifest):
```
CLASS: Research
SKILL: research
VISIBILITY: @public
OVERRIDE_MODE: default
PARAMS: topic
INHERITED FIELDS FROM: none
OWN FIELDS: _fields/Research.fields
DEPENDS ON:
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

`_skills/ResearchCompany.research.skill` is **not** present in the bundle — `ResearchCompany.research` is inherited unchanged from `Research`. The manifest (§7.6) records that the child's `research` skill resolves to `_skills/Research.research.skill`. This is the DRY guarantee made byte-concrete.

### 7.5 `main.axc` schema

The compiled main file. Same overall shape as a `.skill` file but with a different header and no class context.

#### 7.5.1 Format

```
ENTRY: main
DEPENDS ON:
  - <bundle_relative_path>
  ...
BODY:
  - <instruction text>
  ...
```

#### 7.5.2 Rules

- `ENTRY:` is always followed by the literal `main`.
- `DEPENDS ON` and `BODY` follow the same rules as in `.skill` files (§7.4.2).
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

### 7.6 `_manifest.axc` schema

The first file the runtime reads. Enumerates the project's class graph, interface contracts, and entry point. Uses section headers.

#### 7.6.1 Format

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

#### 7.6.2 Rules

- The header line `AXON BUNDLE v1` and its `=` underline are constants. The `=` line MUST be exactly 14 characters (the length of `AXON BUNDLE v1`).
- Section headers `CLASSES:`, `INTERFACES:`, and `ENTRY POINT:` appear in this order, each preceded by exactly one blank line.
- `<kind>` is `[abstract]` or `[concrete]`.
- Class entries within `CLASSES:` MUST be sorted lexicographically by class name.
- Interface entries within `INTERFACES:` MUST be sorted lexicographically.
- Within a class's `skills:` list, entries MUST be sorted lexicographically by skill name.
- For inherited-but-not-overridden skills, the override-mode tag is `inherited from <ParentClass>` and points (via the manifest semantics) to the parent's skill file.
- For implemented interface skills, the tag includes `implements <InterfaceName>`.
- If no `.axm` was provided, the `ENTRY POINT:` line reads `  none`.
- Within each class entry, the skill list column for the `[visibility, override_mode_or_provenance]` annotation is right-padded with spaces so the `[` aligns at the same column for every skill in that class. The padding is purely visual; runtimes MUST ignore extra whitespace before `[`.

#### 7.6.3 Example (medium example)

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

### 7.7 Byte-equivalence checklist

For two compiler implementations to produce byte-equivalent bundles for the same project, both MUST observe:

1. UTF-8 without BOM, LF-only line endings, exactly one trailing LF per file.
2. Two-space indentation in all list payloads.
3. Single space after every `:` separator.
4. No tabs anywhere in any file.
5. Sorted ordering wherever §7.1.1, §7.3.2, §7.4.2, §7.6.2 specify sorting; source-order ordering wherever they specify source order.
6. Identical filename casing (class and skill names preserve source casing).
7. No emission of files for abstract skills (only manifest entries).
8. No emission of files for inherited-but-not-overridden skills (only manifest entries pointing to parent).

A compiler that fails any item above is non-conforming.

---

## §8. Runtime contract

This section specifies what the runtime — Claude — does when given an Axon compiled bundle. It implements FR-030 and FR-031. The contract is written as a sequence of obligations the LLM runtime MUST observe. The bundle is the only artifact the runtime ever sees; the original `.ax` / `.axm` sources are never handed to it (Assumptions in spec.md).

### 8.1 Bundle handoff

When a developer asks Claude to "execute this bundle," the input Claude is given is the directory tree described in §7. Claude is NOT given the original source files. Claude MUST treat the bundle as self-describing — every cross-reference the runtime needs has been resolved by the compiler and recorded in the manifest.

### 8.2 Manifest-first ordering

Before reading any `.skill` file, `.fields` file, or `main.axc`, Claude MUST read `_manifest.axc` in full. The manifest's structure (§7.6) is the runtime's single source of truth for:

- Which classes exist in this bundle, abstract vs concrete.
- Each class's `extends` parent (if any), `implements` interfaces (if any), and its full skill list with visibility + override-mode annotations.
- The path to each class's own `.fields` file and to any inherited `.fields` files.
- The full set of interfaces declared in the project and their required skill signatures.
- The entry point — either a path to `main.axc` or the literal `none` if the bundle is a library.

The runtime MUST NOT attempt to discover the class graph by directory scan. The manifest is authoritative.

### 8.3 Resolving `this.*` and `base.*` against the manifest

When the runtime executes a skill body and encounters an instruction beginning with `- call this.X` or `- call base.X`:

- For `this.X`: look up `X` in the manifest entry for the owning class's skill list. If `X` is not present in the owning class's own skills, walk the `extends` chain (using the manifest's `extends:` field) depth-first and look up `X` in each ancestor's skills until a match is found. If `X` matches a skill marked `inherited from <ParentClass>`, the manifest's annotation points to the parent's `.skill` file; the runtime reads that file directly.
- For `base.X`: look up `X` in the manifest entry for the **parent** class named by the owning class's `extends:`. If the parent's manifest entry shows `X` as `inherited from <Grandparent>`, the runtime reads the grandparent's `.skill` file (transitive walk).
- If `X` cannot be resolved against the manifest, the runtime SHOULD halt and report the failure to the user in plain language, naming the unresolved reference and the file path where the reference appeared. (This corresponds to a compiler bug — a well-formed bundle should never contain unresolved references — but the runtime defends against malformed bundles.)

For cross-class calls `ClassName.skill_name(...)`, the runtime looks up `ClassName` in the manifest's `CLASSES:` section. If found, it reads that class's manifest entry for `skill_name` (which may be either a direct `.skill` file path or an `inherited from <ParentClass>` annotation). If not found, the runtime halts with a clear error.

### 8.4 Visibility enforcement at call resolution time

The compiler enforces visibility statically — it would not have produced a bundle if a visibility violation existed. However, the runtime MUST also honor visibility annotations as a defense in depth. Specifically:

- A `@private` skill MUST NOT be reachable from any caller outside its declaring class. The runtime treats a `.skill` file with `VISIBILITY: @private` as callable only via a `this.X` reference from another skill in the same class.
- A `@protected` skill is callable only from `this.X` or `base.X` references inside the declaring class or any descendant.
- A `@public` skill is callable from any reference site.
- The same rules apply to field reads. A `@private` field can only be read via `this.field_name` inside its class's own skills; a `@public` field can be read via `ClassName.field_name` from anywhere.

If the runtime detects a visibility-violating reference (again, a malformed-bundle case), it MUST halt and report.

### 8.5 Executing skill bodies

When the runtime executes a skill body, it reads the `.skill` file pointed to by the manifest (resolving through inheritance if necessary, per §8.3). The file's `BODY:` section is a list of instruction bullets. The runtime treats each bullet as a natural-language instruction:

- If the bullet text begins with `call ` (literal "call" + one space) and parses as a `CallExpression` per §2, the runtime treats it as a structural call: it resolves the target through the manifest and executes the called skill, then continues with the next bullet.
- If the bullet does NOT begin with `call `, the runtime treats it as free-speech instruction: it interprets the prose semantically, performs the action it describes, and continues with the next bullet. Examples: `- greet name warmly`, `- if the topic mentions a public company, gather recent SEC filings`, `- store the result in this.report`.
- Parameter values bound by name at the call site (per the call's `NamedArg` list) are accessible to the called skill by parameter name. The runtime makes the bound values available to the LLM as if they were variables in the skill's local scope.

The runtime is responsible for terminating: if a skill body recurses or loops semantically and the LLM judges that termination has been reached, execution returns to the caller. The compiler does not attempt to prove termination (this is a deliberate consequence of free-speech logic — see §1.2).

### 8.6 Executing `parallel { }` blocks

When the runtime encounters a `parallel:` entry inside a `BODY:` list (in `main.axc` or any skill — see §4 SR-21), it MUST:

1. Launch each contained call as an **independent agent** with no shared intermediate state with the other branches. Each branch sees only the parameter values bound at its call site and any `@public` field values it reads through the manifest.
2. Treat the branches as **fire-and-forget**: the parent skill continues immediately past the `parallel:` block; results from inside the parallel block are not collected into a return value.
3. Avoid any implicit synchronization between branches. The branches do not observe each other's intermediate state, and they may complete in any order.

If two parallel branches mutate the same field, the language guarantees no atomicity (per Assumptions in spec.md). The developer is responsible for avoiding such a conflict; the runtime is not required to detect it.

### 8.7 Executing `pipe(strategy: ...) { }` blocks

When the runtime encounters a `pipe (strategy: <name>):` entry inside a `BODY:` list, it MUST:

- For `strategy: per_item`: stream items from the producer to the consumer as the producer emits them. The consumer executes once per item produced. This is the streaming form. The pipe terminates when the producer is done emitting.
- For `strategy: on_complete`: wait for the producer to finish entirely, then invoke the consumer once with the producer's complete result. This is the batch form.
- For three or more stages (a pipe block with N calls): the strategy applies pairwise between consecutive stages — stage 1 feeds stage 2 with the chosen strategy, stage 2 feeds stage 3 with the same strategy, etc.

The pipe block returns to the parent skill once all stages have completed.

### 8.8 Executing `main.axc`

If the bundle's manifest names a non-`none` `ENTRY POINT:`, the runtime begins execution at `main.axc`:

1. Read `main.axc`.
2. Walk its `BODY:` list top-to-bottom, executing each instruction as described above.
3. When the body completes, the program is done. Report final status to the user in plain language.

If the manifest's `ENTRY POINT:` is `none`, the bundle is a callable library. The runtime does NOT execute anything spontaneously; it waits for an explicit request from the user, such as "call `ResearchCompany.research(topic: \"Apple Inc\")` from the bundle." When such a request arrives, the runtime resolves the named call against the manifest and executes from there.

### 8.9 Surfacing runtime errors

The runtime SHOULD surface any failure to execute an instruction unambiguously by stopping further execution and reporting in plain language:

- The skill being executed and the source bundle file path.
- The instruction bullet that could not be completed (or the structural call that could not be resolved).
- A brief diagnosis of why the failure occurred.

The spec does not prescribe a structured runtime error format beyond these three elements (per the assumptions in spec.md). Future versions may define a runtime error taxonomy (see §10).

### 8.10 Summary of runtime obligations

Restated as a numbered checklist for implementation review:

1. Read `_manifest.axc` first; never scan the directory for the class graph.
2. Resolve every `this.*` / `base.*` / `ClassName.skill_name` reference through the manifest.
3. Honor visibility annotations as a defense-in-depth check.
4. Execute `parallel { }` as fire-and-forget concurrent agents with no shared intermediate state.
5. Execute `pipe(strategy: per_item)` as streaming and `pipe(strategy: on_complete)` as batch; apply strategy pairwise between consecutive stages.
6. Execute `main.axc` if the manifest names one; otherwise treat the bundle as a callable library and wait for an explicit request.
7. Surface runtime failures in plain language identifying the failing skill, the failing instruction, and the cause.

---

## §9. Example programs

This section presents three complete Axon programs of increasing complexity and, for the medium example, the full compiled bundle that the compiler MUST produce from it. Together the examples cover every language construct cited in FR-001 through FR-022 (per FR-040, SC-002, SC-007). Each example is also available as standalone source files under `docs/axon/examples/`; the medium example's compiled bundle is available under `docs/axon/examples-compiled/medium/`.

### 9.1 Small example — `Greeter`

The smallest end-to-end Axon program. One class, two skills, one field, no inheritance, no interfaces, no threading. The smallest program that proves the language has end-to-end value.

#### 9.1.1 Source files

`docs/axon/examples/small/greeter.ax`:

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

`docs/axon/examples/small/main.axm`:

```axon
@main
skill main {
  - call Greeter.greet(name: "Yair")
  - call Greeter.recall
}
```

#### 9.1.2 Compiled bundle (narrative)

Compiling the small example MUST produce a bundle whose contents — when verified against the schemas in §7 — match the following description exactly.

**`_manifest.axc`** is the first file the runtime reads. It enumerates exactly one class (`Greeter`, concrete, no parent, no implemented interfaces), records the path to that class's own fields file, and lists its two skills `greet` and `recall` in lexicographic order, each tagged with its visibility (`@public`) and override mode (`default` — neither skill overrides an inherited skill, and neither is virtual or sealed). The entry point line names `main.axc`.

**`_fields/Greeter.fields`** contains a single `CLASS: Greeter` header followed by one field line declaring `@private last_greeting` with no default. Source order is preserved (there is only one field, so ordering is trivial).

**`_skills/Greeter.greet.skill`** is the body file for the `greet` skill. Its header records `CLASS: Greeter`, `SKILL: greet`, `VISIBILITY: @public`, `OVERRIDE_MODE: default`, `PARAMS: name`, `INHERITED FIELDS FROM: none` (no parent class), `OWN FIELDS: _fields/Greeter.fields`, and an empty `DEPENDS ON:` block (the body does not call any other skill — its bullets reference `this.last_greeting`, which is a field reference, not a skill call). The `BODY:` section contains both source bullets in source order: `- greet name warmly` and `- store the greeting in this.last_greeting`.

**`_skills/Greeter.recall.skill`** is the body file for the `recall` skill. Its header records the same `CLASS` and identical fields-related lines as `greet`. `PARAMS:` is `none` (recall takes no parameters). `DEPENDS ON:` is empty. The `BODY:` section contains the single bullet `- return this.last_greeting`.

**`main.axc`** is the compiled entry point. Its `ENTRY:` line is `main`. Its `DEPENDS ON:` block lists the two skill files it calls — `_skills/Greeter.greet.skill` and `_skills/Greeter.recall.skill` — sorted lexicographically. Its `BODY:` section contains the two `- call Greeter.greet(name: "Yair")` and `- call Greeter.recall` bullets in source order.

#### 9.1.3 Execution narrative

When Claude is handed this bundle and asked to execute it:

1. Claude reads `_manifest.axc` first, learning that one class `Greeter` exists with two skills `greet` and `recall`, and that the entry point is `main.axc`.
2. Claude reads `main.axc`, which directs it to call `Greeter.greet(name: "Yair")` then `Greeter.recall`.
3. For the first call, Claude reads `_skills/Greeter.greet.skill` and executes its bullets: it greets "Yair" warmly (the first bullet) and stores that greeting into `Greeter.last_greeting` (the second bullet — a field write to the class's shared state).
4. For the second call, Claude reads `_skills/Greeter.recall.skill` and executes its single bullet: it returns the stored greeting.
5. The program ends. Claude reports the final greeting back to the user.

If the bundle is handed to Claude without a `main.axc` (a library bundle — see SR-8), Claude does not execute spontaneously; it waits for an explicit call request from the user.

### 9.2 Medium example — `Research` / `ResearchCompany` / `Researchable`

The medium example exercises inheritance (abstract base + concrete child), interfaces, abstract skills, virtual override with `base.*`, and the bundle's DRY guarantee. Of the three examples, this is the one for which the full compiled bundle is reproduced verbatim — it is the concrete proof of FR-024 (DRY) and the byte-equivalence proxy for SC-004 / SC-007.

#### 9.2.1 Source files

`docs/axon/examples/medium/researchable.ax`:

```axon
interface Researchable {
  @public skill research(topic)
}
```

`docs/axon/examples/medium/research.ax`:

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

`docs/axon/examples/medium/research_company.ax`:

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

`docs/axon/examples/medium/main.axm`:

```axon
@main
skill main {
  - call ResearchCompany.research(topic: "Apple Inc")
}
```

#### 9.2.2 Compiled bundle (byte-faithful reproduction)

The compiler emits the following nine files from the four source files above. The reproduction here is byte-faithful — these are exactly the contents of `docs/axon/examples-compiled/medium/`. Two reviewers independently hand-compiling the bundle from §7 alone MUST arrive at these same bytes (SC-004 proxy).

`_manifest.axc`:

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

`_fields/Research.fields`:

```
CLASS: Research
@protected sources
@protected report
@private is_validated = false
```

`_fields/ResearchCompany.fields`:

```
CLASS: ResearchCompany
@private preferred_database = "SEC EDGAR"
```

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
  - _skills/Research.write_report.skill
BODY:
  - call this.gather_sources(topic)
  - call this.validate_sources
  - call this.write_report
```

`_skills/Research.write_report.skill`:

```
CLASS: Research
SKILL: write_report
VISIBILITY: @protected
OVERRIDE_MODE: virtual
PARAMS: none
INHERITED FIELDS FROM: none
OWN FIELDS: _fields/Research.fields
DEPENDS ON:
BODY:
  - draft a structured report summarizing the validated sources in this.sources
  - store the draft in this.report
```

`_skills/ResearchCompany.gather_sources.skill`:

```
CLASS: ResearchCompany
SKILL: gather_sources
VISIBILITY: @protected
OVERRIDE_MODE: implements abstract from Research
PARAMS: topic
INHERITED FIELDS FROM: _fields/Research.fields
OWN FIELDS: _fields/ResearchCompany.fields
DEPENDS ON:
BODY:
  - search financial databases (starting with this.preferred_database) for filings related to topic
  - store all results in this.sources
```

`_skills/ResearchCompany.validate_sources.skill`:

```
CLASS: ResearchCompany
SKILL: validate_sources
VISIBILITY: @protected
OVERRIDE_MODE: implements abstract from Research
PARAMS: none
INHERITED FIELDS FROM: _fields/Research.fields
OWN FIELDS: _fields/ResearchCompany.fields
DEPENDS ON:
BODY:
  - check that every source in this.sources is from a primary or reputable financial outlet
  - set this.is_validated to true once all sources pass the check
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

`main.axc`:

```
ENTRY: main
DEPENDS ON:
  - _skills/Research.research.skill
BODY:
  - call ResearchCompany.research(topic: "Apple Inc")
```

#### 9.2.3 DRY callout

The bundle above is the concrete demonstration of FR-024. Observe:

- **`ResearchCompany.research` has no `.skill` file of its own.** The body of `research` lives only in `_skills/Research.research.skill`. The manifest's `ResearchCompany` class entry records `research` with the tag `[@public, inherited from Research]`. At runtime, when `ResearchCompany.research(topic: "Apple Inc")` is invoked, the runtime consults the manifest, sees the inheritance pointer, and executes `_skills/Research.research.skill` directly. No body content was duplicated into a `ResearchCompany.research.skill` file.
- **Abstract skills emit no `.skill` file.** `Research.gather_sources` and `Research.validate_sources` are declared `abstract`; they appear only in the manifest's `Research` skill list with the tag `[@protected, abstract]`. The concrete bodies live in `_skills/ResearchCompany.gather_sources.skill` and `_skills/ResearchCompany.validate_sources.skill`.
- **Field blocks are stored once.** `Research`'s fields appear only in `_fields/Research.fields`. Every dependent skill file references the same path via `INHERITED FIELDS FROM:` (for `ResearchCompany` skills) or `OWN FIELDS:` (for `Research` skills). The field declarations themselves are not re-emitted in `_fields/ResearchCompany.fields`.

These three observations together are what SC-007 names the "DRY guarantee made concrete." A reviewer who can confirm them by direct inspection of the bundle has confirmed FR-024 holds for this example.

### 9.3 Complex example — multi-class orchestration with threading

The complex example exercises threading (`parallel`, `pipe`), implicit project-wide composition, and cross-class `@public` field reads (DottedReferences in argument-value position). Six source files form a small orchestrator-style application: a research workflow that, after producing a report, fans out to a PDF exporter and an email sender in parallel, then runs a question-generation pipeline.

This example demonstrates the constructs in active use; the spec does not reproduce the complex example's full compiled bundle (the medium example serves that purpose). The narrative below describes how the runtime executes the compiled bundle.

#### 9.3.1 Source files

`docs/axon/examples/complex/research.ax`:

```axon
abstract class Research {

  fields {
    @protected sources
    @public report
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

(Note: `report` is `@public` in the complex example so that other classes can read it via `ResearchCompany.report` — see §3.9. In the medium example, `report` was `@protected`.)

`docs/axon/examples/complex/research_company.ax`:

```axon
class ResearchCompany extends Research {

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

`docs/axon/examples/complex/question_generator.ax`:

```axon
class QuestionGenerator {

  @public
  skill generate_questions(topic, amount = 10) {
    - generate `amount` thoughtful questions about `topic`
    - emit each question as it is generated
  }
}
```

`docs/axon/examples/complex/file_exporter.ax`:

```axon
class FileExporter {

  @public
  skill export_to_pdf(content, filename) {
    - render `content` as a well-formatted PDF
    - save the PDF as `filename`
  }
}
```

`docs/axon/examples/complex/email_sender.ax`:

```axon
class EmailSender {

  @public
  skill send(recipient, subject, body) {
    - compose an email to `recipient` with subject `subject` and the given `body`
    - send the email
  }
}
```

`docs/axon/examples/complex/main.axm`:

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

#### 9.3.2 Execution narrative

When Claude is handed the compiled bundle and asked to execute `main.axc`, the runtime proceeds as follows:

1. **Read the manifest.** The manifest enumerates five classes — `EmailSender [concrete]`, `FileExporter [concrete]`, `QuestionGenerator [concrete]`, `Research [abstract]`, `ResearchCompany [concrete]` — and zero interfaces (the complex example does not declare any). The entry point is `main.axc`. Note that no `uses` / `import` declaration appeared in any source file; the compiler discovered every class by scanning the source directory (SR-20).

2. **Execute the sequential call.** `main.axc`'s first BODY entry is `- call ResearchCompany.research(topic: "Apple Inc")`. The runtime looks up `ResearchCompany.research` in the manifest, sees that the skill is `inherited from Research`, and follows the pointer to `_skills/Research.research.skill`. The body of `research` calls three skills in sequence — `this.gather_sources(topic)`, `this.validate_sources`, `this.write_report`. Because the runtime is executing `ResearchCompany.research`, `this.*` resolves against the manifest's `ResearchCompany` entry: `gather_sources` and `validate_sources` resolve to their concrete `_skills/ResearchCompany.*.skill` files; `write_report` resolves to `_skills/ResearchCompany.write_report.skill`, which itself begins with `- call base.write_report` (running `_skills/Research.write_report.skill` first, then augmenting the report). At the end of this step, `ResearchCompany.report` holds a populated report value (per SR-2 and SR-13).

3. **Execute the `parallel { }` block.** The second BODY entry is a `- parallel:` marker with two indented call entries. The runtime MUST launch both calls as independent fire-and-forget agents (SR-16):
   - **Branch A** invokes `FileExporter.export_to_pdf(content: ResearchCompany.report, filename: "apple.pdf")`. The argument value `ResearchCompany.report` is a `DottedReference` (§3.9, SR-6): the runtime reads the `@public` field `report` from `ResearchCompany`'s state and supplies it as `content`. The skill renders the PDF and saves it.
   - **Branch B** invokes `EmailSender.send(recipient: "team@co.com", subject: "Apple research complete", body: ResearchCompany.report)`. Again the `body` value is read from the public field. The skill composes and sends the email.

   Neither branch observes the other's intermediate state. The block returns once both have completed; the order of completion is not guaranteed.

4. **Execute the `pipe(strategy: per_item) { }` block.** The third BODY entry is a `- pipe (strategy: per_item):` marker with two indented call entries. The runtime launches the producer `QuestionGenerator.generate_questions(topic: "Apple Inc", amount: 5)` and streams each emitted question to the consumer `EmailSender.send(...)`. The consumer runs once per question (SR-17). When the producer finishes emitting all five questions and all five consumer invocations complete, the block returns.

5. **Done.** With the BODY list exhausted, `main.axc` completes and Claude reports final status to the user.

This narrative illustrates how the compiler's responsibilities (structural correctness, resolution, DRY) and the runtime's responsibilities (free-speech interpretation, threading semantics) divide cleanly across the language design.

---

## §10. Open questions and future extensions

The items below are explicitly **deferred** from Axon v1. They are recorded here (per FR-041) so that future revisions know where the unfinished design surface lies and so that users of v1 do not write code that depends on undefined behavior in these areas.

### 10.1 Skill overloading

**Status**: not in v1.

Allowing multiple skills with the same name and different parameter signatures within a single class. Deferred because Axon's untyped, free-speech parameter model makes signature-based dispatch ambiguous without further design — there is no clean way for the LLM runtime to choose between `skill greet(name)` and `skill greet(name, title)` when the call site passes `greet(name: "Yair")` and either declared overload could plausibly accept the call.

A future revision could introduce overloading by requiring that overloads differ in the number of *required* (non-defaulted) parameters, with the LLM dispatching by arity. This design has not been finalized.

### 10.2 Cross-class field writes

**Status**: not in v1.

Writing `OtherClass.field = value` from outside the owning class is not permitted. State is mutated only by skills of the owning class (per the spec.md Assumptions). A future version may introduce a `@settable` field marker, a public-setter convention, or an explicit `mutates` declaration on skills.

### 10.3 Field-level default expressions

**Status**: not in v1.

Defaults that reference other fields, other classes' values, or skill calls. v1 restricts defaults to simple constant values (quoted strings, numbers, booleans, unquoted words) per SR-5. A future version may introduce a restricted expression grammar for defaults, but the design must answer: when is the default evaluated? At bundle-load time? At first reference? With what argument context?

### 10.4 Generic / parameterized classes

**Status**: not in v1.

`class Cache<T> { ... }` and the resulting type-parameter machinery. Out of scope for v1. The free-speech, untyped nature of Axon parameters means generics would have to be either purely documentary (the type parameter is just a name passed to the LLM) or backed by a real type system (which conflicts with FR-008).

### 10.5 A `uses` / `import` declaration

**Status**: deliberately omitted from v1.

Composition is implicit and resolved project-wide (research R8, FR-010). A `uses` clause was rejected to keep the surface minimal and to match the brief's examples, none of which declare imports. May be revisited if large projects suffer from name collisions or if the implicit resolution rule starts producing surprising behavior in deeply nested project layouts.

### 10.6 Multi-file `@main`

**Status**: not in v1.

Currently one `.axm` per project. A future version could allow multiple entry points selected by a CLI argument at compile time. The bundle format would need to extend `_manifest.axc` to enumerate the available entry points.

### 10.7 Runtime error taxonomy

**Status**: not in v1.

v1 leaves runtime errors to be surfaced by the LLM in plain natural language (§8.9). A future version may define structured runtime error categories (`ResolutionFailure`, `ParameterTypeMismatch`, `InfiniteRecursion`, etc.) and require the runtime to tag each failure with a category. This is not done in v1 because the LLM's natural-language error reports are already legible, and over-structuring them risks losing diagnostic detail.

### 10.8 Standard library

**Status**: not in v1.

There is no built-in library of classes (e.g., `FileExporter`, `EmailSender` are user-defined in the §9 examples, not language-provided). A future version may ship a small standard library covering common LLM agent tasks: file I/O, web fetch, email send, structured data extraction. The library's interface would need to be defined in Axon and shipped with every compiler distribution.

### 10.9 Nested threading blocks

**Status**: not in v1.

A `parallel { }` containing a nested `pipe(strategy: ...) { }`, or vice versa. The v1 grammar (§2) admits a `ThreadingBlock` only at the top level of a `SkillBody`, not inside another `ThreadingBlock`. A future version may relax this once the semantics of nested concurrency under the LLM runtime are explored. Today, the structural form `parallel:` and `pipe (strategy: ...):` in the bundle BODY only allows `- call ...` entries, not further block markers.
