# Wrapper: regenerate Double C banjo chord modules from ICDb StaticCharts alt data.
# Reads raw HTML from scripts/icdb-data/banjo-double-c/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-double-c-from-icdb.ps1

& "$PSScriptRoot\generate-icdb-staticcharts.ps1" `
  -InstrumentFolder "banjo-double-c" `
  -ReadableSuffix "doubleCBanjo"
