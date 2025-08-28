# Applies Supabase migrations using credentials from local .env files
# - Reads PAT from mcp/supabase-mcp-server/.env (sbp_*)
# - Reads project ref from .env.local VITE_SUPABASE_URL
# - Runs `supabase link` and `supabase db push`

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail($msg) {
  Write-Error $msg
  exit 1
}

# Load PAT
$envPath = Join-Path -Path $PSScriptRoot -ChildPath '..\mcp\supabase-mcp-server\.env'
if (-not (Test-Path $envPath)) { Fail "Missing MCP Supabase .env at $envPath" }
$envContent = Get-Content -Raw $envPath
$tokenMatch = [regex]::Match($envContent, 'sbp_[A-Za-z0-9]+')
if (-not $tokenMatch.Success) { Fail 'No Supabase personal access token (sbp_*) found in MCP .env' }
$env:SUPABASE_ACCESS_TOKEN = $tokenMatch.Value

# Optional: DB password (avoid interactive prompt)
$dbPassMatch = [regex]::Match($envContent, 'sbdb_[A-Za-z0-9]+')
if ($dbPassMatch.Success) {
  $env:SUPABASE_DB_PASSWORD = $dbPassMatch.Value
  $env:PGPASSWORD = $dbPassMatch.Value
}

# Project ref from .env.local (one level up from scripts/)
$rootEnvPath = Join-Path -Path $PSScriptRoot -ChildPath '..\.env.local'
if (-not (Test-Path $rootEnvPath)) { Fail "Missing .env.local at $rootEnvPath" }
$line = (Select-String -Path $rootEnvPath -Pattern '^VITE_SUPABASE_URL=' -Raw)
if (-not $line) { Fail 'VITE_SUPABASE_URL not found in .env.local' }
$url = $line -replace '^VITE_SUPABASE_URL=', ''
$refMatch = [regex]::Match($url, 'https?://([a-z0-9-]+)\.supabase\.co')
if (-not $refMatch.Success) { Fail 'Failed to parse project ref from VITE_SUPABASE_URL' }
$ref = $refMatch.Groups[1].Value
Write-Host "Using project ref: $ref"

# Ensure Node and npx work
node -v | Out-Null
npm -v | Out-Null

# Run CLI from repo root (parent of scripts)
$repoRoot = Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath '..')
Set-Location $repoRoot

# Link and push migrations
Write-Host 'Linking project with Supabase CLI...'
npx --yes supabase@latest link --project-ref $ref --workdir .
$linkExit = $LASTEXITCODE
# Some CLI versions may panic after linking; continue if config is present
$configPath = Join-Path -Path (Get-Location) -ChildPath 'supabase\config.toml'
if ($linkExit -ne 0 -and -not (Test-Path $configPath)) { Fail 'supabase link failed and config.toml not found' }

Write-Host 'Pushing migrations to database...'
npx --yes supabase@latest db push --linked
if ($LASTEXITCODE -ne 0) { Fail 'supabase db push failed' }

Write-Host 'Migrations applied successfully.'
