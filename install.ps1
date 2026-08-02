# angelstack installer for Windows PowerShell.
# Copies skills and commands into ~/.claude and prints every file it writes.
# Nothing else on your machine is touched.

$ErrorActionPreference = 'Stop'

$src = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dest = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $HOME '.claude' }

$skills = @('timezone-safety', 'money-math', 'tenant-isolation', 'migration-safety')
$commands = @('guard', 'timecheck')

Write-Host "angelstack -> $dest"
Write-Host ""

New-Item -ItemType Directory -Force -Path (Join-Path $dest 'skills') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'commands') | Out-Null

foreach ($s in $skills) {
$target = Join-Path $dest "skills\$s"
if (Test-Path $target) { Write-Host "  skip  skills/$s (already exists - remove it first to reinstall)"; continue }
Copy-Item -Recurse (Join-Path $src "skills\$s") $target
Write-Host "  add   skills/$s"
}

foreach ($c in $commands) {
$target = Join-Path $dest "commands\$c.md"
if (Test-Path $target) { Write-Host "  skip  commands/$c.md (already exists)"; continue }
Copy-Item (Join-Path $src "commands\$c.md") $target
Write-Host "  add   commands/$c.md"
}

Write-Host ""
Write-Host "Done. Start a new Claude Code session, then run /guard on a branch with changes."
Write-Host "Uninstall instructions are at the bottom of the README."
