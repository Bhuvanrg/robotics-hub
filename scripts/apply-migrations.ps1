param(
  [Parameter(Mandatory = $false)][string]$ProjectRef = "",
  [Parameter(Mandatory = $false)][string]$MigrationsDir = "database/migrations",
  [Parameter(Mandatory = $false)][string]$AccessToken = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error "npx not found. Please install Node.js (includes npx)."
}

# Allow passing token via parameter to avoid shell quoting issues
if ($AccessToken -and $AccessToken -ne "") {
  $env:SUPABASE_ACCESS_TOKEN = $AccessToken
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "SUPABASE_ACCESS_TOKEN env var is required. Create one in Supabase Account Settings and set it in this shell, or pass -AccessToken."
}

if (-not $ProjectRef -or $ProjectRef -eq "") {
  # Try to infer from VITE_SUPABASE_URL in .env.local
  $envFile = Join-Path (Get-Location) ".env.local"
  if (Test-Path $envFile) {
    $urlLine = (Get-Content $envFile) | Where-Object { $_ -match "^VITE_SUPABASE_URL=" }
    if ($urlLine) {
      $url = $urlLine -replace "^VITE_SUPABASE_URL=", ""
      if ($url -match "https://([a-z0-9]+)\.supabase\.co") {
        $ProjectRef = $matches[1]
      }
    }
  }
}

if (-not $ProjectRef -or $ProjectRef -eq "") {
  Write-Error "Project ref not provided and could not be inferred. Pass -ProjectRef <ref> or ensure .env.local has VITE_SUPABASE_URL."
}

Write-Host "Linking project $ProjectRef" -ForegroundColor Cyan
npx supabase@latest link --project-ref $ProjectRef | Write-Host

# Apply in lexical order
$files = Get-ChildItem -Path $MigrationsDir -Filter *.sql | Sort-Object Name
foreach ($f in $files) {
  Write-Host "Applying $($f.FullName)" -ForegroundColor Green
  npx supabase@latest db execute --file $f.FullName | Write-Host
}

Write-Host "All migrations applied." -ForegroundColor Cyan
