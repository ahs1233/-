$ErrorActionPreference = "Stop"

$Repo = "C:\Users\alk\gtg-lab-library-comparison"
$Python = Join-Path $Repo ".venv-research\Scripts\python.exe"
$DataDir = Join-Path $Repo "indicators\gtg-strategy-lab\data"
$GTG = Join-Path $Repo "indicators\gtg-strategy-lab\gtglab2"
$MicroRoot = "C:\Users\alk\gtg-lab-data-microstructure"
$ForwardRoot = Join-Path $Repo ".lab-data"
$ExportRoot = "C:\Users\alk\gtg-lab-work\captures\jforex_forward"
$CacheRoot = "C:\Users\alk\AppData\Local\Programs\JForex4\.cache"
$Log = Join-Path $ForwardRoot "gtglab2_gate_audit.log"

New-Item -ItemType Directory -Force -Path $ForwardRoot | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("o")
Add-Content -Path $Log -Value "[$stamp] START GTGLab2 research gate audit"

try {
    Push-Location $Repo
    & $Python (Join-Path $DataDir "microstructure_forward_readiness.py") --root $MicroRoot --out (Join-Path $GTG "MICROSTRUCTURE_READINESS_LATEST.json") *> $null
    $microExit = $LASTEXITCODE
    & $Python (Join-Path $DataDir "audit_forward_seal.py") --root $ForwardRoot --out (Join-Path $GTG "FORWARD_SEAL_AUDIT_LATEST.json") *> $null
    $auditExit = $LASTEXITCODE
    & $Python (Join-Path $DataDir "seal_jforex_forward.py") --export-root $ExportRoot --cache-root $CacheRoot --root $ForwardRoot --out (Join-Path $GTG "FORWARD_SEAL_STATUS_LATEST.json") *> $null
    $sealExit = $LASTEXITCODE
    & $Python (Join-Path $GTG "tools\forward_gatekeeper.py") --micro (Join-Path $GTG "MICROSTRUCTURE_READINESS_LATEST.json") --audit (Join-Path $GTG "FORWARD_SEAL_AUDIT_LATEST.json") --seal (Join-Path $GTG "FORWARD_SEAL_STATUS_LATEST.json") --registry (Join-Path $GTG "CANDIDATE_REGISTRY.json") --out (Join-Path $GTG "FORWARD_GATE_STATUS_LATEST.json") *> $null
    $gateExit = $LASTEXITCODE
    $stamp2 = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -Path $Log -Value "[$stamp2] micro=$microExit audit=$auditExit seal=$sealExit gate=$gateExit"
    if ($microExit -ne 0 -or $auditExit -ne 0) { throw "integrity/readiness audit failure micro=$microExit audit=$auditExit" }
    Pop-Location
    exit 0
}
catch {
    try { Pop-Location } catch {}
    $stamp2 = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -Path $Log -Value "[$stamp2] ERROR $($_.Exception.Message)"
    exit 1
}
