param([string]$sha)
# Extracts the code at $sha (git archive, no checkout) and runs gate 3 of
# indicators/lastgtg/review_1_1/TEST_PREREGISTRATION.md on the existing history feeds.
$r = 'C:\Users\alk\gtg-live\review11'
$w = 'C:\Users\alk\gtg-lab-work'
$node = 'C:\Program Files\nodejs\node.exe'
$out = "$r\gate3"
New-Item -ItemType Directory -Force $out | Out-Null
Set-Content "$r\gate3_status.txt" "start $(Get-Date -Format s) sha=$sha"
git -C $w fetch -q origin claude/gtg-strategy-lab-edge-f0h5ra 2>> "$r\gate3_status.txt"
Remove-Item -Recurse -Force "$r\code" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$r\code" | Out-Null
git -C $w archive --format=tar -o "$r\code.tar" $sha indicators/lastgtg indicators/gtg-strategy-lab 2>> "$r\gate3_status.txt"
tar -xf "$r\code.tar" -C "$r\code" 2>> "$r\gate3_status.txt"
Remove-Item "$r\code.tar"
& $node --max-old-space-size=3000 "$r\code\indicators\lastgtg\review_1_1\js\gate3.mjs" 'C:\Users\alk\gtg-live\history\feeds' $out 'M15,H1,H4,M5' *> "$out\node.log"
Add-Content "$r\gate3_status.txt" "end $(Get-Date -Format s) exit=$LASTEXITCODE"
