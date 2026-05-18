param(
    [Parameter(Mandatory)] [int] $Seat,
    [Parameter(Mandatory)] [ValidateRange(0,1)] [int] $Status
)

$payload = '{"id_kursi":' + $Seat + ',"status":' + $Status + '}'
$tmp = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tmp, $payload, [System.Text.Encoding]::ASCII)
    mosquitto_pub -h vokafe.duckdns.org -p 1884 -t "vokafe/iot/telemetry" -f $tmp
    Write-Host "Sent: $payload"
} finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
