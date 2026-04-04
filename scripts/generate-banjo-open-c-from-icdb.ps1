# Wrapper: regenerate Open C banjo chord modules from ICDb StaticCharts alt data.
# Note: Open C currently uses composite tables; this wrapper is retained for StaticCharts-only variants.
# Reads raw HTML from scripts/icdb-data/banjo-open-c/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-open-c-from-icdb.ps1

& "$PSScriptRoot\generate-icdb-staticcharts.ps1" `
  -InstrumentFolder "banjo-open-c" `
  -ReadableSuffix "openCBanjo"
