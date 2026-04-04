# Download ICDb HTML for Tenor (4-string) Banjo Irish tuning [G,D,A,E], v=1..4 per key.
# Chart: https://internetchorddatabase.com/ChordCharts/Tenor_(4-String)_Banjo_Irish_Tuning/
# Output workspace: scripts/icdb-data/plecturn-4-string-banjo-irish-tuning/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/download-plecturn-4-string-banjo-irish-tuning-icdb.ps1

& "$PSScriptRoot\download-icdb.ps1" `
  -InstrumentFolder "plecturn-4-string-banjo-irish-tuning" `
  -ChartPath "Tenor_(4-String)_Banjo_Irish_Tuning"
