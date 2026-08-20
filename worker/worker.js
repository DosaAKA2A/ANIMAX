/* ANIMAX — API de la biblioteca. Mismo patron que el worker de MOOVIN.
   ---------------------------------------------------------------------------
   El repositorio de GitHub es PUBLICO y solo lleva el armazon del sitio. El
   contenido con derechos (piezas, SVGs, logos y sobre todo la musica de
   tunes/) NO entra ahi: vive en el bucket R2 "animax", que no tiene URL
   publica, y lo sirve unicamente este worker previo pase.

   Esa es la diferencia que importa: un pase escrito en JavaScript sobre
   GitHub Pages solo esconde la interfaz, porque los archivos se bajan igual
   por su URL. Aqui el archivo no tiene URL que valga sin token.

   Publico:
     GET  /health                   -> ok
     POST /entrar {pase}            -> {token, exp}; el pase es ANIMAX_PASE
   Con pase (?t=<token> o Authorization: Bearer <token>):
     GET  /catalogo                 -> {fichas:[]} guardado en el bucket
     GET  /archivo?key=             -> el archivo, con rangos (el audio los pide)
     GET  /descargar?key=&n=        -> el mismo archivo como adjunto
   Con token de administracion (Authorization: Bearer <ANIMAX_TOKEN>):
     GET    /api/check              -> comprueba el token
     GET    /api/pase               -> token de pase (para <img> y <audio>)
     GET    /api/listar?prefijo=    -> que hay en el bucket
     PUT    /api/catalogo           -> reemplaza catalogo.json (valida JSON)
     PUT    /api/objeto?key=        -> sube un archivo
     DELETE /api/objeto?key=        -> borra un archivo
     POST   /api/multipart/create   -> {key, contentType} -> {uploadId}
     PUT    /api/multipart/part?key&uploadId&part
     POST   /api/multipart/complete -> {key, uploadId, parts:[{part,etag}]}
     POST   /api/multipart/abort    -> {key, uploadId}

   El multipart existe por los tunes: cada request a un Worker admite ~100 MB
   de cuerpo, y un WAV largo se pasa. Los sube troceados y R2 los une.

   El token del pase va firmado (HMAC-SHA256 con ANIMAX_TOKEN de clave) y lleva
   dentro su caducidad, asi que no hay que guardar nada: el worker lo verifica
   solo. Dura una semana, que es lo razonable para una herramienta de trabajo.

   Desplegar:  npx wrangler deploy      (desde worker/)
   Secretos:   npx wrangler secret put ANIMAX_TOKEN   (administracion)
               npx wrangler secret put ANIMAX_PASE    (pase de la biblioteca)
*/
const TTL_PASE = 7 * 24 * 3600;
const CATALOGO = 'catalogo.json';

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Comparacion en tiempo constante: comparar con === filtra el secreto letra a letra.
function igual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function firma(env, texto) {
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode((env.ANIMAX_TOKEN || '').trim()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(texto)));
}
async function nuevoToken(env) {
  const exp = Math.floor(Date.now() / 1000) + TTL_PASE;
  return { token: exp + '.' + await firma(env, String(exp)), exp };
}
async function tokenOk(env, t) {
  const i = String(t || '').indexOf('.');
  if (i < 1) return false;
  const exp = parseInt(t.slice(0, i), 10);
  if (!(exp > Math.floor(Date.now() / 1000))) return false;
  return igual(t.slice(i + 1), await firma(env, String(exp)));
}
const keyMala = (k) => !k || k === CATALOGO || k.indexOf('..') !== -1;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, s) => new Response(JSON.stringify(o), {
      status: s || 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });

    if (url.pathname === '/health') return new Response('ok', { headers: cors });

    /* trim(): al poner un secret por stdin en Windows se cuela un \r final. */
    const bearer = (req.headers.get('Authorization') || '').trim().replace(/^Bearer\s+/i, '');
    const admin = igual(bearer, (env.ANIMAX_TOKEN || '').trim());

    /* Entrar con el pase -> token firmado con caducidad. */
    if (url.pathname === '/entrar' && req.method === 'POST') {
      let pase = '';
      try { pase = String((await req.json()).pase || '').trim(); } catch (e) { /* cuerpo raro */ }
      if (!igual(pase, (env.ANIMAX_PASE || '').trim())) return json({ error: 'pase incorrecto' }, 401);
      return json(await nuevoToken(env));
    }

    /* ---- de aqui en adelante hace falta el pase (o ser administracion) ---- */
    const pasa = admin || await tokenOk(env, url.searchParams.get('t') || bearer);
    const sinPase = () => json({ error: 'hace falta el pase' }, 401);

    if (url.pathname === '/catalogo' && req.method === 'GET') {
      if (!pasa) return sinPase();
      const obj = await env.ANIMAX.get(CATALOGO);
      if (!obj) return json({ fichas: [] });
      return new Response(obj.body, {
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    /* Servir un archivo del bucket, para verlo (/archivo) o para guardarlo
       (/descargar, que ademas manda Content-Disposition).
       Pasa los rangos: el <audio> los pide para poder saltar dentro del tune. */
    if ((url.pathname === '/archivo' || url.pathname === '/descargar')
      && (req.method === 'GET' || req.method === 'HEAD')) {
      if (!pasa) return sinPase();
      const key = url.searchParams.get('key') || '';
      if (keyMala(key)) return json({ error: 'key invalida' }, 400);
      const rango = req.headers.get('range');
      let obj;
      try { obj = await env.ANIMAX.get(key, { range: req.headers }); }
      catch (e) { return json({ error: 'rango invalido' }, 416); }
      if (!obj) return json({ error: 'no existe' }, 404);
      const h = new Headers(cors);
      obj.writeHttpMetadata(h);
      h.set('Accept-Ranges', 'bytes');
      h.set('ETag', obj.httpEtag);
      // Privado: que no se quede en caches compartidas por el camino.
      h.set('Cache-Control', 'private, max-age=3600');
      if (url.pathname === '/descargar') {
        const nombre = (url.searchParams.get('n') || key.split('/').pop() || 'descarga')
          .replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120);
        h.set('Content-Disposition', 'attachment; filename="' + nombre + '"');
      }
      const cuerpo = req.method === 'HEAD' ? null : obj.body;
      if (rango && obj.range) {
        const ini = obj.range.offset || 0;
        const largo = obj.range.length != null ? obj.range.length : obj.size - ini;
        h.set('Content-Range', 'bytes ' + ini + '-' + (ini + largo - 1) + '/' + obj.size);
        h.set('Content-Length', String(largo));
        return new Response(cuerpo, { status: 206, headers: h });
      }
      h.set('Content-Length', String(obj.size));
      return new Response(cuerpo, { headers: h });
    }

    /* ---- de aqui en adelante hace falta el token de administracion ---- */
    if (!admin) return json({ error: 'no autorizado' }, 401);

    if (url.pathname === '/api/check') return json({ ok: true });

    /* Un <img> o un <audio> no pueden mandar cabeceras, asi que necesitan el
       token en la URL. Mejor uno de pase que pasear el de administracion. */
    if (url.pathname === '/api/pase') return json(await nuevoToken(env));

    if (url.pathname === '/api/listar' && req.method === 'GET') {
      const prefijo = url.searchParams.get('prefijo') || '';
      const lista = await env.ANIMAX.list({ prefix: prefijo, limit: 1000 });
      return json({
        n: lista.objects.length,
        truncado: lista.truncated || false,
        objetos: lista.objects.map((o) => ({ key: o.key, tam: o.size, fecha: o.uploaded }))
      });
    }

    if (url.pathname === '/api/catalogo' && req.method === 'PUT') {
      const body = await req.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { return json({ error: 'JSON invalido' }, 400); }
      /* Solo se guardan las FICHAS. Las secciones son estructura, no contenido
         con derechos, y viven en el catalogo.json del repo publico. */
      if (!parsed || !Array.isArray(parsed.fichas)) return json({ error: 'falta fichas[]' }, 400);
      await env.ANIMAX.put(CATALOGO, body, {
        httpMetadata: { contentType: 'application/json' }
      });
      return json({ ok: true, n: parsed.fichas.length });
    }

    if (url.pathname === '/api/objeto') {
      const key = url.searchParams.get('key') || '';
      if (keyMala(key)) return json({ error: 'key invalida' }, 400);
      if (req.method === 'PUT') {
        await env.ANIMAX.put(key, req.body, {
          httpMetadata: { contentType: req.headers.get('Content-Type') || 'application/octet-stream' }
        });
        return json({ ok: true, key });
      }
      if (req.method === 'DELETE') {
        await env.ANIMAX.delete(key);
        return json({ ok: true });
      }
      return json({ error: 'metodo' }, 405);
    }

    if (url.pathname === '/api/multipart/create' && req.method === 'POST') {
      const { key, contentType } = await req.json();
      if (keyMala(key)) return json({ error: 'key invalida' }, 400);
      const up = await env.ANIMAX.createMultipartUpload(key, {
        httpMetadata: { contentType: contentType || 'application/octet-stream' }
      });
      return json({ uploadId: up.uploadId });
    }

    if (url.pathname === '/api/multipart/part' && req.method === 'PUT') {
      const key = url.searchParams.get('key');
      const uploadId = url.searchParams.get('uploadId');
      const part = parseInt(url.searchParams.get('part'), 10);
      if (!key || !uploadId || !(part >= 1)) return json({ error: 'parametros' }, 400);
      const up = env.ANIMAX.resumeMultipartUpload(key, uploadId);
      try {
        const p = await up.uploadPart(part, req.body);
        return json({ etag: p.etag, part });
      } catch (e) {
        return json({ error: String(e.message || e) }, 400);
      }
    }

    if (url.pathname === '/api/multipart/complete' && req.method === 'POST') {
      const { key, uploadId, parts } = await req.json();
      const up = env.ANIMAX.resumeMultipartUpload(key, uploadId);
      try {
        await up.complete((parts || []).map((p) => ({ partNumber: p.part, etag: p.etag })));
        return json({ ok: true, key });
      } catch (e) {
        return json({ error: String(e.message || e) }, 400);
      }
    }

    if (url.pathname === '/api/multipart/abort' && req.method === 'POST') {
      const { key, uploadId } = await req.json();
      try { await env.ANIMAX.resumeMultipartUpload(key, uploadId).abort(); } catch (e) { /* ya no existe */ }
      return json({ ok: true });
    }

    return json({ error: 'ruta desconocida' }, 404);
  }
};
