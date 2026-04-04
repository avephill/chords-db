# Download ICDb HTML for 5-string banjo Double C tuning, v=1..4 per key.
# Output workspace: scripts/icdb-data/banjo-double-c/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/download-banjo-double-c-icdb.ps1

& "$PSScriptRoot\download-icdb.ps1" `
  -InstrumentFolder "banjo-double-c" `
  -ChartPath "5-String_Banjo_Double_C_Tuning" `
  -Ct "1,2,3,5,15,16,6,7,4,8,9,10,11,19,20,21,22,23,27,28,12,13,14,17,18,24,25,26,32,29,30,33,34,40,31,35,36,37,38,39,41"
