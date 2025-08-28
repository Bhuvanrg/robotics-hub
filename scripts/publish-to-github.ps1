param(
  [string]$Owner = "Bhuvanrg",
  [string]$RepoName = "robotics-hub",
  [ValidateSet('public','private','internal')][string]$Visibility = 'public'
)

$ErrorActionPreference = 'Stop'

function Exec($cmd) {
  Write-Host "> $cmd" -ForegroundColor Cyan
  pwsh -NoLogo -NoProfile -Command $cmd
}

# Ensure gh CLI is available
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) not found. Install from https://cli.github.com and run 'gh auth login'."
}

# Ensure git repo
if (-not (Test-Path .git)) {
  Exec "git init"
}

# Default branch main
try { Exec "git symbolic-ref --quiet HEAD" } catch { Exec "git checkout -b main" }

# Add files and commit if needed
Exec "git add -A"
try {
  Exec "git diff --cached --quiet" | Out-Null
  Write-Host "No staged changes" -ForegroundColor DarkGray
} catch {
  Exec "git commit -m 'chore: initial commit'"
}

# Create repo if missing
$full = "$Owner/$RepoName"
$exists = (gh repo view $full 2>$null) -ne $null
if (-not $exists) {
  Exec "gh repo create $full --$Visibility --source . --remote origin --push"
} else {
  # Ensure remote
  $hasOrigin = (git remote 2>$null | Select-String -SimpleMatch "origin").Length -gt 0
  if (-not $hasOrigin) { Exec "git remote add origin https://github.com/$full.git" }
  Exec "git push -u origin main"
}

Write-Host "Done. Repo: https://github.com/$full" -ForegroundColor Green
