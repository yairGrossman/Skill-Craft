# Skill Craft installer for Windows (PowerShell)
# Run from inside your project folder:
#   irm https://raw.githubusercontent.com/yairGrossman/Skill-Craft/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$RAW  = "https://raw.githubusercontent.com/yairGrossman/Skill-Craft/main"

$projectDir = (Get-Location).Path

Write-Host "==> Installing Skill Craft developer tools" -ForegroundColor Cyan

# ── 1. skillcraft-compile skill ────────────────────────────────────────────────────
$skillDir = Join-Path $projectDir ".claude\skills\skillcraft-compile"
New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
Write-Host "    Fetching skillcraft-compile skill..."
Invoke-WebRequest "$RAW/.claude/skills/skillcraft-compile/SKILL.md" `
    -OutFile "$skillDir\SKILL.md" -UseBasicParsing
Write-Host "    Skill -> $skillDir" -ForegroundColor Green

# ── 2. VS Code extension ─────────────────────────────────────────────────────
if (Get-Command code -ErrorAction SilentlyContinue) {
    $vsixTemp = Join-Path $env:TEMP "vscode-skillcraft.vsix"
    Write-Host "    Fetching VS Code extension..."
    Invoke-WebRequest "$RAW/vscode-skillcraft/vscode-skillcraft-0.2.0.vsix" `
        -OutFile $vsixTemp -UseBasicParsing
    code --install-extension $vsixTemp | Out-Null
    Remove-Item $vsixTemp -Force
    Write-Host "    VS Code extension installed" -ForegroundColor Green
} else {
    Write-Warning "    'code' not in PATH. Install VS Code shell command, then run:"
    Write-Warning "    code --install-extension $RAW/vscode-skillcraft/vscode-skillcraft-0.2.0.vsix"
}

# ── 3. Example project in ./skillcraft/examples/ ────────────────────────────────────
$skillcraftDir = Join-Path $projectDir "skillcraft\examples"
New-Item -ItemType Directory -Force -Path $skillcraftDir | Out-Null
Write-Host "    Writing example project -> $skillcraftDir"

Set-Content "$skillcraftDir\reportable.skillc" @'
interface Reportable {
  skill generate(topic)
}
'@

Set-Content "$skillcraftDir\reporter.skillc" @'
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

Set-Content "$skillcraftDir\news_reporter.skillc" @'
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

Set-Content "$skillcraftDir\main.skillcm" @'
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
Write-Host "Done. Open skillcraft/examples/ in Claude Code and run /skillcraft-compile to compile." -ForegroundColor Cyan
