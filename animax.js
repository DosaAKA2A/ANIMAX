/* Animax — el armazon del catalogo.
   Una sola regla: lo que se ve en la vista previa es el mismo texto que se copia. */

const VERSION = "0.1.0";

const tabla = document.getElementById("tabla");
const vacio = document.getElementById("vacio");
const cuenta = document.getElementById("cuenta");
const campo = document.getElementById("q");
const railEtiquetas = document.getElementById("etiquetas");

const estado = { tipo: "todo", etiqueta: null, texto: "", abierta: null };
const fuentes = new Map();   // ruta -> texto del archivo, se pide una sola vez
let catalogo = [];

document.getElementById("version").textContent = "v" + VERSION;

/* ---------- carga ---------- */

async function arrancar(){
  try{
    catalogo = await (await fetch("catalogo.json", { cache: "no-cache" })).json();
  }catch(e){
    vacio.hidden = false;
    vacio.textContent = "No se pudo leer catalogo.json. Abre la carpeta con un servidor local: en PowerShell, .\\abrir.ps1";
    return;
  }
  pintarEtiquetas();
  pintar();
}

async function fuente(ruta){
  if(fuentes.has(ruta)) return fuentes.get(ruta);
  const t = await (await fetch(ruta, { cache: "no-cache" })).text();
  fuentes.set(ruta, t.trimEnd());
  return fuentes.get(ruta);
}

/* ---------- filtros ---------- */

function visibles(){
  const q = estado.texto.trim().toLowerCase();
  return catalogo.filter(p => {
    if(estado.tipo !== "todo" && p.tipo !== estado.tipo) return false;
    if(estado.etiqueta && !p.etiquetas.includes(estado.etiqueta)) return false;
    if(!q) return true;
    return (p.nombre + " " + p.etiquetas.join(" ") + " " + (p.nota || "")).toLowerCase().includes(q);
  });
}

function pintarEtiquetas(){
  const todas = [...new Set(catalogo.flatMap(p => p.etiquetas))].sort();
  railEtiquetas.replaceChildren(...todas.map(t => {
    const b = document.createElement("button");
    b.className = "eti";
    b.type = "button";
    b.textContent = t;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      estado.etiqueta = estado.etiqueta === t ? null : t;
      [...railEtiquetas.children].forEach(x =>
        x.setAttribute("aria-pressed", String(x.textContent === estado.etiqueta)));
      pintar();
    });
    return b;
  }));
}

/* ---------- rejilla ---------- */

/* el contador nombra lo que hay delante, no siempre "piezas" */
function palabra(n){
  const uno = n === 1;
  if(estado.tipo === "pieza") return uno ? "pieza" : "piezas";
  if(estado.tipo === "forma") return uno ? "forma" : "formas";
  if(estado.tipo === "logo") return uno ? "logo" : "logos";
  return uno ? "ficha" : "fichas";
}

function pintar(){
  estado.abierta = null;
  const lista = visibles();
  cuenta.textContent = lista.length + " " + palabra(lista.length);
  vacio.hidden = lista.length > 0;
  tabla.replaceChildren(...lista.map(ventana));
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
  miniatura(p, lienzo, true);

  const pie = document.createElement("div");
  pie.className = "ventana__pie";
  const nombre = document.createElement("span");
  nombre.className = "ventana__nombre";
  nombre.textContent = p.nombre;
  const tipo = document.createElement("span");
  tipo.className = "ventana__tipo";
  tipo.textContent = p.tipo;
  pie.append(nombre, tipo);

  b.append(marco, pie);
  b.addEventListener("click", () => alternar(p, b));
  return b;
}

async function miniatura(p, destino, esMini){
  if(p.tipo === "pieza"){
    const marco = document.createElement("iframe");
    marco.setAttribute("title", "Vista previa de " + p.nombre);
    marco.setAttribute("loading", "lazy");
    marco.setAttribute("scrolling", "no");
    marco.setAttribute("sandbox", "allow-scripts");
    marco.srcdoc = envoltura(await fuente(p.archivo), p.fondo, esMini);
    destino.replaceChildren(marco);
  }else{
    const img = document.createElement("img");
    img.src = p.archivo;
    img.alt = p.nombre;
    img.loading = "lazy";
    destino.replaceChildren(img);
  }
}

/* La envoltura NO forma parte de lo que se copia: solo centra la pieza y le da tipografia. */
function envoltura(html, fondo, esMini){
  const suelo = fondo === "tinta" ? "#17150f" : fondo === "papel" ? "#efebe1" : "#7e7b73";
  const color = fondo === "tinta" ? "#efebe1" : "#17150f";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  html,body{height:100%;margin:0;overflow:hidden}
  body{display:grid;place-items:center;padding:${esMini ? 14 : 28}px;
       background:${suelo};color:${color};
       font-family:"Archivo",system-ui,sans-serif;
       ${esMini ? "zoom:.86;" : ""}}
</style></head><body>${html}</body></html>`;
}

/* ---------- la mesa ---------- */

function columnas(){
  return getComputedStyle(tabla).gridTemplateColumns.split(" ").filter(Boolean).length;
}

function alternar(p, boton){
  const abierta = tabla.querySelector(".mesa");
  const eraEsta = estado.abierta === p.id;
  if(abierta) abierta.remove();
  tabla.querySelectorAll('.ventana[aria-expanded="true"]')
       .forEach(v => v.setAttribute("aria-expanded", "false"));
  if(eraEsta){ estado.abierta = null; return; }

  estado.abierta = p.id;
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

  const vista = document.createElement("div");
  vista.className = "mesa__vista fondo-" + (p.fondo || "carta");
  miniatura(p, vista, false);

  const lado = document.createElement("div");
  lado.className = "mesa__lado";

  const cabeza = document.createElement("div");
  cabeza.className = "mesa__cabeza";
  const nom = document.createElement("h2");
  nom.className = "mesa__nombre";
  nom.textContent = p.nombre;
  const etis = document.createElement("div");
  etis.className = "mesa__etis";
  p.etiquetas.forEach(t => {
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
  fuente(p.archivo).then(t => { pre.textContent = t; });

  const acciones = document.createElement("div");
  acciones.className = "mesa__acciones";

  const copiar = document.createElement("button");
  copiar.className = "boton";
  copiar.type = "button";
  copiar.textContent = "Copiar codigo";
  copiar.addEventListener("click", async () => {
    await navigator.clipboard.writeText(await fuente(p.archivo));
    copiar.textContent = "Copiado";
    copiar.dataset.hecho = "si";
    setTimeout(() => { copiar.textContent = "Copiar codigo"; delete copiar.dataset.hecho; }, 1400);
  });

  const abrir = document.createElement("a");
  abrir.className = "boton boton--llano";
  abrir.href = p.archivo;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  abrir.textContent = "Ver el archivo";

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
      vista.className = "mesa__vista fondo-" + clave;
      p.fondo = clave;
      miniatura(p, vista, false);
      [...fondos.children].forEach(x => x.setAttribute("aria-pressed", String(x === s)));
    });
    fondos.append(s);
  });

  acciones.append(copiar, abrir, fondos);
  lado.append(cabeza, nota, pre, acciones);
  m.append(vista, lado);
  return m;
}

/* ---------- controles ---------- */

document.querySelectorAll(".rail__b").forEach(b => {
  b.addEventListener("click", () => {
    estado.tipo = b.dataset.tipo;
    document.querySelectorAll(".rail__b")
      .forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    pintar();
  });
});

campo.addEventListener("input", () => { estado.texto = campo.value; pintar(); });

addEventListener("keydown", e => {
  if(e.key === "/" && document.activeElement !== campo){ e.preventDefault(); campo.focus(); }
  if(e.key === "Escape"){
    const m = tabla.querySelector(".mesa");
    if(m){
      m.remove();
      tabla.querySelectorAll('.ventana[aria-expanded="true"]')
           .forEach(v => { v.setAttribute("aria-expanded", "false"); v.focus(); });
      estado.abierta = null;
    }else if(document.activeElement === campo){
      campo.value = ""; estado.texto = ""; pintar();
    }
  }
});

addEventListener("resize", () => {
  if(!estado.abierta) return;
  const b = tabla.querySelector('.ventana[aria-expanded="true"]');
  const p = catalogo.find(x => x.id === estado.abierta);
  if(b && p){ estado.abierta = null; alternar(p, b); }
});

arrancar();
