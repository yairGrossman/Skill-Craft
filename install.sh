#!/usr/bin/env bash
# Skill Craft installer for macOS / Linux
# Run from inside your project folder:
#   curl -fsSL https://raw.githubusercontent.com/yairGrossman/Skill Craft/main/install.sh | bash

set -e

RAW="https://raw.githubusercontent.com/yairGrossman/Skill Craft/main"

PROJECT_DIR="$(pwd)"

echo "==> Installing Skill Craft developer tools"

# ── 1. skillcraft-compile skill ────────────────────────────────────────────────────
SKILL_DIR="$PROJECT_DIR/.claude/skills/skillcraft-compile"
mkdir -p "$SKILL_DIR"
echo "    Fetching skillcraft-compile skill..."
curl -fsSL "$RAW/.claude/skills/skillcraft-compile/SKILL.md" -o "$SKILL_DIR/SKILL.md"
echo "    Skill -> $SKILL_DIR"

# ── 2. VS Code extension ─────────────────────────────────────────────────────
if command -v code &>/dev/null; then
    VSIX_TEMP="$(mktemp).vsix"
    echo "    Fetching VS Code extension..."
    curl -fsSL "$RAW/vscode-skillcraft/vscode-skillcraft-0.2.0.vsix" -o "$VSIX_TEMP"
    code --install-extension "$VSIX_TEMP" >/dev/null
    rm -f "$VSIX_TEMP"
    echo "    VS Code extension installed"
else
    echo "    WARNING: 'code' not in PATH. Install VS Code shell command, then run:"
    echo "    code --install-extension $RAW/vscode-skillcraft/vscode-skillcraft-0.2.0.vsix"
fi

# ── 3. Example project in ./Skill Craft/ ────────────────────────────────────────────
SKILLCRAFT_DIR="$(pwd)/skillcraft/examples"
mkdir -p "$SKILLCRAFT_DIR"
echo "    Writing example project -> $SKILLCRAFT_DIR"

cat > "$SKILLCRAFT_DIR/reportable.skillc" << 'EOF'
interface Reportable {
  skill generate(topic)
}
EOF

cat > "$SKILLCRAFT_DIR/reporter.skillc" << 'EOF'
abstract class Reporter implements Reportable {

  fields {
    @public    title
    @protected body
    @private   draft_count = 0
  }

  @public
  skill generate(topic) {
    - call this.fetch(topic)
    - call this.compose
  }

  @protected
  abstract skill fetch(topic)

  @protected
  virtual skill compose {
    - write a structured summary using this.body, store in this.title
  }

  @public
  sealed skill version {
    - return "1.0"
  }
}
EOF

cat > "$SKILLCRAFT_DIR/news_reporter.skillc" << 'EOF'
class NewsReporter extends Reporter {

  fields {
    @private source = "Reuters"
  }

  @protected
  skill fetch(topic) {
    - search this.source for recent news about topic
    - store top 5 headlines in this.body
  }

  @protected
  skill compose {
    - call base.compose
    - append a breaking-news banner to this.title
  }
}
EOF

cat > "$SKILLCRAFT_DIR/main.skillcm" << 'EOF'
@main
skill main {
  - call NewsReporter.generate(topic: "AI trends")

  parallel {
    - call NewsReporter.generate(topic: "climate change")
    - call NewsReporter.generate(topic: "global economy")
  }

  pipe(strategy: per_item) {
    - call NewsReporter.generate(topic: "space exploration")
    - call NewsReporter.generate(topic: "renewable energy")
  }
}
EOF

echo "    Example project written (4 files)"
echo ""
echo "Done. Open skillcraft/examples/ in Claude Code and run /skillcraft-compile to compile."
