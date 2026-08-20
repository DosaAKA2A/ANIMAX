/* Animax — el armazon del catalogo.
   Una sola regla: lo que se ve en la vista previa es el mismo archivo que se copia.

   La ruta vive en el hash, asi que cada seccion y cada grupo tienen su propio enlace:
     #/interfaces            toda la seccion
     #/interfaces/botones    un grupo dentro de la seccion
*/

const VERSION = "0.2.0";

const tabla = document.getElementById("tabla");
const vacio = document.getElementById("vacio");
const cuenta = document.getElementById("cuenta");
const campo = document.getElementById("q");
const navSecciones = document.getElementById("secciones");
const navGrupos = document.getElementById("grupos");

const fuentes = new Map();          // ruta -> texto del archivo, se pide una sola vez
let secciones = [];
let fichas = [];
let abierta = null;

document.getElementById("version").textContent = "v" + VERSION;

/* ---------- ruta ---------- */

function ruta(){
  const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { seccion: partes[0] || null, grupo: partes[1] || null };
}

const seccionDe = id => secciones.find(s => s.id === id) || null;

/* ---------- carga ---------- */

async function arrancar(){
  let datos;
  try{
    datos = await (await fetch("catalogo.json", { cache: "no-cache" })).json();
  }catch(e){
    navSecciones.hidden = true;
    return decir(
      "No se pudo leer catalogo.json",
      "Si abriste index.html directamente, el navegador no deja leer archivos. Levanta el servidor con .\\abrir.ps1 y entra por http://localhost:4173/"
    );
  }
  secciones = datos.secciones || [];
  fichas = datos.fichas || [];
  pintarSecciones();
  pintar();
}

async function fuente(r){
  if(fuentes.has(r)) return fuentes.get(r);
  const t = await (await fetch(r, { cache: "no-cache" })).text();
  fuentes.set(r, t.trimEnd());
  return fuentes.get(r);
}

/* ---------- que clase de archivo es ---------- */

function clase(archivo){
  const a = (archivo || "").toLowerCase();
  if(/\.html?$/.test(a)) return "vivo";
  if(/\.svg$/.test(a)) return "vector";
  if(/\.(png|jpe?g|webp|gif|avif)$/.test(a)) return "imagen";
  if(/\.(mp3|wav|ogg|m4a|flac|opus)$/.test(a)) return "audio";
  return "otro";
}

/* Lo que se copia. En vivo y vector es el archivo entero; en imagen y audio,
   la etiqueta lista para pegar, porque el archivo es binario. */
async function copiable(p){
  const c = clase(p.archivo);
  if(c === "vivo" || c === "vector") return fuente(p.archivo);
  if(c === "imagen") return `<img src="${p.archivo}" alt="${p.nombre}">`;
  if(c === "audio") return `<audio src="${p.archivo}" preload="metadata" controls></audio>`;
  return p.archivo;
}

/* ---------- navegacion ---------- */

function pintarSecciones(){
  const { seccion } = ruta();
  const enlaces = [enlace("#/", "Todo", !seccion, "seccion__e")];
  secciones.forEach(s => {
    enlaces.push(enlace("#/" + s.id, s.nombre, seccion === s.id, "seccion__e"));
  });
  navSecciones.replaceChildren(...enlaces);
}

function pintarGrupos(){
  const { seccion, grupo } = ruta();
  const s = seccionDe(seccion);
  if(!s || !(s.grupos || []).length){ navGrupos.hidden = true; return; }
  navGrupos.hidden = false;

  const enlaces = [enlace("#/" + s.id, "Todo", !grupo, "grupo__e")];
  s.grupos.forEach(g => {
    const n = fichas.filter(f => f.seccion === s.id && f.grupo === g.id).length;
    const e = enlace("#/" + s.id + "/" + g.id, g.nombre, grupo === g.id, "grupo__e");
    if(n){
      const c = document.createElement("span");
      c.className = "grupo__n";
      c.textContent = n;
      e.append(c);
    }else{
      e.classList.add("grupo__e--vacio");
    }
    enlaces.push(e);
  });
  navGrupos.replaceChildren(...enlaces);
}

function enlace(href, texto, activo, clase){
  const a = document.createElement("a");
  a.className = clase;
  a.href = href;
  a.textContent = texto;
  if(activo) a.setAttribute("aria-current", "page");
  return a;
}

/* ---------- filtro y rejilla ---------- */

function visibles(){
  const q = campo.value.trim().toLowerCase();
  const { seccion, grupo } = ruta();
  return fichas.filter(f => {
    if(!q){
      if(seccion && f.seccion !== seccion) return false;
      if(grupo && f.grupo !== grupo) return false;
      return true;
    }
    // buscando se mira toda la biblioteca, no solo la seccion abierta
    const saco = [f.nombre, f.nota, (f.etiquetas || []).join(" "), f.seccion, f.grupo].join(" ");
    return saco.toLowerCase().includes(q);
  });
}

function pintar(){
  abierta = null;
  pintarSecciones();
  pintarGrupos();

  const lista = visibles();
  const s = seccionDe(ruta().seccion);
  const uno = lista.length === 1;
  const palabra = s ? (uno ? s.singular : s.plural) : (uno ? "ficha" : "fichas");
  cuenta.textContent = lista.length + " " + palabra;

  tabla.replaceChildren(...lista.map(ventana));

  if(lista.length){ vacio.hidden = true; return; }
  if(campo.value.trim()){
    decir("Nada coincide con “" + campo.value.trim() + "”",
          "Prueba con menos letras, o borra el buscador con Esc.");
  }else if(s){
    const g = (s.grupos || []).find(x => x.id === ruta().grupo);
    decir("En " + s.nombre + (g ? " · " + g.nombre : "") + " todavia no hay nada",
          "Deja el archivo en la carpeta " + s.carpeta + "/ y anade su ficha en catalogo.json"
          + (g ? ' con grupo "' + g.id + '"' : "") + ". El README tiene el molde.");
  }else{
    decir("La biblioteca esta vacia",
          "Deja tu primer archivo en interfaces/, svgs/, logos/ o tunes/ y anade su ficha en catalogo.json. El README tiene el molde.");
  }
}

function decir(titulo, cuerpo){
  const h = document.createElement("p");
  h.className = "vacio__t";
  h.textContent = titulo;
  const p = document.createElement("p");
  p.className = "vacio__c";
  p.textContent = cuerpo;
  vacio.replaceChildren(h, p);
  vacio.hidden = false;
  cuenta.textContent = cuenta.textContent || "";
}

function ventana(p){
  const b = document.createElement("button");
  b.className = "ventana";
  b.type = "button";
  b.dataset.id = p.id;
  b.setAttribute("role", "listitem");
  b.setAttribute("aria-expanded", "false");

  const marco = document.createElement("div");
  marco.className = "ventana__marco";

  const lienzo = document.createElement("div");
  lienzo.className = "ventana__lienzo fondo-" + (p.fondo || "carta");
  marco.append(lienzo);
  vista(p, lienzo, true);

  const pie = document.createElement("div");
  pie.className = "ventana__pie";
  const nombre = document.createElement("span");
  nombre.className = "ventana__nombre";
  nombre.textContent = p.nombre;
  const meta = document.createElement("span");
  meta.className = "ventana__tipo";
  meta.textContent = (p.archivo.split(".").pop() || "").toLowerCase();
  pie.append(nombre, meta);

  b.append(marco, pie);
  b.addEventListener("click", () => alternar(p, b));
  return b;
}

/* ---------- vistas previas ---------- */

async function vista(p, destino, mini){
  const c = clase(p.archivo);

  if(c === "vivo"){
    const marco = document.createElement("iframe");
    marco.setAttribute("title", "Vista previa de " + p.nombre);
    marco.setAttribute("loading", "lazy");
    marco.setAttribute("scrolling", "no");
    marco.setAttribute("sandbox", "allow-scripts");
    marco.srcdoc = envoltura(await fuente(p.archivo), p.fondo, mini);
    destino.replaceChildren(marco);
    return;
  }

  if(c === "vector" || c === "imagen"){
    const img = document.createElement("img");
    img.src = p.archivo;
    img.alt = p.nombre;
    img.loading = "lazy";
    destino.replaceChildren(img);
    return;
  }

  if(c === "audio"){
    destino.replaceChildren(mini ? marcaAudio(p) : reproductor(p));
    return;
  }

  const nada = document.createElement("span");
  nada.className = "sinvista";
  nada.textContent = "sin vista previa";
  destino.replaceChildren(nada);
}

/* La envoltura NO forma parte de lo que se copia: solo centra la pieza y le da tipografia. */
function envoltura(html, fondo, mini){
  const suelo = fondo === "tinta" ? "#17150f" : fondo === "papel" ? "#efebe1" : "#7e7b73";
  const color = fondo === "tinta" ? "#efebe1" : "#17150f";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  html,body{height:100%;margin:0;overflow:hidden}
  body{display:grid;place-items:center;padding:${mini ? 14 : 28}px;
       background:${suelo};color:${color};
       font-family:"Archivo",system-ui,sans-serif;
       ${mini ? "zoom:.86;" : ""}}
</style></head><body>${html}</body></html>`;
}

/* ---------- tunes ---------- */

/* Chrome no carga medios en una pestaña oculta: se queda en networkState 2 y nunca
   llega loadedmetadata. Si la pagina se abre en segundo plano, reintentamos al verse. */
function despiertaAlVerse(a){
  const tira = () => {
    if(document.visibilityState !== "visible") return;
    if(a.readyState === 0) a.load();
    else document.removeEventListener("visibilitychange", tira);
  };
  document.addEventListener("visibilitychange", tira);
  tira();
}

function reloj(s){
  if(!isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  return m + ":" + String(Math.floor(s % 60)).padStart(2, "0");
}

/* miniatura: un triangulo y la duracion, sin inventarse una onda que no hemos medido */
function marcaAudio(p){
  const caja = document.createElement("div");
  caja.className = "tune-marca";
  caja.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M7 4.5 L19 12 L7 19.5 Z" fill="currentColor"/></svg>`;
  const t = document.createElement("span");
  t.className = "tune-marca__t";
  t.textContent = "--:--";
  caja.append(t);

  const a = new Audio();
  a.preload = "metadata";
  a.addEventListener("loadedmetadata", () => { t.textContent = reloj(a.duration); }, { once: true });
  a.addEventListener("error", () => { t.textContent = "no carga"; }, { once: true });
  a.src = p.archivo;
  despiertaAlVerse(a);
  return caja;
}

function reproductor(p){
  const caja = document.createElement("div");
  caja.className = "tune";

  const a = new Audio();
  a.preload = "metadata";
  a.src = p.archivo;
  despiertaAlVerse(a);

  const play = document.createElement("button");
  play.className = "tune__play";
  play.type = "button";
  play.setAttribute("aria-label", "Reproducir");
  const dibuja = () => {
    play.innerHTML = a.paused
      ? `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4.5 L19 12 L7 19.5 Z" fill="currentColor"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" fill="currentColor"/></svg>`;
    play.setAttribute("aria-label", a.paused ? "Reproducir" : "Pausar");
  };
  play.addEventListener("click", () => { a.paused ? a.play() : a.pause(); });
  a.addEventListener("play", dibuja);
  a.addEventListener("pause", dibuja);
  dibuja();

  const pista = document.createElement("div");
  pista.className = "tune__pista";
  pista.setAttribute("role", "slider");
  pista.tabIndex = 0;
  pista.setAttribute("aria-label", "Posicion");
  pista.setAttribute("aria-valuemin", "0");
  pista.setAttribute("aria-valuenow", "0");

  const lleno = document.createElement("div");
  lleno.className = "tune__lleno";
  pista.append(lleno);

  const tiempo = document.createElement("span");
  tiempo.className = "tune__tiempo";
  tiempo.textContent = "0:00 / --:--";

  const saltar = ev => {
    if(!isFinite(a.duration)) return;
    const c = pista.getBoundingClientRect();
    a.currentTime = Math.min(1, Math.max(0, (ev.clientX - c.left) / c.width)) * a.duration;
  };
  pista.addEventListener("pointerdown", ev => {
    pista.setPointerCapture(ev.pointerId);
    saltar(ev);
    pista.addEventListener("pointermove", saltar);
    pista.addEventListener("pointerup", () => pista.removeEventListener("pointermove", saltar), { once: true });
  });
  pista.addEventListener("keydown", ev => {
    if(!isFinite(a.duration)) return;
    if(ev.key === "ArrowRight"){ a.currentTime = Math.min(a.duration, a.currentTime + 5); ev.preventDefault(); }
    if(ev.key === "ArrowLeft"){ a.currentTime = Math.max(0, a.currentTime - 5); ev.preventDefault(); }
    if(ev.key === " " || ev.key === "Enter"){ a.paused ? a.play() : a.pause(); ev.preventDefault(); }
  });

  const pinta = () => {
    const d = isFinite(a.duration) ? a.duration : 0;
    lleno.style.width = (d ? (a.currentTime / d) * 100 : 0) + "%";
    tiempo.textContent = reloj(a.currentTime) + " / " + reloj(a.duration);
    pista.setAttribute("aria-valuemax", String(Math.round(d)));
    pista.setAttribute("aria-valuenow", String(Math.round(a.currentTime)));
    pista.setAttribute("aria-valuetext", reloj(a.currentTime));
  };
  a.addEventListener("timeupdate", pinta);
  a.addEventListener("loadedmetadata", pinta);
  a.addEventListener("ended", dibuja);
  a.addEventListener("error", () => { tiempo.textContent = "el archivo no carga"; });

  caja.append(play, pista, tiempo);
  caja.__audio = a;
  return caja;
}

/* ---------- la mesa: la fila se abre en el sitio ---------- */

function columnas(){
  return getComputedStyle(tabla).gridTemplateColumns.split(" ").filter(Boolean).length;
}

function cerrar(){
  const m = tabla.querySelector(".mesa");
  if(m){
    const a = m.querySelector(".tune")?.__audio;
    if(a) a.pause();
    m.remove();
  }
  tabla.querySelectorAll('.ventana[aria-expanded="true"]')
       .forEach(v => v.setAttribute("aria-expanded", "false"));
}

function alternar(p, boton){
  const eraEsta = abierta === p.id;
  cerrar();
  if(eraEsta){ abierta = null; return; }

  abierta = p.id;
  boton.setAttribute("aria-expanded", "true");

  const items = [...tabla.querySelectorAll(".ventana")];
  const cols = columnas();
  const i = items.indexOf(boton);
  const finDeFila = items[Math.min(items.length - 1, Math.floor(i / cols) * cols + cols - 1)];
  finDeFila.after(mesa(p));
}

function mesa(p){
  const m = document.createElement("section");
  m.className = "mesa";
  m.setAttribute("aria-label", p.nombre);

  const panel = document.createElement("div");
  panel.className = "mesa__vista fondo-" + (p.fondo || "carta");
  vista(p, panel, false);

  const lado = document.createElement("div");
  lado.className = "mesa__lado";

  const cabeza = document.createElement("div");
  cabeza.className = "mesa__cabeza";
  const nom = document.createElement("h2");
  nom.className = "mesa__nombre";
  nom.textContent = p.nombre;
  const etis = document.createElement("div");
  etis.className = "mesa__etis";
  (p.etiquetas || []).forEach(t => {
    const e = document.createElement("span");
    e.className = "mesa__eti";
    e.textContent = t;
    etis.append(e);
  });
  cabeza.append(nom, etis);

  const nota = document.createElement("p");
  nota.className = "mesa__nota";
  nota.textContent = p.nota || "";

  const pre = document.createElement("pre");
  pre.className = "mesa__codigo";
  pre.tabIndex = 0;
  pre.textContent = "Leyendo " + p.archivo + "…";
  copiable(p).then(t => { pre.textContent = t; })
             .catch(() => { pre.textContent = "No se pudo leer " + p.archivo; });

  const acciones = document.createElement("div");
  acciones.className = "mesa__acciones";

  const copiar = document.createElement("button");
  copiar.className = "boton";
  copiar.type = "button";
  const rotulo = clase(p.archivo) === "audio" || clase(p.archivo) === "imagen"
    ? "Copiar la etiqueta" : "Copiar codigo";
  copiar.textContent = rotulo;
  copiar.addEventListener("click", async () => {
    await navigator.clipboard.writeText(await copiable(p));
    copiar.textContent = "Copiado";
    copiar.dataset.hecho = "si";
    setTimeout(() => { copiar.textContent = rotulo; delete copiar.dataset.hecho; }, 1400);
  });

  const abrir = document.createElement("a");
  abrir.className = "boton boton--llano";
  abrir.href = p.archivo;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  abrir.textContent = "Abrir el archivo";

  acciones.append(copiar, abrir);

  if(clase(p.archivo) !== "audio"){
    const fondos = document.createElement("div");
    fondos.className = "mesa__fondos";
    [["carta", "#7e7b73"], ["papel", "#efebe1"], ["tinta", "#17150f"]].forEach(([clave, color]) => {
      const s = document.createElement("button");
      s.className = "mesa__fondo";
      s.type = "button";
      s.style.background = color;
      s.title = "Ver sobre " + clave;
      s.setAttribute("aria-label", "Ver sobre " + clave);
      s.setAttribute("aria-pressed", String((p.fondo || "carta") === clave));
      s.addEventListener("click", () => {
        panel.className = "mesa__vista fondo-" + clave;
        p.fondo = clave;
        vista(p, panel, false);
        [...fondos.children].forEach(x => x.setAttribute("aria-pressed", String(x === s)));
      });
      fondos.append(s);
    });
    acciones.append(fondos);
  }

  lado.append(cabeza, nota, pre, acciones);
  m.append(panel, lado);
  return m;
}

/* ---------- controles ---------- */

addEventListener("hashchange", () => { campo.value = ""; pintar(); });

campo.addEventListener("input", pintar);

addEventListener("keydown", e => {
  if(e.key === "/" && document.activeElement !== campo){ e.preventDefault(); campo.focus(); }
  if(e.key === "Escape"){
    if(tabla.querySelector(".mesa")){
      const b = tabla.querySelector('.ventana[aria-expanded="true"]');
      cerrar();
      abierta = null;
      if(b) b.focus();
    }else if(campo.value){
      campo.value = ""; pintar();
    }
  }
});

addEventListener("resize", () => {
  if(!abierta) return;
  const b = tabla.querySelector('.ventana[aria-expanded="true"]');
  const p = fichas.find(x => x.id === abierta);
  if(b && p){ abierta = null; alternar(p, b); }
});

arrancar();
