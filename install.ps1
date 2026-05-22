# Axon installer for Windows (PowerShell)
# Run from inside your project folder:
#   irm https://raw.githubusercontent.com/yairGrossman/Axon/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$RAW  = "https://raw.githubusercontent.com/yairGrossman/Axon/main"

$projectDir = (Get-Location).Path

Write-Host "==> Installing Axon developer tools" -ForegroundColor Cyan

# ── 1. axon-compile skill ────────────────────────────────────────────────────
$skillDir = Join-Path $projectDir ".claude\skills\axon-compile"
New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
Write-Host "    Fetching axon-compile skill..."
Invoke-WebRequest "$RAW/.claude/skills/axon-compile/SKILL.md" `
    -OutFile "$skillDir\SKILL.md" -UseBasicParsing
Write-Host "    Skill -> $skillDir" -ForegroundColor Green

# ── 2. VS Code extension ─────────────────────────────────────────────────────
if (Get-Command code -ErrorAction SilentlyContinue) {
    $vsixTemp = Join-Path $env:TEMP "vscode-axon.vsix"
    Write-Host "    Fetching VS Code extension..."
    Invoke-WebRequest "$RAW/vscode-axon/vscode-axon-0.2.0.vsix" `
        -OutFile $vsixTemp -UseBasicParsing
    code --install-extension $vsixTemp | Out-Null
    Remove-Item $vsixTemp -Force
    Write-Host "    VS Code extension installed" -ForegroundColor Green
} else {
    Write-Warning "    'code' not in PATH. Install VS Code shell command, then run:"
    Write-Warning "    code --install-extension $RAW/vscode-axon/vscode-axon-0.2.0.vsix"
}

# ── 3. Example project in ./axon/ ────────────────────────────────────────────
$axonDir = Join-Path $projectDir "axon"
New-Item -ItemType Directory -Force -Path $axonDir | Out-Null
Write-Host "    Writing example project -> $axonDir"

Set-Content "$axonDir\reportable.ax" @'
interface Reportable {
  skill generate(topic)
}
'@

Set-Content "$axonDir\reporter.ax" @'
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
'@

Set-Content "$axonDir\news_reporter.ax" @'
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
'@

Set-Content "$axonDir\main.axm" @'
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
'@

Write-Host "    Example project written (4 files)" -ForegroundColor Green
Write-Host ""
Write-Host "Done. Open axon/ in Claude Code and run /axon-compile to compile." -ForegroundColor Cyan
