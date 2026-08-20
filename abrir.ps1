# Levanta la biblioteca en local. El catalogo se lee con fetch, asi que
# abrir index.html a pelo (file://) no funciona: hace falta un servidor.
$puerto = 4173
Start-Process "http://localhost:$puerto/"
python -m http.server $puerto
