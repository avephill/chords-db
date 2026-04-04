# Download ICDb HTML for 5-string banjo Open G tuning, v=1..4 per key.
# Chart: https://internetchorddatabase.com/ChordCharts/5-String_Banjo_Open_G_Tuning/
# Output workspace: scripts/icdb-data/banjo-open-g/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/download-banjo-open-g-icdb.ps1

& "$PSScriptRoot\download-icdb.ps1" `
  -InstrumentFolder "banjo-open-g" `
  -ChartPath "5-String_Banjo_Open_G_Tuning"
