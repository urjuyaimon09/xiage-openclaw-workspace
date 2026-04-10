$skills = @(
    "charon-fan/self-improving-agent",
    "obra/brainstorming",
    "obra/systematic-debugging",
    "obra/receiving-code-review",
    "obra/verification-before-completion",
    "anthropics/pdf",
    "anthropics/xlsx",
    "anthropics/docx",
    "anthropics/skill-creator",
    "oswalpalash/ontology",
    "ide-rea/baidu-search"
)

foreach ($skill in $skills) {
    Write-Host "=== Installing $skill ===" -ForegroundColor Cyan
    npx clawhub install $skill --force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $skill installed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ $skill failed with exit code $LASTEXITCODE" -ForegroundColor Red
    }
    Write-Host ""
}
