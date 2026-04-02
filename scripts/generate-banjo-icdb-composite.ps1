# Parse ICDb _raw_v1..v4.html composite SingleFingering_v2 sprite tables -> chord *.js with frets + fingers (one char per string).
# See README: "Internet Chord Database (ICDb) banjo imports" for source site and StaticCharts vs composite forms.
# Usage: powershell -File scripts/generate-banjo-icdb-composite.ps1 -InstrumentFolder banjo-open-c -ReadableSuffix openCBanjo
#        powershell -File scripts/generate-banjo-icdb-composite.ps1 -InstrumentFolder banjo-standard-c-drop-c -ReadableSuffix standardCDropCBanjo
#        powershell -File scripts/generate-banjo-icdb-composite.ps1 -InstrumentFolder plecturn-4-string-banjo-irish-tuning -ReadableSuffix irish4Banjo -StringCount 4

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("banjo-open-c", "banjo-standard-c-drop-c", "plecturn-4-string-banjo-irish-tuning")]
    [string]$InstrumentFolder,

    [Parameter(Mandatory = $true)]
    [ValidateSet("openCBanjo", "standardCDropCBanjo", "irish4Banjo")]
    [string]$ReadableSuffix,

    [Parameter(Mandatory = $false)]
    [ValidateRange(4, 5)]
    [int]$StringCount = 5
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$ChordsRoot = Join-Path $Root "src\db\$InstrumentFolder\chords"

$RemainderToSuffix = [ordered]@{
    "m(add9)"       = "madd9"
    "m(maj7)"       = "mmaj7"
    "maj7(-sharp5)" = "maj7#5"
    "maj7(#5)"      = "maj7#5"
    "maj7(b5)"      = "maj7b5"
    "7(add-sharp9)" = "7#9"
    "7(add-flat9)"  = "7b9"
    "7(addb9)"      = "7b9"
    "7(b5)"         = "7b5"
    "7sus4"         = "7sus4"
    "m7b5"          = "m7b5"
    "m11"           = "m11"
    "m9"            = "m9"
    "m7"            = "m7"
    "m6"            = "m6"
    "maj13"         = "maj13"
    "maj9"          = "maj9"
    "maj7"          = "maj7"
    "dim7"          = "dim7"
    "sus4"          = "sus4"
    "sus2"          = "sus2"
    "(add9)"        = "add9"
    "aug7"          = "aug7"
    "dim"           = "dim"
    "aug"           = "aug"
    "9(b5)"         = "9b5"
    "11"            = "11"
    "13"            = "13"
    "9"             = "9"
    "6"             = "6"
    "5"             = "5"
    "7"             = "7"
    "m"             = "minor"
}

$SuffixOrder = @(
    "major", "minor", "dim", "dim7", "sus2", "sus4", "aug", "5", "6", "m6", "7", "7b5", "aug7", "7#9", "7sus4", "9", "9b5", "7b9", "11", "13",
    "maj7", "maj7b5", "maj7#5", "maj9", "maj13", "m7", "m7b5", "m9", "m11", "mmaj7", "add9", "madd9"
)

$SuffixFile = @{
    "major"   = @{ importId = "major"; fileStem = "major" }
    "minor"   = @{ importId = "minor"; fileStem = "minor" }
    "dim"     = @{ importId = "dim"; fileStem = "dim" }
    "dim7"    = @{ importId = "dim7"; fileStem = "dim7" }
    "sus2"    = @{ importId = "sus2"; fileStem = "sus2" }
    "sus4"    = @{ importId = "sus4"; fileStem = "sus4" }
    "aug"     = @{ importId = "aug"; fileStem = "aug" }
    "5"       = @{ importId = "_5"; fileStem = "5" }
    "6"       = @{ importId = "_6"; fileStem = "6" }
    "m6"      = @{ importId = "m6"; fileStem = "m6" }
    "7"       = @{ importId = "_7"; fileStem = "7" }
    "7b5"     = @{ importId = "_7b5"; fileStem = "7b5" }
    "aug7"    = @{ importId = "aug7"; fileStem = "aug7" }
    "7#9"     = @{ importId = "_7sharp9"; fileStem = "7#9" }
    "7sus4"   = @{ importId = "c7sus4"; fileStem = "7sus4" }
    "9"       = @{ importId = "_9"; fileStem = "9" }
    "9b5"     = @{ importId = "_9b5"; fileStem = "9b5" }
    "7b9"     = @{ importId = "_7b9"; fileStem = "7b9" }
    "11"      = @{ importId = "_11"; fileStem = "11" }
    "13"      = @{ importId = "_13"; fileStem = "13" }
    "maj7"    = @{ importId = "maj7"; fileStem = "maj7" }
    "maj7b5"  = @{ importId = "maj7b5"; fileStem = "maj7b5" }
    "maj7#5"  = @{ importId = "maj7sharp5"; fileStem = "maj7#5" }
    "maj9"    = @{ importId = "maj9"; fileStem = "maj9" }
    "maj13"   = @{ importId = "maj13"; fileStem = "maj13" }
    "m7"      = @{ importId = "m7"; fileStem = "m7" }
    "m7b5"    = @{ importId = "m7b5"; fileStem = "m7b5" }
    "m9"      = @{ importId = "m9"; fileStem = "m9" }
    "m11"     = @{ importId = "m11"; fileStem = "m11" }
    "mmaj7"   = @{ importId = "mmaj7"; fileStem = "mmaj7" }
    "add9"    = @{ importId = "add9"; fileStem = "add9" }
    "madd9"   = @{ importId = "madd9"; fileStem = "madd9" }
}

$Keys = @(
    @{ dir = "Ab"; key = "Ab"; htmlRoot = "Ab" }
    @{ dir = "A"; key = "A"; htmlRoot = "A" }
    @{ dir = "B"; key = "B"; htmlRoot = "B" }
    @{ dir = "Bb"; key = "Bb"; htmlRoot = "Bb" }
    @{ dir = "C"; key = "C"; htmlRoot = "C" }
    @{ dir = "C#"; key = "C#"; htmlRoot = "Db" }
    @{ dir = "D"; key = "D"; htmlRoot = "D" }
    @{ dir = "E"; key = "E"; htmlRoot = "E" }
    @{ dir = "F"; key = "F"; htmlRoot = "F" }
    @{ dir = "Eb"; key = "Eb"; htmlRoot = "Eb" }
    @{ dir = "F#"; key = "F#"; htmlRoot = "Gb" }
    @{ dir = "G"; key = "G"; htmlRoot = "G" }
)

function Normalize-IcdbChordName([string]$s) {
    if ([string]::IsNullOrEmpty($s)) { return $s }
    $t = $s -replace '♭', 'b' -replace '♯', '#'
    $t = $t -replace '°', 'dim'
    return $t
}

function RemainderToSuffix([string]$r) {
    if ($r -eq "") { return "major" }
    foreach ($key in $RemainderToSuffix.Keys) {
        if ($r -eq $key) { return $RemainderToSuffix[$key] }
    }
    return $null
}

function FretsToParen([string]$fretsStr) {
    $chars = $fretsStr.ToCharArray()
    $parts = @()
    foreach ($ch in $chars) {
        $c = [string]$ch
        if ($c -eq "x") { $parts += "x" }
        else { $parts += [Convert]::ToInt32($c, 16) }
    }
    return "(" + ($parts -join ", ") + ")"
}

function DisplayChordName([string]$key, [string]$htmlRoot, [string]$fullName) {
    if ($key -eq $htmlRoot) { return $fullName }
    return $fullName -replace "^$([regex]::Escape($htmlRoot))", $key
}

$ParserScript = Join-Path $PSScriptRoot "parse-icdb-composite-table.mjs"

function Invoke-CompositeTableParse([string]$tableInner) {
    $tmp = [System.IO.Path]::GetTempFileName() + ".html"
    try {
        [System.IO.File]::WriteAllText($tmp, $tableInner, [System.Text.UTF8Encoding]::new($false))
        $json = & node $ParserScript $tmp $StringCount 2>&1
        if ($LASTEXITCODE -ne 0) { return $null }
        $s = if ($json -is [System.Array]) { $json[-1] } else { [string]$json }
        if ($s -eq "null" -or [string]::IsNullOrWhiteSpace($s)) { return $null }
        $o = $s | ConvertFrom-Json
        return @{ frets = $o.frets; fingers = $o.fingers }
    } catch {
        return $null
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Parse-CompositeHtmlFile([string]$html, [string]$htmlRoot) {
    $rows = New-Object System.Collections.ArrayList
    $rx = [regex]'<!-- The fingering for tc\.\d+:\s*([^>]+?)\s*-->'
    foreach ($m in $rx.Matches($html)) {
        $fullName = Normalize-IcdbChordName ($m.Groups[1].Value.Trim())
        if ($fullName -match 'Fingering not found') { continue }
        $start = $m.Index
        $next = $html.IndexOf("<!-- The fingering for tc.", $start + 10)
        $block = if ($next -lt 0) { $html.Substring($start) } else { $html.Substring($start, $next - $start) }
        if ($block -match 'StaticCharts\\[^"]+\.png') { continue }
        $tblM = [regex]::Match($block, '(?s)<table class="SingleFingering_v2[^"]*"[^>]*>(.*?)</table>\s*</div>')
        if (-not $tblM.Success) { continue }
        $parsed = Invoke-CompositeTableParse $tblM.Groups[1].Value
        if (-not $parsed) { continue }
        if (-not $fullName.StartsWith($htmlRoot)) { continue }
        $remainder = $fullName.Substring($htmlRoot.Length)
        $suffix = RemainderToSuffix $remainder
        if ($suffix) {
            [void]$rows.Add(@{ fullName = $fullName; suffix = $suffix; frets = $parsed.frets; fingers = $parsed.fingers })
        }
        else {
            Write-Warning "Unknown: $fullName ($remainder)"
        }
    }
    return $rows
}

function Format-PositionsJs($positionPairs) {
    $sorted = $positionPairs | Sort-Object
    $lines = @()
    foreach ($pair in $sorted) {
        $parts = $pair -split '\|', 2
        $f = $parts[0]
        $g = $parts[1]
        $lines += "    {`n      frets: '$f',`n      fingers: '$g',`n    }"
    }
    return "[`n" + ($lines -join ",`n") + ",`n  ]"
}

foreach ($k in $Keys) {
    $dirPath = Join-Path $ChordsRoot $k.dir
    if (-not (Test-Path $dirPath)) { New-Item -ItemType Directory -Path $dirPath -Force | Out-Null }
    $all = New-Object System.Collections.ArrayList
    foreach ($v in 1..4) {
        $fp = Join-Path $dirPath "_raw_v$v.html"
        if (-not (Test-Path $fp)) { Write-Warning "Missing $fp"; continue }
        $html = Get-Content -Path $fp -Raw -Encoding UTF8
        foreach ($row in (Parse-CompositeHtmlFile $html $k.htmlRoot)) { [void]$all.Add($row) }
    }

    $bySuffix = @{}
    foreach ($row in $all) {
        $s = $row.suffix
        $pairKey = "$($row.frets)|$($row.fingers)"
        if (-not $bySuffix.ContainsKey($s)) { $bySuffix[$s] = New-Object "System.Collections.Generic.HashSet[string]" }
        [void]$bySuffix[$s].Add($pairKey)
    }

    foreach ($sfx in $SuffixOrder) {
        if (-not $bySuffix.ContainsKey($sfx)) { continue }
        $meta = $SuffixFile[$sfx]
        $fn = $meta.fileStem + ".js"
        $body = @"
export default {
  key: '$($k.key)',
  suffix: '$sfx',
  positions: $(Format-PositionsJs $bySuffix[$sfx]),
};
"@
        Set-Content -Path (Join-Path $dirPath $fn) -Value $body -Encoding UTF8 -NoNewline
    }

    $importLines = New-Object System.Collections.ArrayList
    $exportNames = New-Object System.Collections.ArrayList
    foreach ($sfx in $SuffixOrder) {
        if (-not $bySuffix.ContainsKey($sfx)) { continue }
        $meta = $SuffixFile[$sfx]
        [void]$importLines.Add("import $($meta.importId) from './$($meta.fileStem)';")
        [void]$exportNames.Add($meta.importId)
    }
    $idx = ($importLines -join "`n") + "`n`nexport default [`n  " + ($exportNames -join ",`n  ") + ",`n];`n"
    Set-Content -Path (Join-Path $dirPath "index.js") -Value $idx -Encoding UTF8 -NoNewline

    $readableMap = @{}
    foreach ($row in $all) {
        $label = DisplayChordName $k.key $k.htmlRoot $row.fullName
        $paren = FretsToParen $row.frets
        $fpair = "$paren f=$($row.fingers)"
        if (-not $readableMap.ContainsKey($label)) { $readableMap[$label] = New-Object "System.Collections.Generic.HashSet[string]" }
        [void]$readableMap[$label].Add($fpair)
    }
    $readableLines = $readableMap.Keys | Sort-Object | ForEach-Object {
        $lab = $_
        $lab = $lab -replace '\(add-sharp9\)', '(add#9)'
        $lab = $lab -replace '\(add-flat9\)', '(addb9)'
        $set = $readableMap[$_]
        $parens = $set | Sort-Object
        "$lab " + ($parens -join ", ")
    }
    $txtName = if ($k.dir -eq "Ab") { "Abchords-readable-$ReadableSuffix.txt" } else { "$($k.dir)chords-readable-$ReadableSuffix.txt" }
    Set-Content -Path (Join-Path $dirPath $txtName) -Value ($readableLines -join "`n") -Encoding UTF8

    Write-Host $k.dir "suffixes" $bySuffix.Count "parsed" $all.Count
}

Write-Host "done"
