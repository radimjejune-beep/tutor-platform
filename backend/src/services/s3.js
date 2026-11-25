// services/s3.js — S3-совместимое хранилище в России (Yandex Object Storage, Selectel, VK Cloud).
// Без сторонних библиотек: подпись запросов AWS Signature V4.
// Переменные окружения:
//   S3_ENDPOINT    https://storage.yandexcloud.net (по умолчанию)
//   S3_REGION      ru-central1 (по умолчанию)
//   S3_BUCKET      имя бакета
//   S3_ACCESS_KEY  идентификатор статического ключа
//   S3_SECRET_KEY  секрет статического ключа
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const http = require('http');

const cfg = () => ({
  endpoint: (process.env['S3_ENDPOINT'] || 'https://storage.yandexcloud.net').replace(/\/+$/, ''),
  region: process.env['S3_REGION'] || 'ru-central1',
  bucket: process.env['S3_BUCKET'] || '',
  key: process.env['S3_ACCESS_KEY'] || '',
  secret: process.env['S3_SECRET_KEY'] || '',
});
const enabled = () => { const c = cfg(); return Boolean(c.bucket && c.key && c.secret); };

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const encPath = (p) => p.split('/').map((x) => encodeURIComponent(x).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');

// Чистая подпись SigV4 (проверяется на эталонном примере из документации AWS в тестах)
function signRaw({ method, path, host, query = {}, headers = {}, payloadHash, amzDate, region, key, secret }) {
  const day = amzDate.slice(0, 8);
  const h = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])) };
  const names = Object.keys(h).sort();
  const canonicalQuery = Object.keys(query).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&');
  const canonical = [method, encPath(path), canonicalQuery, names.map((n) => `${n}:${h[n].trim()}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const kSign = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSign).update(toSign).digest('hex');
  h.authorization = `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return { headers: h, signature, canonicalQuery };
}

function sign(method, objectKey, { query = {}, headers = {} } = {}) {
  const c = cfg();
  const path = `/${c.bucket}/${objectKey}`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const r = signRaw({ method, path, host: new URL(c.endpoint).host, query, headers, payloadHash: 'UNSIGNED-PAYLOAD', amzDate, region: c.region, key: c.key, secret: c.secret });
  return { url: `${c.endpoint}${encPath(path)}${r.canonicalQuery ? `?${r.canonicalQuery}` : ''}`, headers: r.headers };
}

const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_NETWORK = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ERR_STREAM_PREMATURE_CLOSE']);

class S3Error extends Error {
  constructor(method, { statusCode = 0, code = 'StorageError', requestId = '', retryable = false, attempts = 1 } = {}) {
    super(`S3 ${method} ${statusCode || 'network'} (${code})${requestId ? `; request ${requestId}` : ''}`);
    this.name = 'S3Error'; this.method = method; this.statusCode = statusCode;
    this.code = code; this.requestId = requestId; this.retryable = retryable; this.attempts = attempts;
  }
}
const safeDetail = value => String(value || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120);

function requestOnce(method, objectKey, { query, headers, body, timeoutMs }) {
  const signed = sign(method, objectKey, { query, headers });
  const url = new URL(signed.url), lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    // A stream is recreated for every attempt; a consumed stream cannot be replayed.
    let payload, done = false, response, timer;
    const finish = (error, value) => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (error) {
        if (payload && typeof payload.unpipe === 'function') { payload.unpipe(req); payload.destroy(); }
        response?.destroy(); req.destroy(); reject(error);
      } else resolve(value);
    };
    const req = lib.request(url, { method, headers: signed.headers }, res => {
      response = res;
      const chunks = []; let errorBytes = 0;
      res.on('data', chunk => {
        if (res.statusCode < 300) chunks.push(chunk);
        else if (errorBytes < 8192) { chunks.push(chunk.subarray(0, 8192 - errorBytes)); errorBytes += chunk.length; }
      });
      res.on('error', error => finish(error));
      res.on('aborted', () => finish(Object.assign(new Error('S3 response interrupted'), { code: 'ECONNRESET' })));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 300) {
          const xml = buf.toString('utf8');
          const code = safeDetail(xml.match(/<Code>([^<]*)<\/Code>/)?.[1]) || 'HttpError';
          const requestId = safeDetail(res.headers['x-amz-request-id'] || xml.match(/<RequestId>([^<]*)<\/RequestId>/)?.[1]);
          return finish(new S3Error(method, { statusCode: res.statusCode, code, requestId, retryable: RETRY_STATUS.has(res.statusCode) }));
        }
        finish(null, { status: res.statusCode, body: buf, headers: res.headers });
      });
    });
    req.on('error', error => finish(error));
    timer = setTimeout(() => finish(Object.assign(new Error('S3 request timeout'), { code: 'ETIMEDOUT' })), timeoutMs);
    try { payload = typeof body === 'function' ? body() : body; } catch (error) { finish(error); return; }
    if (payload && typeof payload.pipe === 'function') { payload.on('error', error => finish(error)); payload.pipe(req); }
    else req.end(payload);
  });
}

async function request(method, objectKey, options = {}) {
  // Buffer uploads stay inside the browser's 30s API timeout. Large disk backups
  // retain a separate ten-minute budget. Only the same S3 object is retried.
  const deadline = Date.now() + (options.timeoutMs || 25000);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await requestOnce(method, objectKey, { ...options, timeoutMs: Math.max(1, deadline - Date.now()) }); }
    catch (error) {
      const failure = error instanceof S3Error ? error : new S3Error(method, { code: safeDetail(error.code) || 'NetworkError', retryable: RETRY_NETWORK.has(error.code) });
      failure.attempts = attempt;
      const delay = Math.round(200 * 2 ** (attempt - 1) + Math.random() * 100);
      if (!failure.retryable || attempt === 3 || Date.now() + delay >= deadline) throw failure;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Загрузить файл с диска: при повторе открываем новый поток с начала файла.
async function putFile(objectKey, filePath, contentType = 'application/octet-stream') {
  const size = fs.statSync(filePath).size;
  return request('PUT', objectKey, { headers: { 'content-type': contentType, 'content-length': size }, body: () => fs.createReadStream(filePath), timeoutMs: 10 * 60 * 1000 });
}
const putBuffer = (objectKey, buf, contentType = 'application/octet-stream') =>
  request('PUT', objectKey, { headers: { 'content-type': contentType, 'content-length': buf.length }, body: buf });
const getBuffer = async objectKey => (await request('GET', objectKey)).body;
const remove = objectKey => request('DELETE', objectKey).catch(() => null);

// Список объектов по префиксу: [{ key, size, modified }]
async function list(prefix) {
  const out = [];
  let token = null;
  do {
    const query = { 'list-type': '2', prefix };
    if (token) query['continuation-token'] = token;
    const xml = (await request('GET', '', { query })).body.toString('utf8');
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const pick = (tag) => (m[1].match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1];
      out.push({ key: pick('Key'), size: Number(pick('Size') || 0), modified: new Date(pick('LastModified')) });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]*)</) || [])[1] : null;
  } while (token);
  return out;
}

module.exports = { enabled, putFile, putBuffer, getBuffer, remove, list, sign, signRaw, S3Error };
