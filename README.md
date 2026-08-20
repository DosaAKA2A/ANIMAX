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

## Donde vive cada cosa

**Este repositorio es publico y solo lleva el armazon.** El contenido no entra aqui.

| | Donde vive | Quien lo ve |
|---|---|---|
| Codigo del sitio y **secciones** | este repo | cualquiera |
| **Fichas y archivos** (piezas, SVGs, logos, tunes) | bucket R2 `animax` | solo con pase |

El bucket no tiene URL publica. Todo lo sirve el worker
`animax.studio-iris2026.workers.dev`, que pide un token firmado con caducidad de una
semana. Por eso un archivo de `tunes/` no se puede bajar aunque alguien adivine la
ruta: **no existe ruta que valga sin token**.

Eso es lo que distingue esto de un pase escrito en JavaScript, que solo esconde la
interfaz mientras los archivos siguen descargandose por su URL.

## La regla

**Un archivo por ficha, y ese archivo es lo que se copia.** La web lo pide al worker,
lo pinta en vivo y muestra en el panel lo mismo que te llevas. No hay una version "de
ejemplo" y otra "de verdad", asi que no pueden separarse.

## Como se ve en local

```
.\abrir.ps1
```

Levanta un servidor en `http://localhost:4173/` y abre el navegador. Abrir
`index.html` a pelo no funciona: el navegador no deja leer archivos por `file://`.

Local o publicado da igual, la biblioteca pide el pase en los dos sitios: el
contenido siempre viene del worker.

### Ver una ficha antes de subirla

`http://localhost:4173/?local=1` salta el pase, lee las fichas de
`catalogo.local.json` (que no se versiona) y busca los archivos por ruta relativa
dentro de las carpetas de seccion. Sirve para maquetar y para mirar como queda algo
antes de que entre al bucket. El contenido de verdad nunca se sirve asi.

## Como se agrega una ficha

Con `subir.ps1`. Sube el archivo al bucket y escribe su ficha de una vez:

El token de administracion se busca en tres sitios, por este orden: la variable
`$env:ANIMAX_TOKEN`, el archivo `.animax-token` en la raiz (que `.gitignore` bloquea)
y, si no hay ninguno, te lo pide por teclado.

```powershell
$env:ANIMAX_TOKEN = "..."        # una vez por sesion

.\subir.ps1 -Archivo .\tema.mp3 -Seccion tunes -Grupo temas -Nombre "Tema principal"
.\subir.ps1 -Archivo .\onda.svg -Seccion svgs -Grupo separadores -Nombre "Onda doble" -Fondo papel
.\subir.ps1 -Listar              # que hay en el bucket
```

Opcionales: `-Nota`, `-Etiquetas a,b`, `-Fondo carta|papel|tinta`, `-Id`. Si repites
un `-Id` se reemplaza la ficha, asi que sirve para corregir.

Los tunes grandes se trocean solos: un Worker admite ~100 MB por peticion y R2 une
las partes.

**Las secciones y sus grupos si viven en el repo**, en `catalogo.json`, porque son
estructura y no contenido con derechos. Renombralos, quitalos o anade los que quieras:
los sublinks salen de ahi, y el grupo que no tiene nada dentro se ve apagado.

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

Animax habla el idioma de IRIS, MOOVIN y Naviris:

- Base casi negra con tres niveles de superficie (`#08080a`, `#101013`, `#17171b`) y
  bordes de un pixel en blanco translucido.
- **Un solo acento cromatico: ambar `#e8b04b`.** Violeta es de IRIS, rojo de MOOVIN y
  lima de Naviris; cada casa tiene el suyo.
- Inter para la interfaz y **Geist Mono** para las micro-etiquetas, con tracking
  abierto, igual que la etiqueta roja de MOOVIN.
- Cabecera con el patron de MOOVIN: la marca de IRIS lleva al estudio, y la etiqueta
  de la casa dice donde estas. Barra fija con vidrio real.
- Radios 8 / 12 / 16 / 999, los de Naviris.
- **La seccion SVGs va a lo shapes.gallery**, con su geometria medida del DOM:
  baldosa cuadrada, radio al 12 % del lado y la forma dentro al 45 %. Las formas se
  pintan **en linea, no como `<img>`**, para que el `fill="currentColor"` tome el
  color de la baldosa. El nombre sale al pasar por encima: no compite con la forma.
- Al pulsar una ficha la fila se abre en el sitio: vista previa a un lado y codigo al
  otro. Nada de ventana emergente.
- El gris, el papel y la tinta no son la pagina: son los tres **materiales** sobre los
  que se juzga una ficha, y viven dentro del visor.
- Los scroll son siempre los nuestros. Sin emojis y sin versalitas.

## Un SVG se lleva de cuatro maneras

Cualquier ficha `.svg` — una forma o un logo — abre con cuatro botones: **Copiar SVG**,
**Copiar PNG**, **Descargar SVG** y **Descargar PNG**. El PNG se dibuja en el navegador,
no en el worker: sale con **fondo transparente** y **2048 px de lado largo**.

Encima esta el interruptor de **color**, con tres posiciones:

| | que hace |
|---|---|
| **De origen** | el archivo tal cual, byte por byte |
| **Blanco** | todo lo que se pinta, a `#ffffff` |
| **Negro** | todo lo que se pinta, a `#000000` |

Lo que se copia y lo que se baja siempre es lo que se esta viendo, y el nombre lo dice:
`arc-blanco.png`. Tres detalles que valen la pena saber:

- **Lo que estaba en `none` sigue en `none`.** Dar color a un contorno apagado dibujaria
  un trazo que el logo no tiene.
- **La placa de fondo se quita.** Cristal d'Arques y Chef & Sommelier traen su
  rectangulo negro dentro del archivo; aplanado a un color se tragaria el logo entero,
  asi que en blanco o en negro se descartan las primeras formas que cubren mas de la
  mitad del lienzo.
- **Cada archivo se aisla antes de entrar en la pagina.** Illustrator numera igual en
  todos: la primera clase siempre es `.cls-1` y el primer recorte siempre `#clippath`.
  Con ocho logos a la vez, el ultimo se llevaba por delante el color y el recorte de los
  demas. Cada uno entra con su propio sufijo, que se retira al copiar o al bajar.

Una tipografia que no este instalada **no** se convierte en trazados: si el SVG trae
texto vivo, se vera con una de repuesto. Fue el caso de `logos/arc.svg`, que llevaba la
palabra "arc" en Trade Gothic Next LT Pro; se reemplazo por el archivo reexportado con
el texto en curvas, que es siempre la salida.

## Una pieza de interfaz se mira como un cuaderno de codigo

Las fichas `.html` no abren con la vista a un lado y el codigo al otro, sino con el
reparto de un cuaderno: **las tres lenguas arriba, una al lado de otra — HTML, CSS y
JS — y la pieza viva a todo lo ancho debajo**. Se lee en ese orden: que dice el
archivo, y luego que hace.

Separar las lenguas es **solo para mirar**. El archivo sigue siendo uno, y "Copiar la
pieza entera" copia ese archivo tal cual. Cada hoja ademas se copia suelta, para
llevarse solo el CSS o solo el JS.

Lo que la pieza carga de fuera — un `<script src>` o un `<link rel=stylesheet>` — no
es codigo suyo, asi que no entra en ninguna hoja: se lista aparte, bajo **Carga
aparte**, con su direccion entera.

El color del codigo dice una cosa sola, como el resto de la casa: **ambar lo que es
valor** (cadenas, colores, medidas), blanco lo que nombra (etiquetas, propiedades,
palabras del lenguaje) y gris apagado los comentarios. Nada de arcoiris.

## Derechos

Licencia **propietaria**: ver `LICENSE`. Cubre por igual el
codigo del sitio y el contenido de la biblioteca, incluidas las composiciones y
grabaciones de `tunes/`, cuyos derechos son de IRIS Studio.

Que el sitio publicado sea accesible no otorga licencia de uso: poder verlo no es
poder usarlo.

**Ojo con lo que no es nuestro.** La biblioteca guarda tambien material de terceros
como herramienta de trabajo, y ese material queda fuera de la licencia: sigue siendo
de sus autores. **Anota siempre el origen en la `nota` de la ficha.** Hoy es el caso
de las 72 formas de `svgs/`, que son de shapes.gallery (Mo), y de los ocho logos del
grupo `terceros` (Arc, Arcoroc, Cristal d'Arques, Chef & Sommelier, KitchenAid, Mychef,
Roichen y Wolfen), que son de sus titulares.

Con el codigo pasa igual. Las piezas de `interfaces/` estan reescritas con clases
propias, pero **la tecnica no siempre es nuestra** y su ficha lo dice: `bento-flip` es de la
cuenta de GreenSock, `rejilla-lupa` de creativeocean, `liquid-glass` de toi-nagasawa y
`agua-en-el-texto` de Margarita-the-solid.

## Atajos

- `/` enfoca el buscador. Buscando se mira **toda** la biblioteca, no solo la seccion abierta
- `Esc` cierra la ficha abierta, o vacia el buscador

## El worker

```
cd worker
npx wrangler deploy
npx wrangler secret put ANIMAX_TOKEN    # administracion: subir y borrar
npx wrangler secret put ANIMAX_PASE     # el pase de quien entra a mirar
```

Son dos credenciales distintas a proposito: el pase se puede repartir y rotar sin
tocar el token que permite escribir. El pase que se entrega dura una semana y va
firmado con HMAC contra `ANIMAX_TOKEN`, asi que el worker lo verifica solo, sin
guardar sesiones.
