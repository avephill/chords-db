# Download ICDb HTML for 5-string banjo D/F# tuning, v=1..4 per key.
# Chart: https://internetchorddatabase.com/ChordCharts/5-String_Banjo_DF_Tuning/
# Output workspace: scripts/icdb-data/banjo-d-f#-tuning/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/download-banjo-d-fsharp-tuning-icdb.ps1

& "$PSScriptRoot\download-icdb.ps1" `
  -InstrumentFolder "banjo-d-f#-tuning" `
  -ChartPath "5-String_Banjo_DF_Tuning"
