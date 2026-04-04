# Wrapper: regenerate G modal / mountain minor banjo chord modules from ICDb StaticCharts alt data.
# Reads raw HTML from scripts/icdb-data/banjo-gmodal-mountain-minor-sawmill/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-gmodal-mountain-minor-from-icdb.ps1

& "$PSScriptRoot\generate-icdb-staticcharts.ps1" `
  -InstrumentFolder "banjo-gmodal-mountain-minor-sawmill" `
  -ReadableSuffix "gModalSawmillBanjo"
