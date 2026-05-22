#!/usr/bin/env bash
# Axon installer for macOS / Linux
# Run from inside your project folder:
#   curl -fsSL https://raw.githubusercontent.com/yairGrossman/Axon/main/install.sh | bash

set -e

RAW="https://raw.githubusercontent.com/yairGrossman/Axon/main"

echo "==> Installing Axon developer tools"

# ── 1. axon-compile skill (global) ───────────────────────────────────────────
SKILL_DIR="$HOME/.claude/skills/axon-compile"
mkdir -p "$SKILL_DIR"
echo "    Fetching axon-compile skill..."
curl -fsSL "$RAW/.claude/skills/axon-compile/SKILL.md" -o "$SKILL_DIR/SKILL.md"
echo "    Skill -> $SKILL_DIR"

# ── 2. VS Code extension ─────────────────────────────────────────────────────
if command -v code &>/dev/null; then
    VSIX_TEMP="$(mktemp).vsix"
    echo "    Fetching VS Code extension..."
    curl -fsSL "$RAW/vscode-axon/vscode-axon-0.1.0.vsix" -o "$VSIX_TEMP"
    code --install-extension "$VSIX_TEMP" >/dev/null
    rm -f "$VSIX_TEMP"
    echo "    VS Code extension installed"
else
    echo "    WARNING: 'code' not in PATH. Install VS Code shell command, then run:"
    echo "    code --install-extension $RAW/vscode-axon/vscode-axon-0.1.0.vsix"
fi

# ── 3. Example project in ./axon/ ────────────────────────────────────────────
AXON_DIR="$(pwd)/axon"
mkdir -p "$AXON_DIR"
echo "    Writing example project -> $AXON_DIR"

cat > "$AXON_DIR/reportable.ax" << 'EOF'
interface Reportable {
  skill generate(topic)
}
EOF

cat > "$AXON_DIR/reporter.ax" << 'EOF'
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

cat > "$AXON_DIR/news_reporter.ax" << 'EOF'
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

cat > "$AXON_DIR/main.axm" << 'EOF'
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
echo "Done. Open axon/ in Claude Code and run /axon-compile to compile."
