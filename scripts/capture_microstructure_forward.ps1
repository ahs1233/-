$ErrorActionPreference = "Continue"

$Repo = "C:\Users\alk\gtg-lab-library-comparison"
$Python = Join-Path $Repo ".venv-research\Scripts\python.exe"
$Collector = Join-Path $Repo "indicators\gtg-strategy-lab\data\capture_microstructure_forward.py"
$Root = "C:\Users\alk\gtg-lab-data-microstructure"
$PanWatch = "C:\Users\alk\PanWatch"
$Log = Join-Path $Root "collector.log"

New-Item -ItemType Directory -Force -Path $Root | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("o")
Add-Content -Path $Log -Value "[$stamp] START"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $output = & $Python -u $Collector --root $Root --direct-panwatch-repo $PanWatch --timeout 45 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $sw.Stop()
    Add-Content -Path $Log -Value $output.TrimEnd()
    $stamp2 = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -Path $Log -Value "[$stamp2] OK exit=$exitCode elapsed_ms=$($sw.ElapsedMilliseconds)"
    exit $exitCode
}
catch {
    $sw.Stop()
    $stamp2 = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -Path $Log -Value "[$stamp2] ERROR elapsed_ms=$($sw.ElapsedMilliseconds) $($_.Exception.Message)"
    exit 1
}
