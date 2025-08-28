# Deploys Supabase Edge Functions and sets secrets from local env files
# - Reads PAT from mcp/supabase-mcp-server/.env (sbp_*)
# - Reads project ref from .env.local VITE_SUPABASE_URL
# - Reads SUPABASE_SERVICE_ROLE_KEY from mcp .env if present (commented or not)
# - Reads YOUTUBE_API_KEY and RESEND_* from .env.local if present

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail($msg) {
  Write-Error $msg
  exit 1
}

# Paths
$repoRoot = Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath '..')
$envLocalPath = Join-Path -Path $repoRoot -ChildPath '.env.local'
$mcpEnvPath   = Join-Path -Path $repoRoot -ChildPath 'mcp/supabase-mcp-server/.env'

if (-not (Test-Path $envLocalPath)) { Fail "Missing .env.local at $envLocalPath" }
if (-not (Test-Path $mcpEnvPath))   { Fail "Missing MCP .env at $mcpEnvPath" }

# Load PAT
$mcpContent = Get-Content -Raw $mcpEnvPath
$pat = ([regex]::Match($mcpContent, 'sbp_[A-Za-z0-9]+')).Value
if ([string]::IsNullOrWhiteSpace($pat)) { Fail 'Supabase personal access token (sbp_...) not found in MCP .env' }
$env:SUPABASE_ACCESS_TOKEN = $pat

# Optional: DB password to avoid interactive prompts
$dbPass = ([regex]::Match($mcpContent, 'sbdb_[A-Za-z0-9]+')).Value
if ($dbPass) {
  $env:SUPABASE_DB_PASSWORD = $dbPass
  $env:PGPASSWORD = $dbPass
}

# Project ref + URL from .env.local
$envLocal = Get-Content -Raw $envLocalPath
$url = ($envLocal -split "`r?`n" | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1) -replace '^VITE_SUPABASE_URL=', ''
if ([string]::IsNullOrWhiteSpace($url)) { Fail 'VITE_SUPABASE_URL not found in .env.local' }
$ref = ([regex]::Match($url, 'https?://([a-z0-9-]+)\.supabase\.co')).Groups[1].Value
if ([string]::IsNullOrWhiteSpace($ref)) { Fail 'Failed to parse project ref from VITE_SUPABASE_URL' }
Write-Host "Project: $ref" -ForegroundColor Cyan

# Service role key from MCP .env (supports commented line)
$srkLine = ($mcpContent -split "`r?`n" | Where-Object { $_ -match 'SUPABASE_SERVICE_ROLE_KEY\s*=' } | Select-Object -First 1)
$srk = $null
if ($srkLine) { $srk = $srkLine -replace '^[#\s]*SUPABASE_SERVICE_ROLE_KEY\s*=\s*','' }
if ([string]::IsNullOrWhiteSpace($srk)) { Write-Warning 'SUPABASE_SERVICE_ROLE_KEY not found. news-ingest will not have write access.' }

# Optional keys from .env.local
function GetEnvVal($name) {
  $line = ($envLocal -split "`r?`n" | Where-Object { $_ -match ("^" + [regex]::Escape($name) + "=") } | Select-Object -First 1)
  if ($line) { return ($line -replace ('^' + [regex]::Escape($name) + '=') , '') }
  return $null
}
$ytKey = GetEnvVal 'YOUTUBE_API_KEY'
$resendKey = GetEnvVal 'RESEND_API_KEY'
$resendFrom = GetEnvVal 'RESEND_FROM'

# Ensure linked to project
Push-Location $repoRoot
try {
  Write-Host 'Ensuring project is linked...' -ForegroundColor Yellow
  npx --yes supabase@latest link --project-ref $ref --workdir . | Out-Null

  # Deploy news-ingest
  Write-Host 'Deploying function: news-ingest' -ForegroundColor Yellow
  npx --yes supabase@latest functions deploy news-ingest --project-ref $ref --workdir .
  if ($LASTEXITCODE -ne 0) { Fail 'news-ingest deploy failed' }

  # Prepare project-level secrets (available to all functions)
  $allSecrets = @("PROJECT_URL=$url")
  if ($srk) { $allSecrets += "SERVICE_ROLE_KEY=$srk" }
  if ($ytKey) { $allSecrets += "YOUTUBE_API_KEY=$ytKey" }
  if ($resendKey) { $allSecrets += "RESEND_API_KEY=$resendKey" }
  if ($resendFrom) { $allSecrets += "RESEND_FROM=$resendFrom" }

  # Deploy weekly-digest
  Write-Host 'Deploying function: weekly-digest' -ForegroundColor Yellow
  npx --yes supabase@latest functions deploy weekly-digest --project-ref $ref --workdir .
  if ($LASTEXITCODE -ne 0) { Fail 'weekly-digest deploy failed' }

  if ($allSecrets.Count -gt 0) {
    Write-Host 'Setting project secrets (affects all functions)' -ForegroundColor Yellow
    $tmpEnv = New-TemporaryFile
    Set-Content -Path $tmpEnv -Value ($allSecrets -join "`n") -NoNewline
    npx --yes supabase@latest secrets set --workdir . --env-file $tmpEnv
    $code = $LASTEXITCODE
    Remove-Item $tmpEnv -Force -ErrorAction SilentlyContinue
    if ($code -ne 0) { Fail 'Setting project secrets failed' }
  }

  Write-Host 'Deployment complete.' -ForegroundColor Green
}
finally {
  Pop-Location | Out-Null
}
