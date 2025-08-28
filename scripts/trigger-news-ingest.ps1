# Triggers the deployed news-ingest Edge Function once
# Reads project ref and anon key from .env.local

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail($msg) {
  Write-Error $msg
  exit 1
}

$root = Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath '..')
$envLocalPath = Join-Path -Path $root -ChildPath '.env.local'
if (-not (Test-Path $envLocalPath)) { Fail "Missing .env.local at $envLocalPath" }
$envLocal = Get-Content -Raw $envLocalPath

function ReadEnv($name) {
  $line = ($envLocal -split "`r?`n" | Where-Object { $_ -match ("^" + [regex]::Escape($name) + "=") } | Select-Object -First 1)
  if ($line) { return ($line -replace ('^' + [regex]::Escape($name) + '=') , '') }
  return $null
}

$projectUrl = ReadEnv 'VITE_SUPABASE_URL'
$anonKey = ReadEnv 'VITE_SUPABASE_ANON_KEY'
if (-not $projectUrl -or -not $anonKey) { Fail 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local' }

$fn = "$projectUrl/functions/v1/news-ingest"
Write-Host "Calling: $fn" -ForegroundColor Cyan

try {
  $resp = Invoke-WebRequest -Method GET -Uri $fn -Headers @{ Authorization = "Bearer $anonKey"; Accept = 'application/json' } -TimeoutSec 120
  Write-Host ("Status: " + [int]$resp.StatusCode)
  if ($resp.Content) { Write-Output $resp.Content }
} catch {
  Fail ("Invoke failed: " + $_.Exception.Message)
}
