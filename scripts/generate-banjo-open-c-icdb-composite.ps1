# Wrapper: regenerate Open C banjo chord modules from ICDb composite HTML.
# Run from repo root: powershell -File scripts/generate-banjo-open-c-icdb-composite.ps1

& "$PSScriptRoot\generate-banjo-icdb-composite.ps1" -InstrumentFolder banjo-open-c -ReadableSuffix openCBanjo
