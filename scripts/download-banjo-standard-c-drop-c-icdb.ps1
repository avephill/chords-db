# Download ICDb HTML for 5-string banjo Standard C / Drop C tuning, v=1..4 per key.
# Chart: https://internetchorddatabase.com/ChordCharts/5-String_Banjo_Standard_C__Drop_C_Tuning/
# Output workspace: scripts/icdb-data/banjo-standard-c-drop-c/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/download-banjo-standard-c-drop-c-icdb.ps1

& "$PSScriptRoot\download-icdb.ps1" `
  -InstrumentFolder "banjo-standard-c-drop-c" `
  -ChartPath "5-String_Banjo_Standard_C__Drop_C_Tuning"
