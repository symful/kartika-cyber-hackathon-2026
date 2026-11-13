$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8787"
$script:passed = 0
$script:fail = 0

function Check($name, $ok, $detail) {
  if ($ok) { $script:passed++; "PASS  $name" }
  else { $script:fail++; "FAIL  $name  $detail" }
}

function Login($user) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = '{"username":"' + $user + '","password":"kartika2026"}'
  Invoke-RestMethod -Uri "$base/api/login" -Method Post -Body $body -ContentType 'application/json' -WebSession $s | Out-Null
  $csrf = ($s.Cookies.GetCookies($base) | Where-Object { $_.Name -eq "rantai_csrf" }).Value
  return @{ Session = $s; Csrf = $csrf }
}

function Status($ctx, $method, $path, $body) {
  $headers = @{}
  if ($ctx.Csrf) { $headers["X-CSRF-Token"] = $ctx.Csrf }
  $params = @{ Uri = "$base$path"; Method = $method; WebSession = $ctx.Session; UseBasicParsing = $true; Headers = $headers }
  if ($body) { $params.Body = $body; $params.ContentType = "application/json" }
  try { return (Invoke-WebRequest @params).StatusCode } catch { return $_.Exception.Response.StatusCode.value__ }
}

function Json($ctx, $method, $path, $body) {
  $headers = @{}
  if ($ctx.Csrf) { $headers["X-CSRF-Token"] = $ctx.Csrf }
  $params = @{ Uri = "$base$path"; Method = $method; WebSession = $ctx.Session; Headers = $headers }
  if ($body) { $params.Body = $body; $params.ContentType = "application/json" }
  try { return Invoke-RestMethod @params }
  catch { throw ("$method $path -> " + $_.Exception.Response.StatusCode.value__) }
}

$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  try { Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 3 | Out-Null; $ok = $true; break }
  catch { Start-Sleep -Milliseconds 900 }
}
if (-not $ok) { "Server not up"; exit 1 }

$alpha = Login "alpha"
$bravo = Login "bravo"
$koord = Login "koordinator"

$list = Json $alpha "GET" "/api/incidents"
$idA = ($list.incidents | Where-Object { $_.code -eq "INC-2026-001" }).id
$detailA = Json $alpha "GET" ("/api/incidents/" + $idA)
$art = $detailA.artifacts[0].id
$art2 = $detailA.artifacts[1].id
$ind = ($detailA.indicators | Where-Object { $_.kind -eq "sha256" } | Select-Object -First 1).id
Json $alpha "POST" ("/api/artifacts/" + $art2 + "/share") '{"scope":"restricted"}' | Out-Null

# --- authorization on mutations ---
Check "Bravo cannot change Alpha incident status" ((Status $bravo "PATCH" ("/api/incidents/" + $idA + "/status") '{"status":"closed"}') -eq 403) ""
Check "Bravo cannot change Alpha indicator lifecycle" ((Status $bravo "PATCH" ("/api/indicators/" + $ind + "/lifecycle") '{"status":"benign"}') -eq 403) ""
Check "Bravo cannot record custody on Alpha artifact" ((Status $bravo "POST" ("/api/artifacts/" + $art + "/custody") '{"action":"note","note":"x"}') -eq 403) ""
Check "Bravo cannot rotate signing key" ((Status $bravo "POST" "/api/checkpoints/rotate" '{"confirm":"ROTATE"}') -eq 403) ""

# --- evidence access ---
Check "Bravo denied before approval" ((Status $bravo "GET" ("/api/artifacts/" + $art + "/download")) -eq 403) ""
$body = '{"artifact_id":"' + $art + '","scope":"raw","reason":"forensic review"}'
Json $bravo "POST" "/api/access-requests" $body | Out-Null
$pending = (Json $koord "GET" ("/api/access-requests?incident=" + $idA)).requests | Select-Object -First 1
Json $koord "POST" ("/api/access-requests/" + $pending.id + "/decide") '{"status":"approved"}' | Out-Null
Check "Bravo allowed after approval" ((Status $bravo "GET" ("/api/artifacts/" + $art + "/download")) -eq 200) ""

$body2 = '{"artifact_id":"' + $art2 + '","scope":"raw","reason":"expired test"}'
Json $bravo "POST" "/api/access-requests" $body2 | Out-Null
$pending2 = (Json $koord "GET" ("/api/access-requests?incident=" + $idA)).requests | Where-Object { $_.artifact_id -eq $art2 } | Select-Object -First 1
Json $koord "POST" ("/api/access-requests/" + $pending2.id + "/decide") '{"status":"approved","ttl_days":-1}' | Out-Null
Check "Expired approval is not reusable" ((Status $bravo "GET" ("/api/artifacts/" + $art2 + "/download")) -eq 403) ""

Json $koord "PATCH" ("/api/incidents/" + $idA + "/tlp") '{"tlp":"red"}' | Out-Null
$redRead = Status $bravo "GET" ("/api/incidents/" + $idA)
$redReport = Status $bravo "GET" ("/api/report/" + $idA + "?format=json")
Json $koord "PATCH" ("/api/incidents/" + $idA + "/tlp") '{"tlp":"amber"}' | Out-Null
Check "TLP:RED blocks cross-unit detail" ($redRead -eq 403) $redRead
Check "TLP:RED blocks cross-unit report export" ($redReport -eq 403) $redReport

# --- report redaction under AMBER ---
$report = Json $bravo "GET" ("/api/report/" + $idA + "?format=json")
$reportHasRestricted = @($report.artifacts | Where-Object { $_.id -eq $art2 }).Count -gt 0
Check "Report excludes restricted artifacts" (-not $reportHasRestricted) ("artifacts=" + $report.artifacts.Count)
Check "Report excludes unshared indicators" ($report.indicators.Count -lt $detailA.indicators.Count) ("inds=" + $report.indicators.Count)

# --- CSRF and sessions ---
$noCsrf = @{ Session = $bravo.Session; Csrf = $null }
Check "Mutation without CSRF rejected" ((Status $noCsrf "PATCH" ("/api/incidents/" + $idA + "/status") '{"status":"open"}') -eq 403) ""

$b2 = Login "bravo"
Json $b2 "POST" "/api/logout" "{}" | Out-Null
Check "Revoked session is rejected" ((Status $b2 "GET" "/api/incidents") -eq 401) ""

# --- rate limit ---
$codes = @()
for ($i = 0; $i -lt 6; $i++) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try { Invoke-WebRequest -Uri "$base/api/login" -Method Post -Body '{"username":"nobody","password":"wrong"}' -ContentType 'application/json' -WebSession $s -UseBasicParsing | Out-Null; $codes += 200 }
  catch { $codes += $_.Exception.Response.StatusCode.value__ }
}
Check "Login rate limit returns 429" ($codes -contains 429) ($codes -join ",")

# --- correlation ---
$cors = (Json $alpha "GET" "/api/correlations").correlations
$ab = $cors | Where-Object { ($_.a.code -eq "INC-2026-002" -and $_.b.code -eq "INC-2026-001") -or ($_.a.code -eq "INC-2026-001" -and $_.b.code -eq "INC-2026-002") }
$dd = $cors | Where-Object { $_.a.code -eq "INC-2026-004" -or $_.b.code -eq "INC-2026-004" }
Check "Related incidents correlate strongly" ($ab -and $ab.score -ge 70) ""
Check "Unrelated DDoS stays uncorrelated" (-not $dd) ""

# --- custody and integrity ---
$passport = Json $alpha "GET" ("/api/artifacts/" + $art + "/passport")
Check "Custody chain verifies" ($passport.chain_ok -eq $true) ""

$koord2 = Login "koordinator"
$alpha2 = Login "alpha"
Json $koord2 "POST" "/api/dev/tamper-artifact" ('{"artifact_id":"' + $art + '"}') | Out-Null
$tampered = Json $alpha2 "GET" ("/api/artifacts/" + $art + "/passport")
Json $koord2 "POST" "/api/dev/tamper-artifact" ('{"artifact_id":"' + $art + '","restore":true}') | Out-Null
Check "Modified artifact fails verification" ($tampered.artifact.verified -eq $false) ""

$cp = (Json $koord2 "GET" "/api/checkpoints").checkpoints | Select-Object -First 1
Json $koord2 "POST" "/api/dev/tamper-checkpoint" ('{"id":"' + $cp.id + '"}') | Out-Null
$bad = Json $koord2 "GET" "/api/audit/verify"
Json $koord2 "POST" "/api/dev/tamper-checkpoint" ('{"id":"' + $cp.id + '","restore":true}') | Out-Null
Check "Invalid checkpoint signature detected" ($bad.checkpoints.ok -eq $false) ""

$export = Json $koord "GET" "/api/checkpoints/export"
Check "Checkpoint export available to coordinator" ($export.checkpoints -ne $null) ""
Check "Checkpoint export denied to analyst" ((Status $bravo "GET" "/api/checkpoints/export") -eq 403) ""

# --- rotation safeguards ---
Check "Rotation requires explicit confirmation" ((Status $koord "POST" "/api/checkpoints/rotate" '{}') -eq 400) ""

# --- bundle and static analysis ---
$bundle = Json $alpha "POST" "/api/export/bundle"
$unshared = ($detailA.indicators | Where-Object { -not $_.shared } | Select-Object -First 1)
$bundleHasUnshared = $false
if ($unshared) {
  $bundleHasUnshared = @($bundle.bundle.indicators | Where-Object { $_.norm -eq $unshared.norm_value }).Count -gt 0
}
Check "Bundle exports shared indicators only" ($bundle.bundle.indicators.Count -gt 0 -and -not $bundleHasUnshared -and $bundle.signature) ("n=" + $bundle.bundle.indicators.Count)

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$ms = New-Object System.IO.MemoryStream
$zip = New-Object System.IO.Compression.ZipArchive($ms, [System.IO.Compression.ZipArchiveMode]::Create)
for ($i = 0; $i -lt 250; $i++) {
  $entry = $zip.CreateEntry("f$i.txt")
  $st = $entry.Open(); $wr = New-Object System.IO.StreamWriter($st); $wr.Write("x"); $wr.Dispose(); $st.Dispose()
}
$zip.Dispose()
$b64 = [Convert]::ToBase64String($ms.ToArray())
$bomb = Json $koord "POST" "/api/dev/analyze" ('{"filename":"bomb.zip","base64":"' + $b64 + '"}')
$hasBomb = @($bomb.analysis.rules | Where-Object { $_.rule -eq "archive_bomb" }).Count -gt 0
Check "ZIP bomb is rejected by archive limits" $hasBomb ("verdict=" + $bomb.analysis.verdict)

""
"RESULT: $script:passed passed, $script:fail failed"
if ($script:fail -gt 0) { exit 1 }
