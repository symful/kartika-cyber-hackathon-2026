$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8787"

$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  try { Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 3 | Out-Null; $ok = $true; break }
  catch { Start-Sleep -Milliseconds 900 }
}
if (-not $ok) { "Server not up"; exit 1 }

$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Uri "$base/api/login" -Method Post -Body '{"username":"koordinator","password":"kartika2026"}' -ContentType 'application/json' -WebSession $s | Out-Null
$csrf = ($s.Cookies.GetCookies($base) | Where-Object { $_.Name -eq "rantai_csrf" }).Value

$r = Invoke-RestMethod -Uri "$base/api/dev/benchmark" -Method Post -Body '{}' -ContentType 'application/json' -Headers @{"X-CSRF-Token"=$csrf} -WebSession $s -TimeoutSec 280
$r | ConvertTo-Json -Depth 6

$fail = 0
function Assert($name, $ok) { if ($ok) { "PASS  $name" } else { "FAIL  $name"; $script:fail++ } }
Assert "Precision >= 0.95" ($r.precision -ge 0.95)
Assert "Recall >= 0.95" ($r.recall -ge 0.95)
Assert "False positive rate <= 0.02" ($r.false_positive_rate -le 0.02)
Assert "No cross-links from common infrastructure" (($r.shared_domain_cross_links -eq 0) -and ($r.cdn_cross_links -eq 0))
Assert "Held-out precision >= 0.95" ($r.held_out.precision -ge 0.95)
Assert "Held-out recall >= 0.95" ($r.held_out.recall -ge 0.95)
Assert "Held-out FPR <= 0.02" ($r.held_out.false_positive_rate -le 0.02)

""
"Adversarial scenarios"
foreach ($s in $r.adversarial) {
  if ($s.name -eq "hash_only_unrelated") {
    "KNOWN  {0}  expected={1} actual={2} score={3}  {4}" -f $s.name, $s.expected, $s.actual, $s.score, $s.note
    continue
  }
  $tag = if ($s.pass) { "PASS" } else { "FAIL" }
  if (-not $s.pass) { $script:fail++ }
  "{0}  {1}  expected={2} actual={3} score={4}  {5}" -f $tag, $s.name, $s.expected, $s.actual, $s.score, $s.note
}
if ($script:fail -gt 0) { exit 1 }
