# Wrapper: regenerate Standard C / Drop C banjo chord modules from ICDb StaticCharts alt data.
# Note: Standard C / Drop C currently uses composite tables; this wrapper is retained for StaticCharts-only variants.
# Reads raw HTML from scripts/icdb-data/banjo-standard-c-drop-c/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-standard-c-drop-c-from-icdb.ps1

& "$PSScriptRoot\generate-icdb-staticcharts.ps1" `
  -InstrumentFolder "banjo-standard-c-drop-c" `
  -ReadableSuffix "standardCDropCBanjo"
