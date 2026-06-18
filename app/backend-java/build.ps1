$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$classes = Join-Path $root "build\classes"
$sourcesFile = Join-Path $root "build\sources.txt"

New-Item -ItemType Directory -Force $classes | Out-Null
Get-ChildItem -Path (Join-Path $root "src\main\java") -Recurse -Filter *.java | ForEach-Object { $_.FullName } | Set-Content -Encoding UTF8 $sourcesFile
javac -encoding UTF-8 -d $classes "@$sourcesFile"
Write-Host "Java gateway compiled to $classes"
