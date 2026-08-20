/* Animax — el armazon del catalogo.
   Una sola regla: lo que se ve en la vista previa es el mismo archivo que se copia.

   La ruta vive en el hash, asi que cada seccion y cada grupo tienen su propio enlace:
     #/interfaces            toda la seccion
     #/interfaces/botones    un grupo dentro de la seccion
*/

const VERSION = "0.6.0";

/* El contenido no esta en este repo. Vive en el bucket R2 "animax" y lo sirve el
   worker previo pase, asi que ningun archivo tiene URL que valga sin token. */
const API = "https://animax.studio-iris2026.workers.dev";
const LLAVE = "animax.pase";
let token = localStorage.getItem(LLAVE) || "";

const tabla = document.getElementById("tabla");
const vacio = document.getElementById("vacio");
const cuenta = document.getElementById("cuenta");
const campo = document.getElementById("q");
const navSecciones = document.getElementById("secciones");
const navGrupos = document.getElementById("grupos");
const puertaEl = document.getElementById("puerta");

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

/* Con ?local=1 la pagina lee las fichas del catalogo.json del repo y los archivos
   por ruta relativa, sin bucket ni pase. Es para maquetar y para mirar una ficha
   antes de subirla; el contenido de verdad nunca se sirve asi. */
const LOCAL = new URLSearchParams(location.search).has("local");

async function arrancar(){
  /* Las SECCIONES son estructura y viven en el repo publico. Las FICHAS y los
     archivos son contenido con derechos y vienen del bucket, previo pase. */
  let semilla;
  try{
    semilla = await (await fetch("catalogo.json", { cache: "no-cache" })).json();
    secciones = semilla.secciones || [];
  }catch(e){
    return decir("No se pudo leer catalogo.json",
      "Si abriste index.html directamente, el navegador no deja leer archivos. Levanta el servidor con .\abrir.ps1 y entra por http://localhost:4173/");
  }

  if(LOCAL){
    /* catalogo.local.json es la lista de pruebas y no se versiona; si no esta,
       valen las fichas que traiga el propio catalogo.json */
    let pruebas = null;
    try{ pruebas = await (await fetch("catalogo.local.json", { cache: "no-cache" })).json(); }
    catch(e){ /* no hay lista de pruebas */ }
    fichas = (pruebas && pruebas.fichas) || semilla.fichas || [];
    document.body.dataset.dentro = "si";
    pintarSecciones();
    return pintar();
  }

  if(!token) return puerta();

  let datos;
  try{
    const r = await fetch(API + "/catalogo?t=" + encodeURIComponent(token), { cache: "no-cache" });
    if(r.status === 401){ olvidar(); return puerta("El pase caduco. Vuelve a entrar."); }
    if(!r.ok) throw new Error(r.status);
    datos = await r.json();
  }catch(e){
    return decir("No se pudo hablar con la biblioteca",
      "El worker no responde. Comprueba que animax.studio-iris2026.workers.dev esta en pie.");
  }

  fichas = datos.fichas || [];
  document.body.dataset.dentro = "si";
  if(puertaEl) puertaEl.hidden = true;
  pintarSecciones();
  pintar();
}

function olvidar(){
  token = "";
  try{ localStorage.removeItem(LLAVE); }catch(e){ /* modo privado */ }
  document.body.dataset.dentro = "no";
}

/* La puerta. No protege nada por si misma: lo que protege es que el archivo no
   sale del bucket sin un token firmado por el worker. */
function puerta(aviso){
  document.body.dataset.dentro = "no";
  vacio.hidden = true;
  puertaEl.hidden = false;

  const caja = document.createElement("div");
  caja.className = "puerta__caja";

  const ojo = document.createElement("p");
  ojo.className = "puerta__ojo";
  ojo.textContent = "Acceso";

  const t = document.createElement("h1");
  t.className = "puerta__t";
  t.textContent = "Animax es privada";

  const c = document.createElement("p");
  c.className = "puerta__c";
  c.textContent = "La biblioteca y todo lo que guarda son de IRIS Studio. Escribe el pase para entrar.";

  const form = document.createElement("form");
  form.className = "puerta__form";

  const campoPase = document.createElement("input");
  campoPase.type = "password";
  campoPase.className = "puerta__campo";
  campoPase.placeholder = "Pase";
  campoPase.autocomplete = "current-password";
  campoPase.setAttribute("aria-label", "Pase");

  const enviar = document.createElement("button");
  enviar.className = "boton";
  enviar.type = "submit";
  enviar.textContent = "Entrar";

  const err = document.createElement("p");
  err.className = "puerta__err";
  err.textContent = aviso || "";
  err.hidden = !aviso;

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    err.hidden = true;
    enviar.disabled = true;
    enviar.textContent = "Comprobando…";
    try{
      const r = await fetch(API + "/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pase: campoPase.value })
      });
      if(!r.ok){
        err.textContent = r.status === 401 ? "Ese pase no es." : "No se pudo comprobar el pase.";
        err.hidden = false;
        return;
      }
      const d = await r.json();
      token = d.token;
      try{ localStorage.setItem(LLAVE, token); }catch(e){ /* modo privado: dura la sesion */ }
      puertaEl.hidden = true;
      arrancar();
    }catch(e){
      err.textContent = "No se pudo hablar con la biblioteca.";
      err.hidden = false;
    }finally{
      enviar.disabled = false;
      enviar.textContent = "Entrar";
    }
  });

  form.append(campoPase, enviar);
  caja.append(ojo, t, c, form, err);
  puertaEl.replaceChildren(caja);
  campoPase.focus();
}

/* Toda ruta de archivo se resuelve contra el worker, nunca contra el sitio. */
function urlDe(key, descarga){
  if(LOCAL) return key;
  return API + (descarga ? "/descargar" : "/archivo")
    + "?key=" + encodeURIComponent(key)
    + "&t=" + encodeURIComponent(token)
    + (descarga ? "&n=" + encodeURIComponent(key.split("/").pop()) : "");
}

async function fuente(r){
  if(fuentes.has(r)) return fuentes.get(r);
  const t = await (await fetch(urlDe(r), { cache: "no-cache" })).text();
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
  if(c === "vivo") return fuente(p.archivo);
  if(c === "vector"){
    const t = await fuente(p.archivo);
    /* En su color de origen se copia el archivo tal cual, byte por byte. Solo
       cuando se pide una tinta plana hay que reescribirlo. */
    if(!p.tinta || p.tinta === "original") return t;
    const svg = prepara(t, p.tinta);
    return svg ? textoSvg(svg) : t;
  }
  const suelto = p.archivo.split("/").pop();
  if(c === "imagen") return `<img src="${suelto}" alt="${p.nombre}">`;
  if(c === "audio") return `<audio src="${suelto}" preload="metadata" controls></audio>`;
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
          "Subelo con .\subir.ps1 -Archivo ruta -Seccion " + s.id
          + (g ? " -Grupo " + g.id : " -Grupo <grupo>") + " -Nombre \"Como se lee\". El README lo explica.");
  }else{
    decir("La biblioteca esta vacia",
          "Sube tu primer archivo con .\subir.ps1. Va al bucket, no al repositorio: el contenido no se publica en GitHub.");
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
  const caja = document.createElement("div");
  caja.className = "ventana ventana--" + (p.seccion || "otro");
  caja.dataset.id = p.id;
  caja.setAttribute("role", "listitem");

  const abrir = document.createElement("button");
  abrir.className = "ventana__abrir";
  abrir.type = "button";
  abrir.setAttribute("aria-expanded", "false");

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

  abrir.append(marco, pie);
  abrir.addEventListener("click", () => alternar(p, caja));
  caja.append(abrir);

  /* El atajo de la galeria: copiar sin abrir la ficha. Va fuera del boton de
     abrir porque un boton no puede vivir dentro de otro. */
  const cop = document.createElement("button");
  cop.className = "ventana__copiar";
  cop.type = "button";
  cop.textContent = "Copiar";
  cop.setAttribute("aria-label", "Copiar " + p.nombre);
  cop.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    try{
      await navigator.clipboard.writeText(await copiable(p));
      cop.textContent = "Copiado";
      cop.dataset.hecho = "si";
    }catch(e){
      cop.textContent = "No se pudo";
    }
    setTimeout(() => { cop.textContent = "Copiar"; delete cop.dataset.hecho; }, 1300);
  });
  caja.append(cop);

  return caja;
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

  if(c === "vector"){
    /* En linea, no como <img>: solo asi el fill="currentColor" toma el color de
       la baldosa, que es como se ven las formas en la galeria de referencia. */
    const caja = document.createElement("div");
    caja.className = "vector";
    const svg = prepara(await fuente(p.archivo), p.tinta || "original");
    if(svg) caja.append(svg);
    else caja.innerHTML = desinfecta(aisla(await fuente(p.archivo)));
    destino.replaceChildren(caja);
    return;
  }

  if(c === "imagen"){
    const img = document.createElement("img");
    img.src = urlDe(p.archivo);
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

/* Los SVG del bucket son nuestros, pero inyectar markup sin mirarlo es como se
   cuelan los sustos: fuera scripts, manejadores y javascript: en los enlaces. */
function desinfecta(svg){
  return String(svg)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(xlink:href|href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
}

/* ---------- la tinta: color de origen, blanco o negro ---------- */

/* Un logo no guarda su color en atributos fill: lo guarda en un <style> con
   clases dentro del propio archivo. Por eso no vale reemplazar texto — hay que
   preguntarle al navegador el color YA resuelto de cada forma, y para eso el
   SVG tiene que estar montado de verdad. Se monta fuera de la vista. */
/* Illustrator numera igual en TODOS los archivos: la primera clase siempre es
   .cls-1 y el primer recorte siempre #clippath. Con ocho logos en la misma
   pagina eso no es un detalle — el ultimo que se pinta se lleva por delante el
   color y el recorte de los demas, y medio logotipo desaparece. Antes de meter
   nada en la pagina, cada archivo se lleva su propio sufijo. */
let serie = 0;
const MARCA = /__ax\d+(?![\w-])/g;

function escapa(t){ return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function aisla(texto){
  const suf = "__ax" + (++serie);
  let s = texto;

  const ids = new Set();
  s.replace(/\sid\s*=\s*"([^"]+)"/g, (t, v) => { ids.add(v); return t; });
  ids.forEach(v => {
    const e = escapa(v);
    s = s.replace(new RegExp('(\\sid\\s*=\\s*")' + e + '(")', "g"), "$1" + v + suf + "$2");
    s = s.replace(new RegExp('url\\((["\']?)#' + e + '\\1\\)', "g"), "url(#" + v + suf + ")");
    s = s.replace(new RegExp('((?:xlink:)?href\\s*=\\s*")#' + e + '(")', "g"), "$1#" + v + suf + "$2");
  });

  /* Solo se renombran las clases que declara SU PROPIO <style>: tocar el resto
     del archivo a ciegas seria meterse en los datos de los trazados. */
  const clases = new Set();
  const estilos = s.match(/<style[\s\S]*?<\/style>/gi) || [];
  estilos.join("").replace(/\.([A-Za-z_][\w-]*)/g, (t, c) => { clases.add(c); return t; });
  if(clases.size){
    s = s.replace(/<style[\s\S]*?<\/style>/gi, bloque => {
      clases.forEach(c => {
        bloque = bloque.replace(new RegExp("\\." + escapa(c) + "(?![\\w-])", "g"), "." + c + suf);
      });
      return bloque;
    });
    s = s.replace(/(\sclass\s*=\s*")([^"]*)(")/g, (t, a, v, z) =>
      a + v.split(/\s+/).filter(Boolean).map(c => clases.has(c) ? c + suf : c).join(" ") + z);
  }

  return s;
}

const TINTAS = { original: null, blanco: "#ffffff", negro: "#000000" };
const LADO_PNG = 2048;   // lado largo del PNG que se copia o se baja

let banco = null;
function tablero(){
  if(banco) return banco;
  banco = document.createElement("div");
  banco.setAttribute("aria-hidden", "true");
  banco.style.cssText = "position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none";
  document.body.append(banco);
  return banco;
}

/* Las formas que de verdad se pintan. Lo que vive en defs, clipPath o mask no
   es dibujo sino herramienta: tocarlo rompe el recorte. */
function pintables(svg){
  return [...svg.querySelectorAll("path,rect,circle,ellipse,polygon,polyline,line,text,tspan,use,image")]
    .filter(el => !el.closest("defs,clipPath,mask,symbol,marker,pattern"));
}

/* Algunos logos traen su placa de fondo dentro del archivo — un rectangulo negro
   a lienzo completo. Aplanada a un color, esa placa se traga el logo entero, asi
   que se descartan las primeras formas que cubren mas de la mitad del lienzo y
   se para en la primera que no. */
function quitaPlaca(svg){
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const area = vb ? vb.width * vb.height : 0;
  if(!area) return;
  for(const el of pintables(svg)){
    let b;
    try{ b = el.getBBox(); }catch(e){ return; }
    if(b.width * b.height < area * .55) return;
    el.remove();
  }
}

/* Un solo color para todo lo que se pinta. Lo que estaba en none sigue en none:
   dar color a un contorno apagado dibujaria un trazo que el logo no tiene. */
function aplana(svg, color){
  if(!svg.style.color) svg.style.color = color;
  pintables(svg).forEach(el => {
    const cs = getComputedStyle(el);
    if(cs.fill && cs.fill !== "none") el.style.setProperty("fill", color, "important");
    if(cs.stroke && cs.stroke !== "none") el.style.setProperty("stroke", color, "important");
  });
}

/* Del texto del archivo a un <svg> vivo, ya en la tinta que toque. */
function prepara(texto, tinta){
  const caja = document.createElement("div");
  caja.innerHTML = desinfecta(aisla(texto));
  const svg = caja.querySelector("svg");
  if(!svg) return null;
  if(!TINTAS[tinta]) return svg;
  tablero().append(svg);
  try{
    quitaPlaca(svg);
    aplana(svg, TINTAS[tinta]);
  }finally{
    svg.remove();
  }
  return svg;
}

function medidas(svg){
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const w = vb.length === 4 && vb[2] > 0 ? vb[2] : parseFloat(svg.getAttribute("width")) || 512;
  const h = vb.length === 4 && vb[3] > 0 ? vb[3] : parseFloat(svg.getAttribute("height")) || 512;
  return [w, h];
}

function textoSvg(svg){
  const c = svg.cloneNode(true);
  c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  /* El sufijo solo hace falta mientras el SVG comparte pagina con otros. Lo que
     se baja o se copia sale con los nombres que traia. */
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + new XMLSerializer().serializeToString(c).replace(MARCA, "");
}

/* El PNG se dibuja aqui, en el navegador, no en el worker: asi sale en la misma
   tinta que se esta viendo y con el fondo transparente. Manda el lado largo. */
async function pngDe(svg, color){
  const [w, h] = medidas(svg);
  const e = LADO_PNG / Math.max(w, h);
  const W = Math.max(1, Math.round(w * e));
  const H = Math.max(1, Math.round(h * e));

  const c = svg.cloneNode(true);
  c.setAttribute("width", W);
  c.setAttribute("height", H);
  /* Dentro de un <img> no hay pagina de la que heredar, asi que un
     fill="currentColor" se quedaria en negro. Se le pasa el color que se ve. */
  if(!c.style.color && color) c.style.color = color;

  const url = URL.createObjectURL(new Blob([textoSvg(c)], { type: "image/svg+xml;charset=utf-8" }));
  try{
    const img = new Image();
    img.src = url;
    await img.decode();
    const lienzo = document.createElement("canvas");
    lienzo.width = W;
    lienzo.height = H;
    lienzo.getContext("2d").drawImage(img, 0, 0, W, H);
    const blob = await new Promise(ok => lienzo.toBlob(ok, "image/png"));
    if(!blob) throw new Error("el lienzo no dio PNG");
    return blob;
  }finally{
    URL.revokeObjectURL(url);
  }
}

function baja(blob, nombre){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* arc-blanco.png: la tinta va en el nombre para no pisar al original. */
function nombreDe(p, ext){
  const base = p.archivo.split("/").pop().replace(/\.[^.]+$/, "");
  const t = p.tinta && p.tinta !== "original" ? "-" + p.tinta : "";
  return base + t + "." + ext;
}

/* La envoltura NO forma parte de lo que se copia: solo centra la pieza y le da tipografia. */
function envoltura(html, fondo, mini){
  const suelo = fondo === "tinta" ? "#0a0a0b" : fondo === "papel" ? "#efebe1" : "#7e7b73";
  const color = fondo === "tinta" ? "#f2f2f2" : "#17150f";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  html,body{height:100%;margin:0;overflow:hidden}
  body{display:grid;place-items:center;padding:${mini ? 14 : 28}px;
       background:${suelo};color:${color};
       font-family:"Inter",system-ui,sans-serif;
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
  a.src = urlDe(p.archivo);
  despiertaAlVerse(a);
  return caja;
}

function reproductor(p){
  const caja = document.createElement("div");
  caja.className = "tune";

  const a = new Audio();
  a.preload = "metadata";
  a.src = urlDe(p.archivo);
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
  tabla.querySelectorAll('.ventana[data-abierta="si"]').forEach(v => {
    delete v.dataset.abierta;
    v.querySelector(".ventana__abrir").setAttribute("aria-expanded", "false");
  });
}

function alternar(p, caja){
  const eraEsta = abierta === p.id;
  cerrar();
  if(eraEsta){ abierta = null; return; }

  abierta = p.id;
  caja.dataset.abierta = "si";
  caja.querySelector(".ventana__abrir").setAttribute("aria-expanded", "true");

  const items = [...tabla.querySelectorAll(".ventana")];
  const cols = columnas();
  const i = items.indexOf(caja);
  const finDeFila = items[Math.min(items.length - 1, Math.floor(i / cols) * cols + cols - 1)];
  finDeFila.after(mesa(p));
}

function mesa(p){
  const m = document.createElement("section");
  m.className = "mesa mesa--" + (p.seccion || "otro");
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

  const c = clase(p.archivo);
  const esVector = c === "vector";
  if(esVector && !p.tinta) p.tinta = "original";

  /* Cambiar la tinta o el fondo tiene que mover LAS DOS cosas, la vista y el
     panel de codigo: la regla de la casa es que lo que ves es lo que copias. */
  const refresca = () => {
    vista(p, panel, false);
    pre.textContent = "Leyendo " + p.archivo + "…";
    copiable(p).then(t => { pre.textContent = t; })
               .catch(() => { pre.textContent = "No se pudo leer " + p.archivo; });
  };

  const acciones = document.createElement("div");
  acciones.className = "mesa__acciones";

  /* Un boton que dice en su propio rotulo si le salio bien. */
  const accion = (rotulo, hecho, llano, hacer) => {
    const b = document.createElement("button");
    b.className = "boton" + (llano ? " boton--llano" : "");
    b.type = "button";
    b.textContent = rotulo;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try{
        await hacer();
        b.textContent = hecho;
        b.dataset.hecho = "si";
      }catch(e){
        b.textContent = "No se pudo";
      }finally{
        b.disabled = false;
        setTimeout(() => { b.textContent = rotulo; delete b.dataset.hecho; }, 1500);
      }
    });
    return b;
  };

  if(esVector){
    /* El SVG se vuelve a preparar en cada gesto: cuesta poco y evita quedarse
       con una copia de una tinta que ya no es la que esta puesta. */
    const ahora = async () => {
      const svg = prepara(await fuente(p.archivo), p.tinta);
      if(!svg) throw new Error("el archivo no trae un <svg>");
      return svg;
    };
    const color = () => getComputedStyle(panel).color;

    acciones.append(
      accion("Copiar SVG", "Copiado", false, async () => {
        await navigator.clipboard.writeText(await copiable(p));
      }),
      accion("Copiar PNG", "Copiado", false, async () => {
        const blob = await pngDe(await ahora(), color());
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      }),
      accion("Descargar SVG", "Bajado", true, async () => {
        baja(new Blob([await copiable(p)], { type: "image/svg+xml;charset=utf-8" }), nombreDe(p, "svg"));
      }),
      accion("Descargar PNG", "Bajado", true, async () => {
        baja(await pngDe(await ahora(), color()), nombreDe(p, "png"));
      })
    );
  }else{
    const rotulo = c === "audio" || c === "imagen" ? "Copiar la etiqueta" : "Copiar codigo";
    acciones.append(accion(rotulo, "Copiado", false, async () => {
      await navigator.clipboard.writeText(await copiable(p));
    }));

    const abrir = document.createElement("a");
    abrir.className = "boton boton--llano";
    abrir.href = urlDe(p.archivo);
    abrir.target = "_blank";
    abrir.rel = "noopener";
    abrir.textContent = "Abrir el archivo";
    acciones.append(abrir);

    if(c === "audio" || c === "imagen"){
      const bajar = document.createElement("a");
      bajar.className = "boton boton--llano";
      bajar.href = urlDe(p.archivo, true);
      bajar.textContent = "Descargar";
      acciones.append(bajar);
    }
  }

  /* --- la fila de ajustes: con que color y sobre que material se mira --- */

  const ojo = t => {
    const e = document.createElement("span");
    e.className = "mesa__ojo";
    e.textContent = t;
    return e;
  };
  const grupo = (etiqueta, hijo, dcho) => {
    const g = document.createElement("div");
    g.className = "mesa__grupo" + (dcho ? " mesa__grupo--dcho" : "");
    g.append(ojo(etiqueta), hijo);
    return g;
  };

  const ajustes = document.createElement("div");
  ajustes.className = "mesa__ajustes";

  if(esVector){
    const tintas = document.createElement("div");
    tintas.className = "mesa__tintas";
    [["original", "De origen"], ["blanco", "Blanco"], ["negro", "Negro"]].forEach(([clave, rot]) => {
      const b = document.createElement("button");
      b.className = "mesa__tinta";
      b.type = "button";
      b.textContent = rot;
      b.setAttribute("aria-pressed", String(p.tinta === clave));
      b.addEventListener("click", () => {
        if(p.tinta === clave) return;
        p.tinta = clave;
        [...tintas.children].forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        refresca();
      });
      tintas.append(b);
    });
    ajustes.append(grupo("Color", tintas));
  }

  if(c !== "audio"){
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
        if(p.fondo === clave) return;
        p.fondo = clave;
        panel.className = "mesa__vista fondo-" + clave;
        vista(p, panel, false);
        [...fondos.children].forEach(x => x.setAttribute("aria-pressed", String(x === s)));
      });
      fondos.append(s);
    });
    ajustes.append(grupo("Fondo", fondos, true));
  }

  lado.append(cabeza, nota, pre);
  if(ajustes.children.length) lado.append(ajustes);
  lado.append(acciones);
  m.append(panel, lado);
  return m;
}

/* ---------- controles ---------- */

addEventListener("hashchange", () => { campo.value = ""; pintar(); });

campo.addEventListener("input", pintar);

document.getElementById("salir").addEventListener("click", () => {
  olvidar();
  fichas = [];
  tabla.replaceChildren();
  puerta("Has salido.");
});

addEventListener("keydown", e => {
  if(e.key === "/" && document.activeElement !== campo){ e.preventDefault(); campo.focus(); }
  if(e.key === "Escape"){
    if(tabla.querySelector(".mesa")){
      const b = tabla.querySelector('.ventana[data-abierta="si"] .ventana__abrir');
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
  const b = tabla.querySelector('.ventana[data-abierta="si"]');
  const p = fichas.find(x => x.id === abierta);
  if(b && p){ abierta = null; alternar(p, b); }
});

arrancar();
