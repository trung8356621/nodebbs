param(
  [string]$CredentialPath = (Join-Path $PSScriptRoot '../.local/pbn-owner-password.dpapi')
)

$ErrorActionPreference = 'Stop'
$encrypted = Get-Content -LiteralPath $CredentialPath -Raw
$securePassword = ConvertTo-SecureString -String $encrypted.Trim()
$credential = [System.Management.Automation.PSCredential]::new('pbn-owner', $securePassword)
Set-Clipboard -Value $credential.GetNetworkCredential().Password
Write-Output 'Admin password copied to clipboard for the current Windows user.'
