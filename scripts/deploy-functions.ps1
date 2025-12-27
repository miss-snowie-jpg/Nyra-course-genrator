# Deploy Supabase Edge Functions for Ad Library
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-functions.ps1

param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Error "Supabase CLI not found. Install from https://supabase.com/docs/guides/cli"
  exit 1
}
if (-not $ProjectRef) {
  Write-Host "You can set environment variable SUPABASE_PROJECT_REF or pass -ProjectRef <ref>."
  exit 1
}

$funcs = @('add-ad','update-ad','publish-ad','verify-paid')
foreach ($f in $funcs) {
  Write-Host "Deploying function: $f"
  supabase functions deploy $f --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to deploy $f"
    exit 1
  }
}

Write-Host "All functions deployed. Don't forget to set secrets:
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL
and ensure users can call them with Authorization header when required."