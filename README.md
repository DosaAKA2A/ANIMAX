# Animax

Biblioteca de IRIS Studio. Cuatro secciones, cada una con su enlace propio:

| Seccion        | Carpeta       | Que va aqui                            |
|----------------|---------------|----------------------------------------|
| **Interfaces** | `interfaces/` | Piezas de interfaz en HTML autonomo     |
| **SVGs**       | `svgs/`       | Formas, fondos, iconos y separadores    |
| **Logos**      | `logos/`      | Marcas del estudio y de los proyectos   |
| **Tunes**      | `tunes/`      | Sonidos y musica que compongamos        |

Cada seccion tiene sublinks por grupo, y cada uno es una URL:

```
#/interfaces            toda la seccion
#/interfaces/botones    un grupo dentro de la seccion
#/tunes/ambientes
```

## La regla

**Un archivo por ficha, y ese archivo es lo que se copia.** La web lo lee, lo pinta
en vivo y muestra en el panel lo mismo que te llevas. No hay una version "de ejemplo"
y otra "de verdad", asi que no pueden separarse.

## Como se ve en local

El catalogo se lee con `fetch`, asi que abrir `index.html` a pelo no funciona.

```
.\abrir.ps1
```

Levanta un servidor en `http://localhost:4173/` y abre el navegador.

## Como se agrega una ficha

1. Deja el archivo en la carpeta de su seccion.
2. Anade su entrada al array `fichas` de `catalogo.json`:

```json
{
  "id": "nombre-en-guiones",
  "nombre": "Como se lee",
  "seccion": "interfaces",
  "grupo": "botones",
  "archivo": "interfaces/nombre-en-guiones.html",
  "fondo": "carta",
  "etiquetas": ["boton", "sin-js"],
  "nota": "Que hace y cuando usarla."
}
```

`seccion` y `grupo` tienen que coincidir con los `id` declarados arriba en el mismo
archivo. Los grupos se pueden renombrar, quitar o anadir a gusto: los sublinks salen
de ahi, y el que no tiene nada dentro se ve apagado.

**No hace falta decir de que tipo es.** La extension manda:

| Extension                                   | Que hace la web                                 |
|---------------------------------------------|-------------------------------------------------|
| `.html`                                     | Lo pinta vivo en un iframe. Copia el archivo    |
| `.svg`                                      | Lo pinta. Copia el archivo entero               |
| `.png` `.jpg` `.webp` `.gif` `.avif`        | Lo pinta. Copia la etiqueta `<img>`             |
| `.mp3` `.wav` `.ogg` `.m4a` `.flac` `.opus` | Reproductor propio. Copia la etiqueta `<audio>` |

`fondo` es sobre que material se juzga la ficha: `carta` es el gris neutro, `papel`
el claro y `tinta` el oscuro. Un logo en blanco pide `tinta`. En la mesa de cada
ficha se cambia al vuelo con los tres cuadros de color. Los tunes no lo llevan.

Las piezas de `interfaces/` conviene escribirlas con las clases prefijadas
(`.bs-`, `.te-`...) para que no choquen al pegarlas en otro proyecto.

No hay build, ni dependencias, ni paso de compilacion. Se publica solo con push.

## El sitio

- Fondo: la **carta gris**, el gris neutro con el que se juzga color. Las fichas se
  apoyan directamente sobre el, sin tarjeta y sin sombra, con cuatro marcas de corte
  en las esquinas.
- Al pulsar una ficha, la fila se abre en el sitio: vista previa a un lado y codigo
  al otro. Nada de ventana emergente.
- Tipografia Archivo (variable, con eje de ancho) y JetBrains Mono para el codigo.
- Sin emojis. Sin versalitas. Sin radios.

## Derechos

Repositorio **privado** y licencia **propietaria**: ver `LICENSE`. Cubre por igual el
codigo del sitio y el contenido de la biblioteca, incluidas las composiciones y
grabaciones de `tunes/`, cuyos derechos son de IRIS Studio.

Que el sitio publicado sea accesible no otorga licencia de uso: poder verlo no es
poder usarlo.

**Ojo con `logos/`.** Si guardas marcas de terceros, esas marcas NO son nuestras.
Van en el grupo `terceros`, siguen siendo de sus titulares y quedan fuera de la
licencia. Anotalo en la `nota` de la ficha.

## Atajos

- `/` enfoca el buscador. Buscando se mira **toda** la biblioteca, no solo la seccion abierta
- `Esc` cierra la ficha abierta, o vacia el buscador
