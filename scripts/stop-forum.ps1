param([Parameter(Mandatory)][string]$StateFile, [Parameter(Mandatory)][string]$RepoRoot)
$ErrorActionPreference = 'Stop'
$state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
$root = [IO.Path]::GetFullPath($RepoRoot).Replace('\','/').TrimEnd('/')
$all = @(Get-CimInstance Win32_Process)
$visited = [System.Collections.Generic.HashSet[int]]::new()
function Get-NodeDescendants([int]$parentId) {
  if (-not $visited.Add($parentId)) { return }
  $parentSnapshot = $all | Where-Object ProcessId -eq $parentId
  foreach ($child in @($all | Where-Object { $_.ParentProcessId -eq $parentId -and $_.ProcessId -ne $parentId -and $_.CreationDate -ge $parentSnapshot.CreationDate })) {
    if ($child.Name -eq 'conhost.exe') { continue }
    if ($child.Name -ne 'node.exe' -or -not ([string]$child.CommandLine).Replace('\','/').Contains($root + '/')) { throw "Unexpected descendant $($child.ProcessId); refusing stop" }
    Get-NodeDescendants $child.ProcessId
    $child
  }
}
$targets = @()
foreach ($processId in @($state.api, $state.web)) {
  $parent = $all | Where-Object ProcessId -eq $processId
  if (-not $parent) { continue }
  $line = ([string]$parent.CommandLine).Replace('\','/')
  if ($parent.Name -ne 'node.exe' -or -not $line.Contains($root + '/apps/') -or -not $line.Contains("--title=pbn_$($state.forum)_")) { throw "Refusing unrelated process $processId" }
  $targets += @(Get-NodeDescendants $processId)
  $targets += $parent
}
# Stop supervisors first so Next cannot respawn a server during shutdown.
foreach ($processId in @($state.api, $state.web)) { if ($targets.ProcessId -contains $processId) { Stop-Process -Id $processId -ErrorAction SilentlyContinue } }
foreach ($target in $targets) { Stop-Process -Id $target.ProcessId -ErrorAction SilentlyContinue }
foreach ($target in $targets) { Wait-Process -Id $target.ProcessId -Timeout 10 -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
