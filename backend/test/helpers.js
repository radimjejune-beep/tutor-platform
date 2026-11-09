// test/helpers.js — общие помощники для тестов (node --test).
// Маршруты вызываются без HTTP-сервера: express.Router подменяется записью маршрутов,
// а обработчики (в том числе настоящие проверки доступа) вызываются по цепочке с готовым req.user.
const Module = require('module');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const src = (p) => path.join(SRC, p);

// Если какой-то зависимости нет (например, в песочнице без npm), подставляем минимальную заглушку
const FALLBACK = {
  bcryptjs: { hash: async (s) => `h:${s}`, compare: async (s, h) => h === `h:${s}`, hashSync: (s) => `h:${s}`, compareSync: (s, h) => h === `h:${s}` },
  dotenv: { config: () => ({}) },
  'express-rate-limit': () => (req, res, next) => next(),
};

const routers = [];
function recorder() {
  const list = [];
  const add = (method) => (p, ...h) => { if (typeof p === 'function') { h.unshift(p); p = null; } list.push({ method, path: p, handlers: h.flat() }); return r; };
  const r = { routes: list, use: add('USE'), get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE') };
  routers.push(r);
  return r;
}

const origLoad = Module._load;
let realExpress;
Module._load = function load(request, ...rest) {
  if (request === 'express') {
    if (realExpress === undefined) {
      try { realExpress = origLoad.call(this, request, ...rest); } catch { realExpress = null; }
    }
    const base = realExpress || (() => {});
    const fake = (...a) => base(...a);
    Object.assign(fake, realExpress || {}, {
      json: () => (req, res, next) => next(),
      raw: () => (req, res, next) => next(),
      urlencoded: () => (req, res, next) => next(),
      Router: recorder,
    });
    return fake;
  }
  try {
    return origLoad.call(this, request, ...rest);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && FALLBACK[request]) return FALLBACK[request];
    throw err;
  }
};

// Загрузить файл маршрутов и вернуть записанный роутер (или несколько, если файл создаёт их несколько)
function loadRoutes(file) {
  const before = routers.length;
  const mod = require(src(file));
  return { mod, routers: routers.slice(before) };
}

// Вызвать маршрут: сначала общие router.use, затем обработчики маршрута
async function call(router, method, routePath, { user, body = {}, params = {}, query = {}, ip = '127.0.0.1' } = {}) {
  const route = router.routes.find((x) => x.method === method && x.path === routePath);
  if (!route) throw new Error(`Нет маршрута ${method} ${routePath}`);
  const chain = [...router.routes.filter((x) => x.method === 'USE' && !x.path).flatMap((x) => x.handlers), ...route.handlers];
  const out = { status: 200, body: undefined, done: false };
  let finish;
  const ended = new Promise((resolve) => { finish = resolve; });
  const res = {
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; out.done = true; finish(); return this; },
    send(b) { out.body = b; out.done = true; finish(); return this; },
    set() { return this; },
    setHeader() {},
    writeHead(s, h) { out.status = s; out.headers = h; return this; },
    write(chunk) { (out.chunks = out.chunks || []).push(Buffer.from(chunk)); return true; },
    once() {},
    end() { if (out.chunks) out.body = Buffer.concat(out.chunks); out.done = true; finish(); },
  };
  const req = { user, body, params, query, ip, headers: {}, get: () => undefined };
  for (const h of chain) {
    let err = null;
    let advanced = false;
    await Promise.race([
      new Promise((resolve) => { const r = h(req, res, (e) => { err = e || null; advanced = true; resolve(); }); if (r && typeof r.then === 'function') r.then(() => { if (out.done) resolve(); }, (e) => { err = e; advanced = true; resolve(); }); }),
      ended,
    ]);
    if (err) throw err;
    if (out.done || !advanced) break;
  }
  return out;
}

const uniq = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

module.exports = { src, loadRoutes, call, uniq, hasDb: Boolean(process.env.DATABASE_URL) };
