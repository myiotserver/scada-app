# SCADA Log Archive Cleanup
# Removes archive files older than the current month, keeping only 1 month.
# Usage: powershell -ExecutionPolicy Bypass -File clean_old_archives.ps1 -ArchiveDir "<path>" -CurrentStamp "YYYY-MM"
param(
    [Parameter(Mandatory=$true)][string]$ArchiveDir,
    [Parameter(Mandatory=$true)][string]$CurrentStamp
)
$deleted = 0
# We cannot use -Filter because pm2-out.log.YYYY-MM has multiple dots; PowerShell
# -Filter only matches simple wildcards. Use Where-Object to match the full name.
Get-ChildItem -Path $ArchiveDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^pm2-(out|error)\.log\.\d{4}-\d{2}$' } |
    ForEach-Object {
        if ($_.Name -match '^(pm2-(out|error)\.log)\.(\d{4}-\d{2})$') {
            $stamp = $matches[3]
            if ($stamp -ne $CurrentStamp) {
                Remove-Item -LiteralPath $_.FullName -Force
                Write-Output ('DELETED:' + $_.Name)
                $script:deleted++
            }
        }
    }
Write-Output ('SUMMARY:deleted=' + $deleted)
