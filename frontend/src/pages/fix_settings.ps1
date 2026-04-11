$path = "d:\Projects Deploy Customer\Zaryabimpex.com\frontend\src\pages\Settings.jsx"
$content = Get-Content $path
for ($i = 0; $i -lt $content.Length; $i++) {
    if ($content[$i] -match "^\d+: ") {
        $content[$i] = $content[$i] -replace "^\d+: ", ""
    }
    if ($content[$i] -match "^\d+: ") { # Double check for doubed prefix like 2001: 2001:
        $content[$i] = $content[$i] -replace "^\d+: ", ""
    }
}
$content | Set-Content $path
