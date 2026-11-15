# Affiche la version sur sa dernière ligne, sans le « v » (0.39.0).
# Elle vit à deux endroits, app\package.json et extension\manifest.json, qui doivent dire la même chose :
# le script refuse s'ils diffèrent.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$racine = Split-Path -Parent $PSScriptRoot

function Lire-Version([string[]]$parties) {
    $chemin = [IO.Path]::Combine([string[]](@($racine) + $parties))
    $relatif = $parties -join '/'
    if (-not (Test-Path -LiteralPath $chemin -PathType Leaf)) { throw "$relatif est introuvable." }
    $version = "$(([IO.File]::ReadAllText($chemin, [Text.Encoding]::UTF8) | ConvertFrom-Json).version)".Trim()
    if ($version -notmatch '\A\d+\.\d+\.\d+\z') { throw "Version introuvable ou mal formée dans $relatif (attendu : X.Y.Z)." }
    return $version
}

$application = Lire-Version @('app', 'package.json')
$extension = Lire-Version @('extension', 'manifest.json')
if ($application -ne $extension) {
    throw "Versions différentes : application $application, extension $extension. Elles doivent être égales."
}
$application
