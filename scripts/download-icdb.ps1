# Generic ICDb downloader: save _raw_v1..v4.html for all keys into scripts/icdb-data/<instrument>/<Key>/.
# Wrapper scripts should call this with instrument-specific chart path and optional ct list.

param(
    [Parameter(Mandatory = $true)]
    [string]$InstrumentFolder,

    [Parameter(Mandatory = $true)]
    [string]$ChartPath,

    [Parameter(Mandatory = $false)]
    [string]$Ct = "1,2,3,5,43,15,16,6,7,4,8,9,10,11,19,20,21,22,23,27,28,12,13,14,17,18,24,25,26,32,29,30,33,34,40,31,35,36,37,38,39,41",

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 120
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$RawRoot = Join-Path $Root "scripts\icdb-data\$InstrumentFolder"

$base = "https://internetchorddatabase.com/ChordCharts/$ChartPath/?ft=0&dcn=0&pn={0}&ct=$Ct&cl=eng&ccs=M&co=p&dcni=1&v="

$keys = @(
  @{ dir='Ab'; pn='A-flat' },
  @{ dir='B'; pn='B' },
  @{ dir='Bb'; pn='B-flat' },
  @{ dir='C'; pn='C' },
  @{ dir='C#'; pn='D-flat' },
  @{ dir='D'; pn='D' },
  @{ dir='E'; pn='E' },
  @{ dir='F'; pn='F' },
  @{ dir='Eb'; pn='E-flat' },
  @{ dir='F#'; pn='G-flat' },
  @{ dir='G'; pn='G' },
  @{ dir='A'; pn='A' }
)

foreach ($k in $keys) {
  $d = Join-Path $RawRoot $k.dir
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
  1..4 | ForEach-Object {
    $u = ($base -f $k.pn) + $_
    $out = Join-Path $d ("_raw_v{0}.html" -f $_)
    try {
      (Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec $TimeoutSec).Content | Set-Content -Path $out -Encoding UTF8
      Write-Host "$($k.dir) v$_ ok"
    } catch {
      Write-Host "$($k.dir) v$_ FAIL: $($_.Exception.Message)"
    }
  }
}

Write-Host "done downloads -> $RawRoot"
