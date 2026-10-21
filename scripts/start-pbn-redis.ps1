param(
  [string]$RedisExe = 'D:\laragon\bin\redis\redis-x64-5.0.14.1\redis-server.exe'
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path -LiteralPath $RedisExe)) {
  throw "Redis executable not found: $RedisExe. Supply -RedisExe with the Laragon path."
}
$probe = [System.Net.Sockets.TcpClient]::new()
try {
  $probe.Connect('127.0.0.1', 16379)
  throw 'Port 16379 is occupied. Verify process ownership before reusing or stopping it.'
} catch [System.Net.Sockets.SocketException] {
  # No listener; start the dedicated PBN instance.
} finally {
  $probe.Dispose()
}
$redisData = Join-Path $workspace '.local/redis'
New-Item -ItemType Directory -Force -Path $redisData | Out-Null
Push-Location $redisData
try {
  & $RedisExe --bind 127.0.0.1 --port 16379 --dir . --appendonly yes
} finally {
  Pop-Location
}
