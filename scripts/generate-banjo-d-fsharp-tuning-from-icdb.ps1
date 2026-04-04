# Wrapper: regenerate D/F# banjo chord modules from ICDb StaticCharts alt data.
# Reads raw HTML from scripts/icdb-data/banjo-d-f#-tuning/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-d-fsharp-tuning-from-icdb.ps1

& "$PSScriptRoot\generate-icdb-staticcharts.ps1" `
  -InstrumentFolder "banjo-d-f#-tuning" `
  -ReadableSuffix "dFsharpBanjo"
