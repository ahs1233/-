$ErrorActionPreference = "Stop"

$Repo = "C:\Users\alk\gtg-lab-library-comparison"
$Python = Join-Path $Repo ".venv-research\Scripts\python.exe"
$DataDir = Join-Path $Repo "indicators\gtg-strategy-lab\data"
$Sealer = Join-Path $DataDir "seal_jforex_forward.py"
$Audit = Join-Path $DataDir "audit_forward_seal.py"
$Root = Join-Path $Repo ".lab-data"
$ExportRoot = "C:\Users\alk\gtg-lab-work\captures\jforex_forward"
$CacheRoot = "C:\Users\alk\AppData\Local\Programs\JForex4\.cache"
$Log = Join-Path $Root "forward_seal.log"

New-Item -ItemType Directory -Force -Path $Root | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("o")
Add-Content -Path $Log -Value "[$stamp] START source=JForex-IHistory cache-parity=required"

try {
    Push-Location $DataDir

    $sealOutput = & $Python -u $Sealer --export-root $ExportRoot --cache-root $CacheRoot --root $Root 2>&1 | Out-String
    $sealExit = $LASTEXITCODE
    Add-Content -Path $Log -Value $sealOutput.TrimEnd()
    if ($sealExit -ne 0) {
        throw "seal_jforex_forward.py exit=$sealExit"
    }

    $auditOutput = & $Python -u $Audit --root $Root 2>&1 | Out-String
    $auditExit = $LASTEXITCODE
    Add-Content -Path $Log -Value $auditOutput.TrimEnd()
    if ($auditExit -ne 0) {
        throw "audit_forward_seal.py exit=$auditExit"
    }

    $stamp2 = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -Path $Log -Value "[$stamp2] OK"
    Pop-Location
    exit 0
}
catch {
    try { Pop-Location } catch {}
    $stamp2 = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -Path $Log -Value "[$stamp2] ERROR $($_.Exception.Message)"
    exit 1
}
