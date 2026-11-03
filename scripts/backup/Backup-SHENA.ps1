# Windows PowerShell 5.1 / PowerShell 7. Aucun secret en argument ou dans Git.
[CmdletBinding()]
param(
  [string]$RestoreImage,
  [string]$RestoreReceipt,
  [string]$OutputDirectory,
  [switch]$AuthorizeDrive,
  [switch]$ConfigureGitHub,
  [switch]$TestConnections,
  [switch]$RestoreLatest,
  [switch]$ShowHelp
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$toolRoot = Join-Path $env:LOCALAPPDATA 'SHENA\backup-tools'
$venv = Join-Path $toolRoot 'venv'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $python)) {
  New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
  if (Get-Command python -ErrorAction SilentlyContinue) { & python -m venv $venv }
  elseif (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -m venv $venv }
  else { throw 'Python 3.12 ou plus récent doit être installé sur cet ordinateur.' }
  if ($LASTEXITCODE -ne 0) { throw "Creation de l'environnement Python impossible." }
}
& $python -c 'import sys; assert sys.version_info >= (3,12)'
if ($LASTEXITCODE -ne 0) { throw 'Python incompatible.' }
& $python -m pip install --disable-pip-version-check -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Installation des dépendances impossible ; ne pas désactiver TLS.' }
# Réutiliser une installation PostgreSQL 17 existante sans installer de service.
$pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\17\bin'
if (Test-Path $pgBin) { $env:PATH = "$pgBin;$env:PATH" }
$arguments = @((Join-Path $PSScriptRoot 'shena_backup.py'))
foreach ($pair in @(@('--restore-image',$RestoreImage), @('--restore-receipt',$RestoreReceipt), @('--output',$OutputDirectory))) {
  if ($pair[1]) { $arguments += @($pair[0],$pair[1]) }
}
if ($AuthorizeDrive) { $arguments += '--authorize-drive' }
if ($ConfigureGitHub) { $arguments += '--configure-github' }
if ($TestConnections) { $arguments += '--test-connections' }
if ($RestoreLatest) { $arguments += '--restore-latest' }
if ($ShowHelp) { $arguments += '--help' }
& $python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Sauvegarde ou validation échouée. Aucune migration ne doit être exécutée.' }
