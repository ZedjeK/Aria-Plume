<#
.SYNOPSIS
Lance les tests d'Aria Plume : banc du moteur, robustesse, puis tests de l'application.

.DESCRIPTION
Ce que fait la CI (job « tests »). Tous les tests tournent, même après un échec ; le code de retour est non nul si
un seul a échoué.

    .\tools\tester.ps1                tout (sous Windows : le moteur seulement, voir plus bas)
    .\tools\tester.ps1 -Moteur        le moteur seulement (ni Electron ni Chromium)
    .\tools\tester.ps1 -Application   sous Windows, lance aussi les tests de l'application

Les tests de l'application sont écrits pour Linux, où tourne la CI : ils vérifient des droits de fichiers Unix et
lancent un script shell. Sous Windows, ils sont sautés (et le script le dit), sauf avec -Application.

Node : celui de .outils\node\ s'il existe (outils portables), sinon celui du PATH. Les tests de l'application
demandent ses dépendances (npm ci dans app\) et, pour le complément Office, le Chromium de Playwright
(npx playwright install chromium).
#>
[CmdletBinding()]
param(
    [switch]$Moteur,
    [switch]$Application
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$racine = Split-Path -Parent $PSScriptRoot
function Chemin([string[]]$parties) { [IO.Path]::Combine([string[]](@($racine) + $parties)) }

$node = Chemin @('.outils', 'node', 'node.exe')
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) {
    $commande = Get-Command node -ErrorAction SilentlyContinue
    if (-not $commande) { throw "Node est introuvable : ni .outils\node\node.exe, ni node dans le PATH." }
    $node = $commande.Source
}

$echecs = New-Object Collections.Generic.List[string]

function Lancer([string]$dossier, [string]$fichier) {
    Write-Host "== $fichier" -ForegroundColor Cyan
    Push-Location -LiteralPath $dossier
    try {
        # Sous PowerShell 5.1, une sortie d'erreur de node redirigée arrêterait le script : on lit son code de retour.
        $ErrorActionPreference = 'Continue'
        & $node $fichier
        $code = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
    }
    finally { Pop-Location }
    if ($code -ne 0) {
        Write-Host "ÉCHEC : $fichier (code $code)" -ForegroundColor Red
        $script:echecs.Add($fichier)
    }
}

# Moteur : mêmes commandes que la CI, depuis la racine du dépôt.
foreach ($test in 'tests/node/smoke.mjs', 'tests/node/chemins.mjs', 'tests/bench/run.mjs', 'tests/bench/robustesse.mjs') {
    Lancer $racine $test
}
# Rangement du dossier de données : Node seul, sans Electron ni dépendance, donc aussi sous Windows.
if (-not $Moteur) {
    foreach ($test in 'tests/donnees.mjs', 'tests/installation.mjs', 'tests/miseajour.mjs', 'tests/empaquetage.mjs', 'tests/secrets.mjs', 'tests/icone.mjs') { Lancer (Chemin @('app')) $test }
}

$windows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
if (-not $Moteur -and $windows -and -not $Application) {
    Write-Host "== Tests de l'application : sautés sous Windows (écrits pour Linux, lancés par la CI). -Application pour les lancer quand même." -ForegroundColor Yellow
}
elseif (-not $Moteur) {
    $app = Chemin @('app')
    if (-not (Test-Path -LiteralPath (Chemin @('app', 'node_modules')) -PathType Container)) {
        throw "Les dépendances de l'application manquent : lance « npm ci » dans app\, ou relance avec -Moteur."
    }
    foreach ($test in 'tests/bridge.mjs', 'tests/office.mjs', 'tests/office-word.mjs', 'tests/office-outlook.mjs', 'tests/registry.mjs', 'tests/updates.mjs') {
        Lancer $app $test
    }
}

if ($echecs.Count -gt 0) {
    Write-Host "$($echecs.Count) test(s) en échec : $($echecs -join ', ')." -ForegroundColor Red
    exit 1
}
Write-Host "Tous les tests passent." -ForegroundColor Cyan
exit 0
