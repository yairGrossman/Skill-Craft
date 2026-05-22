import * as vscode from 'vscode';

// ── Data model ────────────────────────────────────────────────────────────────

type Visibility = 'public' | 'protected' | 'private';
type OverrideMode = 'abstract' | 'virtual' | 'sealed' | 'default';

interface FieldDef {
    name: string;
    visibility: Visibility;
    defaultValue?: string;
}

interface SkillDef {
    name: string;
    visibility: Visibility;
    overrideMode: OverrideMode;
    params: string[];
}

interface ClassDef {
    name: string;
    isAbstract: boolean;
    isInterface: boolean;
    parent?: string;
    interfaces: string[];
    fields: FieldDef[];
    skills: SkillDef[];
}

// ── Workspace model ───────────────────────────────────────────────────────────

class AxonWorkspaceModel {
    private defs: Map<string, ClassDef> = new Map();

    async refresh(): Promise<void> {
        this.defs.clear();
        const files = await vscode.workspace.findFiles('**/*.ax', '**/node_modules/**');
        for (const file of files) {
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                this.parseContent(doc.getText());
            } catch {
                // skip unreadable files
            }
        }
    }

    parseContent(text: string): void {
        const lines = text.split('\n');
        let currentClass: ClassDef | null = null;
        let pendingVisibility: Visibility = 'public';
        let pendingOverride: OverrideMode = 'default';
        let inFieldsBlock = false;
        let fieldsDepth = 0;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('//')) continue;

            const opens = (rawLine.match(/\{/g) ?? []).length;
            const closes = (rawLine.match(/\}/g) ?? []).length;

            // Class / abstract class
            const classMatch = line.match(
                /^(?:(abstract)\s+)?class\s+([A-Za-z]\w*)(?:\s+extends\s+([A-Za-z]\w*))?(?:\s+implements\s+([^{]+))?/
            );
            if (classMatch) {
                currentClass = {
                    name: classMatch[2],
                    isAbstract: !!classMatch[1],
                    isInterface: false,
                    parent: classMatch[3],
                    interfaces: classMatch[4]
                        ? classMatch[4].split(',').map(s => s.trim()).filter(Boolean)
                        : [],
                    fields: [],
                    skills: [],
                };
                this.defs.set(currentClass.name, currentClass);
                inFieldsBlock = false;
                pendingVisibility = 'public';
                pendingOverride = 'default';
                continue;
            }

            // Interface
            const ifaceMatch = line.match(/^interface\s+([A-Za-z]\w*)/);
            if (ifaceMatch) {
                currentClass = {
                    name: ifaceMatch[1],
                    isAbstract: false,
                    isInterface: true,
                    interfaces: [],
                    fields: [],
                    skills: [],
                };
                this.defs.set(currentClass.name, currentClass);
                inFieldsBlock = false;
                pendingVisibility = 'public';
                pendingOverride = 'default';
                continue;
            }

            if (!currentClass) continue;

            // Fields block start
            if (/^fields\s*\{/.test(line)) {
                inFieldsBlock = true;
                fieldsDepth = 1;
                continue;
            }

            if (inFieldsBlock) {
                fieldsDepth += opens - closes;
                if (fieldsDepth <= 0) {
                    inFieldsBlock = false;
                    continue;
                }
                const fieldMatch = line.match(/^@(public|protected|private)\s+([A-Za-z]\w*)(?:\s*=\s*(.+))?/);
                if (fieldMatch) {
                    currentClass.fields.push({
                        name: fieldMatch[2],
                        visibility: fieldMatch[1] as Visibility,
                        defaultValue: fieldMatch[3]?.trim(),
                    });
                }
                continue;
            }

            // Visibility decorator on its own line
            const visMatch = line.match(/^@(public|protected|private)\b/);
            if (visMatch) {
                pendingVisibility = visMatch[1] as Visibility;
            }

            // Override mode on its own line (not "abstract class")
            const overrideLineMatch = line.match(/^(abstract|virtual|sealed)\b(?!\s+class)/);
            if (overrideLineMatch) {
                pendingOverride = overrideLineMatch[1] as OverrideMode;
            }

            // Skill declaration: handles @vis on same line or on prior line, override on same or prior line
            // Patterns: "skill name", "abstract skill name", "@public skill name", "@public abstract skill name"
            const skillMatch = line.match(
                /^(?:@(?:public|protected|private)\s+)?(?:(abstract|virtual|sealed)\s+)?skill\s+([A-Za-z]\w*)(?:\(([^)]*)\))?/
            );
            if (skillMatch) {
                const inlineVis = line.match(/^@(public|protected|private)/);
                const visibility: Visibility = inlineVis ? (inlineVis[1] as Visibility) : pendingVisibility;
                const overrideMode: OverrideMode = (skillMatch[1] as OverrideMode) ?? pendingOverride;
                const params = skillMatch[3]
                    ? skillMatch[3].split(',').map(p => p.trim().split('=')[0].trim()).filter(Boolean)
                    : [];
                currentClass.skills.push({ name: skillMatch[2], visibility, overrideMode, params });
                pendingVisibility = 'public';
                pendingOverride = 'default';
            }
        }
    }

    get(name: string): ClassDef | undefined {
        return this.defs.get(name);
    }

    allClassNames(): string[] {
        return [...this.defs.values()].filter(d => !d.isInterface).map(d => d.name);
    }

    allInterfaceNames(): string[] {
        return [...this.defs.values()].filter(d => d.isInterface).map(d => d.name);
    }
}

// ── Keyword hover docs ────────────────────────────────────────────────────────

const HOVER_DOCS: Record<string, string> = {
    '@public':      'Accessible from **any** class or file in the project.',
    '@protected':   'Accessible from this class and its **descendants** only.',
    '@private':     'Accessible from **this class only**.',
    '@main':        'Entry-point decorator. Only valid in `.axm` files — at most one per project.',
    'skill':        'A named unit of LLM instruction. Its body is a list of `- bullet` instructions.',
    'fields':       'Class-scoped shared memory block. Every skill in the class reads and writes the same fields.',
    'abstract':     '**Override mode**: no body — concrete subclasses **must** implement this skill.',
    'virtual':      '**Override mode**: has a body; child classes *may* override it.',
    'sealed':       '**Override mode**: has a body; child classes *cannot* override it.',
    'parallel':     'Runs branches as **concurrent fire-and-forget agents** with no shared state between branches.',
    'pipe':         'Producer/consumer chain. Requires `strategy: per_item` or `strategy: on_complete`.',
    'this':         'Reference to the **current class**. Use `this.field` or `call this.skill()`.',
    'base':         'Reference to the **parent class**. Use `call base.skill()` to invoke the parent implementation.',
    'extends':      '**Single inheritance**: this class inherits all skills and fields from the named parent.',
    'implements':   'Declares that this class satisfies an **interface** contract.',
    'per_item':     'Pipe strategy: consumer runs **for each item** as the producer emits it (streaming).',
    'on_complete':  'Pipe strategy: consumer runs **once** after the producer finishes all items (batch).',
    'class':        'A **static namespace** of behavior — no instances, no constructors. Think named agent persona.',
    'interface':    'Declares a **contract**: a set of required public skill signatures.',
    'strategy':     'Pipe scheduling mode. Values: `per_item` (stream each item) or `on_complete` (batch).',
};

// ── Hover provider ────────────────────────────────────────────────────────────

class AxonHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Hover | undefined {
        const wordRange = document.getWordRangeAtPosition(position, /@?\w+/);
        if (!wordRange) return undefined;
        const word = document.getText(wordRange);
        const doc = HOVER_DOCS[word];
        if (!doc) return undefined;
        return new vscode.Hover(
            new vscode.MarkdownString(`**Axon** \`${word}\`\n\n${doc}`),
            wordRange,
        );
    }
}

// ── Completion provider ───────────────────────────────────────────────────────

class AxonCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private model: AxonWorkspaceModel) {}

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] {
        const prefix = document.lineAt(position.line).text.substring(0, position.character);

        // "- call this." → own class members (all visibility)
        if (/call\s+this\.\s*$/.test(prefix)) {
            const cls = this.currentClassFromDoc(document, position.line);
            if (cls) return this.membersOf(cls);
        }

        // "- call base." → parent class non-private members
        if (/call\s+base\.\s*$/.test(prefix)) {
            const cls = this.currentClassFromDoc(document, position.line);
            const parentName = cls?.parent;
            const parent = parentName ? this.liveModel(document).get(parentName) ?? this.model.get(parentName) : undefined;
            if (parent) return this.membersOf(parent, /*excludePrivate*/ true);
        }

        // "- call ClassName." → that class's public skills
        const crossMatch = prefix.match(/call\s+([A-Za-z]\w*)\.\s*$/);
        if (crossMatch) {
            const cls = this.liveModel(document).get(crossMatch[1]) ?? this.model.get(crossMatch[1]);
            if (cls) return this.publicSkillsOf(cls);
        }

        // "- call " → all class names
        if (/\bcall\s+$/.test(prefix)) {
            return this.classNameItems(document);
        }

        // "extends " → all class/abstract class names
        if (/\bextends\s+$/.test(prefix)) {
            return this.classNameItems(document);
        }

        // "implements " or "implements A, " → all interface names
        if (/\bimplements\s+[\w,\s]*$/.test(prefix)) {
            return this.interfaceNameItems(document);
        }

        // "strategy: " → per_item / on_complete
        if (/strategy:\s*$/.test(prefix)) {
            return this.pipeStrategyItems();
        }

        // Default: language keywords + decorators
        return this.keywordItems();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Parse the current document text into a temporary model (always fresh). */
    private liveModel(document: vscode.TextDocument): AxonWorkspaceModel {
        const m = new AxonWorkspaceModel();
        m.parseContent(document.getText());
        return m;
    }

    /** Find the ClassDef that contains the given line, parsing the live document. */
    private currentClassFromDoc(document: vscode.TextDocument, lineNum: number): ClassDef | undefined {
        const live = this.liveModel(document);
        for (let i = lineNum; i >= 0; i--) {
            const l = document.lineAt(i).text.trim();
            const m = l.match(/^(?:abstract\s+)?class\s+([A-Za-z]\w*)/);
            if (m) return live.get(m[1]) ?? this.model.get(m[1]);
        }
        return undefined;
    }

    /** Merge class names from live document + saved workspace model. */
    private mergedClassNames(document: vscode.TextDocument): string[] {
        const live = this.liveModel(document);
        const names = new Set([...live.allClassNames(), ...this.model.allClassNames()]);
        return [...names];
    }

    private mergedInterfaceNames(document: vscode.TextDocument): string[] {
        const live = this.liveModel(document);
        const names = new Set([...live.allInterfaceNames(), ...this.model.allInterfaceNames()]);
        return [...names];
    }

    private membersOf(cls: ClassDef, excludePrivate = false): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        for (const s of cls.skills) {
            if (excludePrivate && s.visibility === 'private') continue;
            const item = new vscode.CompletionItem(s.name, vscode.CompletionItemKind.Method);
            item.detail = `skill · ${s.visibility}${s.overrideMode !== 'default' ? ` · ${s.overrideMode}` : ''}`;
            item.documentation = new vscode.MarkdownString(
                `**${s.visibility}** skill \`${s.name}\`` +
                (s.params.length ? `\n\nParams: \`${s.params.join(', ')}\`` : '')
            );
            item.insertText = s.params.length
                ? new vscode.SnippetString(
                    `${s.name}(${s.params.map((p, i) => `${p}: \${${i + 1}}`).join(', ')})`
                )
                : s.name;
            items.push(item);
        }

        for (const f of cls.fields) {
            if (excludePrivate && f.visibility === 'private') continue;
            const item = new vscode.CompletionItem(f.name, vscode.CompletionItemKind.Field);
            item.detail = `field · ${f.visibility}`;
            item.documentation = new vscode.MarkdownString(
                `**${f.visibility}** field \`${f.name}\`` +
                (f.defaultValue !== undefined ? `\n\nDefault: \`${f.defaultValue}\`` : '')
            );
            items.push(item);
        }

        return items;
    }

    private publicSkillsOf(cls: ClassDef): vscode.CompletionItem[] {
        return cls.skills
            .filter(s => s.visibility === 'public')
            .map(s => {
                const item = new vscode.CompletionItem(s.name, vscode.CompletionItemKind.Method);
                item.detail = `@public skill${s.params.length ? ` (${s.params.join(', ')})` : ''}`;
                item.insertText = s.params.length
                    ? new vscode.SnippetString(
                        `${s.name}(${s.params.map((p, i) => `${p}: \${${i + 1}}`).join(', ')})`
                    )
                    : s.name;
                return item;
            });
    }

    private classNameItems(document: vscode.TextDocument): vscode.CompletionItem[] {
        return this.mergedClassNames(document).map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
            item.detail = 'Axon class';
            return item;
        });
    }

    private interfaceNameItems(document: vscode.TextDocument): vscode.CompletionItem[] {
        return this.mergedInterfaceNames(document).map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Interface);
            item.detail = 'Axon interface';
            return item;
        });
    }

    private pipeStrategyItems(): vscode.CompletionItem[] {
        const perItem = new vscode.CompletionItem('per_item', vscode.CompletionItemKind.EnumMember);
        perItem.detail = 'Stream items as produced';
        perItem.documentation = new vscode.MarkdownString(
            'Consumer runs **for each item** emitted by the producer (streaming mode).'
        );

        const onComplete = new vscode.CompletionItem('on_complete', vscode.CompletionItemKind.EnumMember);
        onComplete.detail = 'Wait for full batch';
        onComplete.documentation = new vscode.MarkdownString(
            'Consumer runs **once** after the producer has finished all items (batch mode).'
        );

        return [perItem, onComplete];
    }

    private keywordItems(): vscode.CompletionItem[] {
        const kws: Array<[string, vscode.CompletionItemKind]> = [
            ['@public',    vscode.CompletionItemKind.Keyword],
            ['@protected', vscode.CompletionItemKind.Keyword],
            ['@private',   vscode.CompletionItemKind.Keyword],
            ['@main',      vscode.CompletionItemKind.Keyword],
            ['abstract',   vscode.CompletionItemKind.Keyword],
            ['virtual',    vscode.CompletionItemKind.Keyword],
            ['sealed',     vscode.CompletionItemKind.Keyword],
            ['parallel',   vscode.CompletionItemKind.Keyword],
            ['pipe',       vscode.CompletionItemKind.Keyword],
            ['fields',     vscode.CompletionItemKind.Keyword],
            ['skill',      vscode.CompletionItemKind.Keyword],
            ['extends',    vscode.CompletionItemKind.Keyword],
            ['implements', vscode.CompletionItemKind.Keyword],
            ['class',      vscode.CompletionItemKind.Keyword],
            ['interface',  vscode.CompletionItemKind.Keyword],
            ['strategy',   vscode.CompletionItemKind.Keyword],
        ];
        return kws.map(([kw, kind]) => {
            const item = new vscode.CompletionItem(kw, kind);
            const doc = HOVER_DOCS[kw];
            if (doc) {
                item.documentation = new vscode.MarkdownString(doc);
            }
            return item;
        });
    }
}

// ── Activation ────────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const model = new AxonWorkspaceModel();
    await model.refresh();

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.fileName.endsWith('.ax')) {
                model.refresh();
            }
        }),
    );

    const selector: vscode.DocumentSelector = { scheme: 'file', language: 'axon' };

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            selector,
            new AxonCompletionProvider(model),
            '.', ':',
        ),
        vscode.languages.registerHoverProvider(selector, new AxonHoverProvider()),
    );
}

export function deactivate(): void {}
