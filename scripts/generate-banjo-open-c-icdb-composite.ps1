# Wrapper: regenerate Open C banjo chord modules from ICDb composite HTML.
# Reads raw HTML from scripts/icdb-data/banjo-open-c/<Key>/_raw_v*.html
# Run from repo root: powershell -File scripts/generate-banjo-open-c-icdb-composite.ps1

& "$PSScriptRoot\generate-banjo-icdb-composite.ps1" -InstrumentFolder banjo-open-c -ReadableSuffix openCBanjo
