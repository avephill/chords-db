# Regenerate plecturn 4-string Irish tenor banjo chord modules from ICDb composite sprite tables (4 strings).
# Reads raw HTML from scripts/icdb-data/plecturn-4-string-banjo-irish-tuning/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-plecturn-4-string-banjo-irish-tuning-icdb-composite.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$ChordsRoot = Join-Path $Root "src\db\plecturn-4-string-banjo-irish-tuning\chords"

& "$PSScriptRoot\generate-banjo-icdb-composite.ps1" -InstrumentFolder plecturn-4-string-banjo-irish-tuning -ReadableSuffix irish4Banjo -StringCount 4

$parentIdx = @"
import G from './G';
import C from './C';
import D from './D';
import F from './F';
import A from './A';
import Bb from './Bb';
import B from './B';
import Csharp from './C#';
import Eb from './Eb';
import E from './E';
import Fsharp from './F#';
import Ab from './Ab';

export default { G, C, D, F, A, Bb, B, 'C#': Csharp, Eb, E, 'F#': Fsharp, Ab };
"@
Set-Content -Path (Join-Path $ChordsRoot "index.js") -Value $parentIdx -Encoding UTF8 -NoNewline
