param([Parameter(Mandatory)][string]$ForumId)
$ErrorActionPreference = 'Stop'
if ($ForumId -notmatch '^[a-z][a-z0-9_]{1,40}$' -or $ForumId -eq 'forum_a') { throw 'Use the existing owner password helper for Forum A' }
$repo = Split-Path -Parent $PSScriptRoot
$file = Join-Path $repo ".local/forums/$ForumId/admin.json"
$credentials = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
Set-Clipboard -Value $credentials.password
Write-Output 'Forum Admin password copied to clipboard; no password printed.'
