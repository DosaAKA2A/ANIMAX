# Animax

Biblioteca de piezas de IRIS Studio. Tres catalogos en la misma web: **piezas** de
interfaz, **formas** SVG y **logos**.

## La regla

**Un archivo por pieza, y ese archivo es lo que se copia.** La web lo lee, lo pinta
en vivo en una vista previa y muestra el mismo texto en el panel de codigo. No hay
una version "de ejemplo" y otra "de verdad", asi que no pueden separarse.

## Como se ve en local

El catalogo se lee con `fetch`, asi que abrir `index.html` a pelo no funciona.

```
.\abrir.ps1
```

Levanta un servidor en `http://localhost:4173/` y abre el navegador.

## Como se agrega una pieza

1. Crea el archivo en `piezas/`, `formas/` o `logos/`.
   - Las piezas son HTML autonomo: su propio `<style>` y su marcado, con las clases
     prefijadas para que no choquen al pegarlas en otro sitio.
   - Las formas y los logos son `.svg` sueltos.
2. Anade la entrada en `catalogo.json`:

```json
{
  "id": "nombre-en-guiones",
  "nombre": "Como se lee",
  "tipo": "pieza | forma | logo",
  "archivo": "piezas/nombre-en-guiones.html",
  "fondo": "carta | papel | tinta",
  "etiquetas": ["boton", "sin-js"],
  "nota": "Que hace y cuando usarla."
}
```

`fondo` es sobre que material se juzga la pieza: `carta` es el gris neutro, `papel`
el claro y `tinta` el oscuro. Un logo en blanco pide `tinta`. En la mesa de cada
pieza puedes cambiarlo al vuelo con los tres cuadros de color.

No hay build, ni dependencias, ni paso de compilacion. Se publica solo con push.

## El sitio

- Fondo: la **carta gris**, el gris neutro con el que se juzga color. Las piezas se
  apoyan directamente sobre el, sin tarjeta y sin sombra, con cuatro marcas de corte
  en las esquinas.
- Tipografia: Archivo (variable, con eje de ancho) y JetBrains Mono para el codigo.
- Sin emojis. Sin versalitas. Sin radios.

## Atajos

- `/` enfoca el buscador
- `Esc` cierra la pieza abierta, o vacia el buscador
