param(
  [ValidateSet('vercel','netlify','cloudflare')][string]$Provider = 'vercel',
  [string]$ProjectName = 'robotics-hub',
  [string]$SupabaseUrl,
  [string]$SupabaseAnonKey
)

$ErrorActionPreference = 'Stop'

function Need($cmd, $installUrl) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "Missing CLI: $cmd. Install from $installUrl"
  }
}

switch ($Provider) {
  'vercel' {
    Need 'vercel' 'https://vercel.com/docs/cli'
    if (-not $SupabaseUrl -or -not $SupabaseAnonKey) { throw 'Provide -SupabaseUrl and -SupabaseAnonKey' }
    # vercel prompts for the value; pipe it from PowerShell
    $SupabaseUrl | vercel env add VITE_SUPABASE_URL production | Out-Host
    $SupabaseAnonKey | vercel env add VITE_SUPABASE_ANON_KEY production | Out-Host
    $SupabaseUrl | vercel env add VITE_SUPABASE_URL preview | Out-Host
    $SupabaseAnonKey | vercel env add VITE_SUPABASE_ANON_KEY preview | Out-Host
  }
  'netlify' {
    Need 'netlify' 'https://docs.netlify.com/cli/get-started/'
    if (-not $SupabaseUrl -or -not $SupabaseAnonKey) { throw 'Provide -SupabaseUrl and -SupabaseAnonKey' }
    netlify env:set VITE_SUPABASE_URL "$SupabaseUrl" | Out-Host
    netlify env:set VITE_SUPABASE_ANON_KEY "$SupabaseAnonKey" | Out-Host
  }
  'cloudflare' {
  # Use npm exec to invoke wrangler without requiring a global install
  Need 'npm' 'https://nodejs.org/en/download/package-manager'
    if (-not $SupabaseUrl -or -not $SupabaseAnonKey) { throw 'Provide -SupabaseUrl and -SupabaseAnonKey' }
  npm exec --yes --package=wrangler -- wrangler pages project create $ProjectName -y 2>$null | Out-Null
  $SupabaseUrl     | npm exec --yes --package=wrangler -- wrangler pages secret put VITE_SUPABASE_URL --project-name $ProjectName | Out-Host
  $SupabaseAnonKey | npm exec --yes --package=wrangler -- wrangler pages secret put VITE_SUPABASE_ANON_KEY --project-name $ProjectName | Out-Host
  }
}

Write-Host "Configured $Provider env vars for $ProjectName" -ForegroundColor Green
