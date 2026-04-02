# Wrapper: regenerate Standard C / Drop C banjo chord modules from ICDb composite HTML.
# Run from repo root: powershell -File scripts/generate-banjo-standard-c-drop-c-icdb-composite.ps1

& "$PSScriptRoot\generate-banjo-icdb-composite.ps1" -InstrumentFolder banjo-standard-c-drop-c -ReadableSuffix standardCDropCBanjo
