# Axon spec.md — Fix Prompt

Apply the following changes to `docs/axon/spec.md`. Each change is described precisely with the section to find, what to change, and what to replace it with.

---

## Core philosophy change

The Axon compiler is NOT classical code written in a programming language. The Axon compiler is itself an Axon skill executed by Claude. This is a fundamental architectural decision that must be reflected throughout the spec. The two-stage pipeline is:

**Stage 1** — Claude reads the `AxonCompiler.compile` skill, which instructs it to read `.ax` and `.axm` source files, validate them against the Axon rules, and emit the compiled bundle directory.

**Stage 2** — Claude reads the `AxonRuntime.execute` skill, which instructs it to read `_manifest.axc`, understand the class graph, and execute the skills.

There is no lexer, no parser, no resolver, no validator, no emitter written in Python, TypeScript, C#, or any other programming language. Claude IS the compiler and the runtime. The spec must reflect this throughout.

---

## Change 1 — Section 1 introduction (compiler description)

**Find**: Every sentence that says "The compiler is classical code" or "implementable in roughly 2,000–5,000 lines of classical code" or "the compiler is classical" or "a competent engineer needs to build a working compiler."

**Replace with**: The Axon compiler is an Axon skill executed by Claude. There is no classical code to write. Claude reads the compiler skill, which instructs it precisely how to parse Axon source files, validate them, and emit a bundle. This document is the contract that the compiler skill and the runtime skill follow.

---

## Change 2 — Section 1.2 philosophy point 2

**Find**: The paragraph that begins "Semantics are LLM-driven; the compiler is classical." which describes the division of labor and mentions "2,000–5,000 lines of classical code."

**Replace with**:

> **2. Both the compiler and the runtime are Claude.** There is no classical compiler. The Axon compiler is an Axon skill that instructs Claude how to read `.ax` and `.axm` source files, validate structural rules (inheritance contracts, visibility, interface contracts, override modes), and emit the compiled bundle. The Axon runtime is a separate Axon skill that instructs Claude how to read a compiled bundle and execute its skills. Each instruction bullet inside a skill body remains opaque to both stages — the compiler validates structure and references, the runtime supplies meaning and executes behavior.

---

## Change 3 — Section 2 (formal grammar) introduction

**Find**: Any paragraph that describes the grammar as input to a classical lexer or parser, or says the grammar is for "a competent engineer to write a parser."

**Replace with**: The formal grammar below is the structural reference that the Axon compiler skill follows when reading source files. Claude uses this grammar to understand what constitutes a valid Axon program. It is expressed in EBNF for precision and human readability, not as input to a classical parser generator.

---

## Change 4 — Section 3.4 (Literal values)

**Find**: The section that says:
> "Axon supports exactly three literal kinds (research R5): **string**, **integer**, **boolean**. Other forms (floats, lists, null, objects) are not supported in v1."

**Replace with**:

> Axon does not enforce types on field defaults or argument values. Parameters and fields are untyped — the LLM infers meaning from context. A value like `Apple Inc`, `10`, `false`, or `critical thinking style` is valid in any position. The LLM compiler understands intent without requiring the developer to annotate types.
>
> For structured `call` expressions where the compiler needs to parse argument boundaries, the comma between arguments and the closing parenthesis serve as delimiters. Multi-word values in named arguments are delimited by the comma of the next argument or the closing parenthesis — quotes are not required:
>
> ```axon
> - call generate_questions(topic: Apple Inc, amount: 10, style: critical thinking)
> ```
>
> Quoted strings are also accepted for developers who prefer them:
>
> ```axon
> - call generate_questions(topic: "Apple Inc", amount: 10, style: "critical thinking")
> ```
>
> Both forms are valid and equivalent. The LLM compiler understands both.

---

## Change 5 — Section 3.5 (call syntax / argument syntax)

**Find**: The paragraph that says "Arguments at call sites are named (research R4, FR-008). The form is always `parameter_name: value`... Mixing positional with named arguments is not permitted in v1."

And find the example:
```
- call Greeter.greet(name: "Yair")
```

**Replace the argument paragraph with**:

> Arguments at call sites may be **named** or **positional** — the developer chooses whichever is more natural. Named and positional forms may not be mixed in the same call.
>
> **Named arguments** — provide the parameter name followed by a colon and the value. May be provided in any order. Defaulted parameters may be omitted:
> ```axon
> - call generate_questions(topic: Apple Inc, style: critical thinking)
> - call Greeter.greet(name: Yair)
> ```
>
> **Positional arguments** — provide values in parameter declaration order. Defaulted parameters at the end may be omitted:
> ```axon
> - call generate_questions(Apple Inc)
> - call Greeter.greet(Yair)
> ```
>
> **Multi-word values** do not require quotes. The comma between arguments and the closing parenthesis act as natural delimiters. Quoted strings are accepted for developers who prefer them but are never required.
>
> **Zero-argument calls** omit parentheses:
> ```axon
> - call Greeter.recall
> - call this.validate_sources
> ```

---

## Change 6 — SR-4 (Named-argument-only binding)

**Find**: The semantic rule SR-4 titled "Named-argument-only binding at call sites" which states positional arguments are violations and shows `- call Greeter.greet("Yair")` as a violation.

**Replace SR-4 with**:

> #### SR-4 — Argument binding at call sites
>
> **Rule**. Arguments at a call site MUST be either all named or all positional. Mixing named and positional in a single call is not permitted. Named arguments match by parameter name in any order; positional arguments match by parameter declaration order. The compiler verifies that every required parameter (one without a default) is supplied. The LLM resolves semantic compatibility at runtime.
>
> ```axon
> // named — any order, defaulted params may be omitted
> - call generate_questions(topic: Apple Inc, style: critical thinking)
>
> // positional — declaration order, trailing defaults may be omitted
> - call generate_questions(Apple Inc)
>
> // VIOLATION: mixing named and positional in one call
> - call generate_questions(Apple Inc, style: critical thinking)
> ```
>
> **Compiler behavior**: accept named-only or positional-only calls; reject mixed calls. Verify required parameters are supplied. Cites FR-008.

---

## Change 7 — SR-5 (Literal-only defaults)

**Find**: SR-5 titled "Literal-only defaults" which says defaults must be string, integer, or boolean literals and rejects field references.

**Replace SR-5 with**:

> #### SR-5 — Default values
>
> **Rule**. A field's default value or a parameter's default value MUST be a simple value that the LLM compiler can recognize as a constant — a quoted string, a number, a boolean (`true`/`false`), or an unquoted word. Field references, skill calls, and compound expressions as defaults are not permitted in v1.
>
> ```axon
> // valid defaults
> @private is_validated = false
> @private max_sources = 50
> @private label = research
> @private greeting = "hello world"
>
> // VIOLATION: default is a field reference
> @public start = this.compute_start()
> ```
>
> **Compiler behavior**: accept simple value defaults; reject references and expressions.

---

## Change 8 — Section 5 (Compiler architecture) — complete rewrite

**Find**: The entire Section 5 "Compiler architecture" which describes five classical phases: Lexer, Parser, Resolver, Validator, Emitter with their inputs and outputs as classical code.

**Replace the entire section with**:

> ## 5. Compiler architecture
>
> The Axon compiler is not classical code. It is an Axon skill — a precise set of instructions that Claude follows to transform `.ax` and `.axm` source files into a compiled bundle. The runtime is a second Axon skill that Claude follows to execute the bundle.
>
> ### 5.1 Stage 1 — The compiler skill
>
> The compiler skill instructs Claude to:
>
> 1. **Discover sources** — read all `.ax` files and at most one `.axm` file from the source directory
> 2. **Parse structure** — for each file, identify the class, abstract class, or interface declaration; its fields block; its skills with visibility and override mode; its parameter lists; and its instruction bullets. Instruction bullets are treated as opaque text and are not interpreted.
> 3. **Resolve references** — build the class graph; walk inheritance chains; for every `call` instruction, verify the referenced class and skill exist and are accessible from the call site
> 4. **Validate rules** — enforce all structural rules: abstract skills implemented, interface contracts satisfied, visibility respected, sealed skills not overridden, no cyclical inheritance, no duplicate class names, at most one `@main`
> 5. **Report errors** — if any validation fails, report all errors (never just the first) with file, line, and suggested fix; do not emit a partial bundle
> 6. **Emit bundle** — if validation passes, write the compiled bundle directory following the format specified in §7 exactly, honoring all DRY guarantees
>
> ### 5.2 Stage 2 — The runtime skill
>
> The runtime skill instructs Claude to:
>
> 1. **Read the manifest** — load `_manifest.axc` first to understand the class graph, inheritance chains, interface implementations, and skill locations
> 2. **Resolve the entry point** — if `main.axc` is present, begin execution there; otherwise treat the bundle as a callable library awaiting user instruction
> 3. **Execute skills** — for each skill call, locate the skill file via the manifest, load its fields context, and execute its instruction bullets in order
> 4. **Honor threading** — execute `parallel {}` blocks as concurrent agents with no shared intermediate state; execute `pipe(strategy: per_item)` blocks in streaming mode; execute `pipe(strategy: on_complete)` blocks in batch mode
> 5. **Resolve references at runtime** — `this.*` resolves against the executing class's manifest entry; `base.*` walks the ancestor chain via the manifest
> 6. **Surface errors** — if an instruction is ambiguous or unexecutable, report the issue in plain language identifying the failing skill and the problem
>
> ### 5.3 Toolchain
>
> ```
> .ax source files + optional .axm
>         ↓
> Claude reads AxonCompiler.compile skill
>         ↓
> validates structure and references
>         ↓ (errors block emission)
> emits compiled bundle directory
>         ↓
> Claude reads AxonRuntime.execute skill
>         ↓
> reads _manifest.axc → executes skills
> ```
>
> No classical programming language is required. Claude is both the compiler and the runtime.

---

## Change 9 — Section 10.2 (Positional arguments — open questions)

**Find**: Section 10.2 titled "Positional arguments at call sites" which lists positional arguments as a deferred v2 feature.

**Delete this section entirely.** Positional arguments are now a v1 feature (implemented in Change 5 and Change 6 above).

---

## Change 10 — Research decisions summary

**Find**: Any table or summary that lists:
- R4: "Named-only in v1; positional deferred"
- R5: "string, integer, boolean (no float/null/list/object in v1)"

**Replace**:
- R4: "Named or positional in v1; no mixing in the same call"
- R5: "Simple constant values (quoted strings, numbers, booleans, unquoted words); no expressions or references"

---

## Change 11 — Grammar section (ArgList production)

**Find**: The grammar production:
```
ArgList         = NamedArg { "," NamedArg } ;
NamedArg        = Identifier ":" ArgumentValue ;
```

**Replace with**:
```
ArgList         = NamedArgList | PositionalArgList ;
NamedArgList    = NamedArg { "," NamedArg } ;
PositionalArgList = ArgumentValue { "," ArgumentValue } ;
NamedArg        = Identifier ":" ArgumentValue ;
ArgumentValue   = Value | DottedReference ;
Value           = QuotedString | UnquotedValue ;
QuotedString    = '"' { any character except unescaped '"' } '"' ;
UnquotedValue   = ? any sequence of characters up to the next "," or ")" ? ;
```

Note: `UnquotedValue` is an LLM-interpreted rule — the compiler reads up to the next delimiter. This is why the LLM compiler is better suited than a classical parser: it handles the ambiguity of natural-language values by understanding intent rather than requiring strict tokenization.

---

## Change 12 — Remove all references to implementation language

**Find and remove or replace**: Every instance of the following phrases:
- "implementation language is not prescribed"
- "Any language whose toolchain can read a source directory"
- "approximately 2,000–5,000 lines of code"
- "a competent engineer can build a working Axon compiler"

**Replace each with language that reflects**: The compiler is an Axon skill executed by Claude. No classical implementation language is needed.

---

## Consistency check after all changes

After applying the above changes, verify:

1. Section 1 no longer says "classical code compiler"
2. Section 2 describes the grammar as a reference for the LLM compiler, not a machine grammar
3. Section 3.4 removes type enforcement and explains free-speech values
4. Section 3.5 shows both named and positional argument examples
5. SR-4 allows both named and positional, forbids mixing
6. SR-5 allows simple constant defaults, forbids expressions
7. Section 5 describes two Axon skills (compiler + runtime) with no classical code
8. Section 10.2 (positional deferred) is deleted
9. The toolchain diagram shows Claude as both compiler and runtime
10. No remaining references to lexer, parser, resolver, validator, or emitter as classical code phases to be implemented
