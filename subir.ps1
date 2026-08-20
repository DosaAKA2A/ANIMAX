<#
  ANIMAX — sube archivos a la biblioteca.

  El archivo va al bucket R2, NO al repositorio: el repo es publico y el
  contenido no se publica ahi. Este guion lo sube y de paso escribe su ficha en
  el catalogo que vive en el bucket.

  Hace falta el token de administracion. Ponlo una vez por sesion:
      $env:ANIMAX_TOKEN = "..."
  o dejalo que te lo pida.

  Uno suelto:
      .\subir.ps1 -Archivo .\tema.mp3 -Seccion tunes -Grupo temas -Nombre "Tema principal"

  Una carpeta entera:
      .\subir.ps1 -Carpeta C:\...\SVGs\normalizados -Seccion svgs -Grupo formas `
                  -Prefijo "Forma" -Fondo tinta -Etiquetas forma,geometrica

  Ver que hay:
      .\subir.ps1 -Listar
#>
[CmdletBinding(DefaultParameterSetName = "Uno")]
param(
  [Parameter(ParameterSetName = "Uno")]      [string]$Archivo,
  [Parameter(ParameterSetName = "Lote")]     [string]$Carpeta,
  [Parameter(ParameterSetName = "Listar")]   [switch]$Listar,

  [string]$Seccion,
  [string]$Grupo,
  [string]$Nombre,
  [string]$Prefijo = "",
  [string]$Nota = "",
  [ValidateSet("carta", "papel", "tinta")]
  [string]$Fondo = "carta",
  [string[]]$Etiquetas = @(),
  [string]$Id = ""
)

$ErrorActionPreference = "Stop"
$API = "https://animax.studio-iris2026.workers.dev"
$TROZO = 90MB   # cada peticion a un Worker admite ~100 MB de cuerpo

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

function Send-Objeto {
  param([IO.FileInfo]$F, [string]$Key, [hashtable]$Cab)
  $tipo = Get-Tipo $F.Extension
  $u = "$API/api/objeto?key=$([uri]::EscapeDataString($Key))"

  if ($F.Length -le $TROZO) {
    Invoke-RestMethod -Uri $u -Method Put -Headers $Cab -ContentType $tipo -InFile $F.FullName | Out-Null
    return
  }

  # Troceado: un tune largo se pasa del limite de cuerpo de un Worker.
  $crear = Invoke-RestMethod -Uri "$API/api/multipart/create" -Method Post -Headers $Cab `
    -ContentType "application/json" -Body (@{ key = $Key; contentType = $tipo } | ConvertTo-Json)
  $uploadId = $crear.uploadId
  $partes = @()
  $stream = [IO.File]::OpenRead($F.FullName)
  try {
    $n = 1
    $buf = New-Object byte[] $TROZO
    while (($leidos = $stream.Read($buf, 0, $TROZO)) -gt 0) {
      $trozo = New-Object byte[] $leidos
      [Array]::Copy($buf, $trozo, $leidos)
      Write-Host ("    parte {0} ({1:N1} MB)" -f $n, ($leidos / 1MB))
      $pu = "$API/api/multipart/part?key=$([uri]::EscapeDataString($Key))&uploadId=$([uri]::EscapeDataString($uploadId))&part=$n"
      $r = Invoke-RestMethod -Uri $pu -Method Put -Headers $Cab -ContentType "application/octet-stream" -Body $trozo
      $partes += @{ part = $r.part; etag = $r.etag }
      $n++
    }
  }
  catch {
    Invoke-RestMethod -Uri "$API/api/multipart/abort" -Method Post -Headers $Cab `
      -ContentType "application/json" -Body (@{ key = $Key; uploadId = $uploadId } | ConvertTo-Json) | Out-Null
    throw
  }
  finally { $stream.Dispose() }

  Invoke-RestMethod -Uri "$API/api/multipart/complete" -Method Post -Headers $Cab `
    -ContentType "application/json" `
    -Body (@{ key = $Key; uploadId = $uploadId; parts = $partes } | ConvertTo-Json -Depth 4) | Out-Null
}

$token = Get-Token
$cab = @{ Authorization = "Bearer $token" }

if ($Listar) {
  $r = Invoke-RestMethod -Uri "$API/api/listar" -Headers $cab
  if ($r.n -eq 0) { Write-Host "El bucket esta vacio."; exit 0 }
  $r.objetos | ForEach-Object { "{0,-46} {1,10:N0} B  {2}" -f $_.key, $_.tam, $_.fecha }
  Write-Host ""
  Write-Host "$($r.n) archivos."
  exit 0
}

foreach ($p in @("Seccion", "Grupo")) {
  if (-not (Get-Variable $p -ValueOnly)) { throw "Falta -$p." }
}

# --- que archivos hay que subir ---
$lista = @()
if ($Carpeta) {
  if (-not (Test-Path -LiteralPath $Carpeta)) { throw "No existe la carpeta: $Carpeta" }
  $lista = @(Get-ChildItem -LiteralPath $Carpeta -File | Sort-Object Name)
  if (-not $lista.Count) { throw "La carpeta esta vacia: $Carpeta" }
}
else {
  if (-not $Archivo) { throw "Falta -Archivo o -Carpeta." }
  if (-not (Test-Path -LiteralPath $Archivo)) { throw "No existe: $Archivo" }
  if (-not $Nombre) { throw "Falta -Nombre." }
  $lista = @(Get-Item -LiteralPath $Archivo)
}

# --- el catalogo de ahora, una sola vez ---
$cat = Invoke-RestMethod -Uri "$API/catalogo" -Headers $cab
$fichas = @()
if ($cat.fichas) { $fichas = @($cat.fichas) }

$i = 0
foreach ($f in $lista) {
  $i++
  $key = "$Seccion/$($f.Name)"
  $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)

  if ($lista.Count -eq 1 -and $Nombre) { $nom = $Nombre }
  elseif ($Prefijo) {
    $num = ([regex]::Match($base, '\d+')).Value
    if ($num) { $nom = "$Prefijo $num" } else { $nom = "$Prefijo $base" }
  }
  else { $nom = (Get-Culture).TextInfo.ToTitleCase(($base -replace '[-_]+', ' ')) }

  if ($lista.Count -eq 1 -and $Id) { $idf = $Id }
  else { $idf = $base.ToLower() -replace '[^a-z0-9]+', '-' }

  Write-Host ("[{0}/{1}] {2} -> {3}  ({4:N1} KB)" -f $i, $lista.Count, $nom, $key, ($f.Length / 1KB))
  Send-Objeto -F $f -Key $key -Cab $cab

  $fichas = @($fichas | Where-Object { $_.id -ne $idf })
  $fichas += [ordered]@{
    id        = $idf
    nombre    = $nom
    seccion   = $Seccion
    grupo     = $Grupo
    archivo   = $key
    fondo     = $Fondo
    etiquetas = @($Etiquetas)
    nota      = $Nota
  }
}

# --- el catalogo, una sola escritura al final ---
$res = Invoke-RestMethod -Uri "$API/api/catalogo" -Method Put -Headers $cab `
  -ContentType "application/json" -Body (@{ fichas = $fichas } | ConvertTo-Json -Depth 6)

Write-Host ""
Write-Host "Listo. $($lista.Count) subidos. La biblioteca tiene $($res.n) fichas."
