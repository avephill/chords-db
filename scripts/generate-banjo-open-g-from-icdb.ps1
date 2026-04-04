# Wrapper: regenerate Open G banjo chord modules from ICDb StaticCharts alt data.
# Reads raw HTML from scripts/icdb-data/banjo-open-g/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-open-g-from-icdb.ps1

& "$PSScriptRoot\generate-icdb-staticcharts.ps1" `
  -InstrumentFolder "banjo-open-g" `
  -ReadableSuffix "openGBanjo"
