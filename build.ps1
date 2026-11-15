<#
.SYNOPSIS
Compile Aria Plume et pose ce qui est livré dans .work\sortie\.

.DESCRIPTION
Produit, dans .work\sortie\ :
  Aria-Plume-<version>-win-x64.zip        l'application Windows (electron-builder) ; décompressée, elle propose
                                          de s'installer dans %USERPROFILE%\.Aria-Plume\programme
  Aria-Plume-extension-<version>.zip      l'extension, avec LICENSE et LICENCES-TIERS.txt
  <fichier>.sha256                        l'empreinte SHA-256 de chaque fichier (format de sha256sum)

Plus d'exe portable : celui d'Electron se décompresse dans %TEMP% à chaque lancement, ce que le modèle des applis
Aria interdit.

L'extension vient du dernier commit (git archive), pas des fichiers modifiés et non commités. Les dépendances de
l'application doivent être installées (npm ci dans app\). Ne demande pas les droits administrateur. Les versions des
outils vont dans .work\outils.txt.

    .\build.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$racine = $PSScriptRoot
function Chemin([string[]]$parties) { [IO.Path]::Combine([string[]](@($racine) + $parties)) }

$version = "$(& (Chemin @('tools', 'version.ps1')) | Select-Object -Last 1)".Trim()
if ($version -notmatch '\A\d+\.\d+\.\d+\z') { throw "Version inattendue : « $version ». Attendu : X.Y.Z." }

# Node et npx : ceux de .outils\node\ s'ils existent (outils portables), sinon ceux du PATH.
$portable = Chemin @('.outils', 'node')
$npx = [IO.Path]::Combine($portable, 'npx.cmd')
$node = [IO.Path]::Combine($portable, 'node.exe')
if (-not (Test-Path -LiteralPath $npx -PathType Leaf)) {
    $commande = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $commande) { throw "npx est introuvable : ni .outils\node\npx.cmd, ni npx dans le PATH." }
    $npx = $commande.Source
    $node = (Get-Command node).Source
}
elseif ($env:PATH -notlike "*$portable*") {
    # npx.cmd lance le node de son dossier, electron-builder appelle « node » : le dossier portable passe devant.
    $env:PATH = "$portable$([IO.Path]::PathSeparator)$env:PATH"
}
if (-not (Test-Path -LiteralPath (Chemin @('app', 'node_modules')) -PathType Container)) {
    throw "Les dépendances de l'application manquent : lance « npm ci » dans app\."
}

$work = Chemin @('.work')
$sortie = Chemin @('.work', 'sortie')
# Une jonction à la place de .work ou de .work\sortie mènerait la suppression qui suit hors du dépôt.
foreach ($d in $work, $sortie) {
    if ((Test-Path -LiteralPath $d) -and ((Get-Item -LiteralPath $d -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "$d est un lien ou une jonction : rien n'est supprimé. Retire-le, puis relance."
    }
}
if (Test-Path -LiteralPath $sortie) { Remove-Item -LiteralPath $sortie -Recurse -Force }
New-Item -ItemType Directory -Path $sortie -Force | Out-Null

# Application Windows.
Push-Location -LiteralPath (Chemin @('app'))
try {
    # Sous PowerShell 5.1, une sortie d'erreur redirigée arrêterait le script : on lit le code de retour.
    $ErrorActionPreference = 'Continue'
    & $npx electron-builder --win --x64 --publish never
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
}
finally { Pop-Location }
if ($code -ne 0) { throw "La compilation de l'application a échoué (electron-builder, code $code)." }
foreach ($nom in @("Aria-Plume-$version-win-x64.zip")) {
    $fichier = Chemin @('app', 'dist', $nom)
    if (-not (Test-Path -LiteralPath $fichier -PathType Leaf)) { throw "$nom est absent de app\dist\ après la compilation." }
    Copy-Item -LiteralPath $fichier -Destination $sortie
}

# Extension : le dossier extension\ du dernier commit, plus les licences, que la GPL-3.0 et la MPL-2.0 exigent à
# côté de chaque copie (elles vivent à la racine du dépôt, hors de extension\).
$zipExtension = [IO.Path]::Combine($sortie, "Aria-Plume-extension-$version.zip")
$ErrorActionPreference = 'Continue'
& git -C $racine archive --format=zip --prefix=extension/ -o $zipExtension HEAD:extension
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($code -ne 0) { throw "git archive a échoué (code $code)." }
# Sous PowerShell 5.1, les deux bibliothèques du zip doivent être chargées à la main.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($zipExtension, [IO.Compression.ZipArchiveMode]::Update)
try {
    foreach ($licence in 'LICENSE', 'LICENCES-TIERS.txt') {
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Chemin @($licence)), "extension/$licence")
    }
}
finally { $archive.Dispose() }

$ErrorActionPreference = 'Continue'
$versionNode = "$(& $node --version 2>$null)".Trim()
$ErrorActionPreference = 'Stop'
$electron = "$((([IO.File]::ReadAllText((Chemin @('app', 'package.json')), [Text.Encoding]::UTF8) | ConvertFrom-Json).devDependencies.electron))"
[IO.File]::WriteAllLines((Chemin @('.work', 'outils.txt')), [string[]]@("Node : $versionNode", "Electron : $electron"), (New-Object Text.UTF8Encoding($false)))

# Empreinte SHA-256 de chaque fichier, au format de sha256sum (« <empreinte>  <nom> ») : l'application installée
# la vérifie avant d'installer une mise à jour.
foreach ($fichier in @(Get-ChildItem -LiteralPath $sortie -File | Where-Object { $_.Extension -ne '.sha256' })) {
    $empreinte = (Get-FileHash -LiteralPath $fichier.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$($fichier.FullName).sha256", "$empreinte  $($fichier.Name)`n", (New-Object Text.UTF8Encoding($false)))
}

Get-ChildItem -LiteralPath $sortie | ForEach-Object { Write-Host ("Prêt : {0} ({1} Mo)" -f $_.Name, [math]::Round($_.Length / 1MB, 1)) }
