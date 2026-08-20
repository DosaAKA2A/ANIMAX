<#
  ANIMAX — sube un archivo a la biblioteca.

  El archivo va al bucket R2, NO al repositorio: el repo es publico y el
  contenido tiene derechos. Este guion lo sube y de paso escribe su ficha en el
  catalogo que vive en el bucket.

  Hace falta el token de administracion. Ponlo una vez por sesion:
      $env:ANIMAX_TOKEN = "..."
  o dejalo que te lo pida.

  Ejemplos:
      .\subir.ps1 -Archivo .\tema.mp3 -Seccion tunes -Grupo temas -Nombre "Tema principal"
      .\subir.ps1 -Archivo .\onda.svg -Seccion svgs -Grupo separadores -Nombre "Onda doble" -Fondo papel
      .\subir.ps1 -Listar
#>
[CmdletBinding()]
param(
  [string]$Archivo,
  [string]$Seccion,
  [string]$Grupo,
  [string]$Nombre,
  [string]$Nota = "",
  [ValidateSet("carta", "papel", "tinta")]
  [string]$Fondo = "carta",
  [string[]]$Etiquetas = @(),
  [string]$Id = "",
  [switch]$Listar
)

$ErrorActionPreference = "Stop"
$API = "https://animax.studio-iris2026.workers.dev"
$TROZO = 90MB   # cada request a un Worker admite ~100 MB de cuerpo

function Get-Token {
  if ($env:ANIMAX_TOKEN) { return $env:ANIMAX_TOKEN.Trim() }
  $s = Read-Host "Token de administracion de Animax" -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Get-Tipo([string]$ext) {
  switch ($ext.ToLower()) {
    ".html" { "text/html; charset=utf-8" }
    ".htm"  { "text/html; charset=utf-8" }
    ".svg"  { "image/svg+xml" }
    ".png"  { "image/png" }
    ".jpg"  { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".webp" { "image/webp" }
    ".gif"  { "image/gif" }
    ".avif" { "image/avif" }
    ".mp3"  { "audio/mpeg" }
    ".wav"  { "audio/wav" }
    ".ogg"  { "audio/ogg" }
    ".m4a"  { "audio/mp4" }
    ".flac" { "audio/flac" }
    ".opus" { "audio/opus" }
    default { "application/octet-stream" }
  }
}

$token = Get-Token
$cab = @{ Authorization = "Bearer $token" }

if ($Listar) {
  $r = Invoke-RestMethod -Uri "$API/api/listar" -Headers $cab
  if ($r.n -eq 0) { Write-Host "El bucket esta vacio."; exit 0 }
  $r.objetos | ForEach-Object {
    "{0,-46} {1,10:N0} B  {2}" -f $_.key, $_.tam, $_.fecha
  }
  exit 0
}

foreach ($p in @("Archivo", "Seccion", "Grupo", "Nombre")) {
  if (-not (Get-Variable $p -ValueOnly)) { throw "Falta -$p. Mira los ejemplos con: Get-Help .\subir.ps1" }
}
if (-not (Test-Path -LiteralPath $Archivo)) { throw "No existe: $Archivo" }

$f = Get-Item -LiteralPath $Archivo
$key = "$Seccion/$($f.Name)"
$tipo = Get-Tipo $f.Extension
if (-not $Id) { $Id = [IO.Path]::GetFileNameWithoutExtension($f.Name).ToLower() -replace '[^a-z0-9]+', '-' }

Write-Host "Subiendo $($f.Name) -> $key  ($('{0:N1}' -f ($f.Length / 1MB)) MB, $tipo)"

if ($f.Length -le $TROZO) {
  Invoke-RestMethod -Uri "$API/api/objeto?key=$([uri]::EscapeDataString($key))" `
    -Method Put -Headers $cab -ContentType $tipo -InFile $f.FullName | Out-Null
}
else {
  # Troceado: un tune largo se pasa del limite de cuerpo de un Worker.
  $crear = Invoke-RestMethod -Uri "$API/api/multipart/create" -Method Post -Headers $cab `
    -ContentType "application/json" -Body (@{ key = $key; contentType = $tipo } | ConvertTo-Json)
  $uploadId = $crear.uploadId
  $partes = @()
  $stream = [IO.File]::OpenRead($f.FullName)
  try {
    $n = 1
    $buf = New-Object byte[] $TROZO
    while (($leidos = $stream.Read($buf, 0, $TROZO)) -gt 0) {
      $trozo = New-Object byte[] $leidos
      [Array]::Copy($buf, $trozo, $leidos)
      Write-Host "  parte $n ($('{0:N1}' -f ($leidos / 1MB)) MB)"
      $u = "$API/api/multipart/part?key=$([uri]::EscapeDataString($key))&uploadId=$([uri]::EscapeDataString($uploadId))&part=$n"
      $r = Invoke-RestMethod -Uri $u -Method Put -Headers $cab -ContentType "application/octet-stream" -Body $trozo
      $partes += @{ part = $r.part; etag = $r.etag }
      $n++
    }
  }
  catch {
    Invoke-RestMethod -Uri "$API/api/multipart/abort" -Method Post -Headers $cab `
      -ContentType "application/json" -Body (@{ key = $key; uploadId = $uploadId } | ConvertTo-Json) | Out-Null
    throw
  }
  finally { $stream.Dispose() }
  Invoke-RestMethod -Uri "$API/api/multipart/complete" -Method Post -Headers $cab `
    -ContentType "application/json" `
    -Body (@{ key = $key; uploadId = $uploadId; parts = $partes } | ConvertTo-Json -Depth 4) | Out-Null
}

# --- la ficha ---
$cat = Invoke-RestMethod -Uri "$API/catalogo" -Headers $cab
$fichas = @()
if ($cat.fichas) { $fichas = @($cat.fichas | Where-Object { $_.id -ne $Id }) }

$ficha = [ordered]@{
  id         = $Id
  nombre     = $Nombre
  seccion    = $Seccion
  grupo      = $Grupo
  archivo    = $key
  fondo      = $Fondo
  etiquetas  = @($Etiquetas)
  nota       = $Nota
}
$fichas += $ficha

$cuerpo = @{ fichas = $fichas } | ConvertTo-Json -Depth 6
$res = Invoke-RestMethod -Uri "$API/api/catalogo" -Method Put -Headers $cab `
  -ContentType "application/json" -Body $cuerpo

Write-Host "Listo. La biblioteca tiene $($res.n) fichas."
