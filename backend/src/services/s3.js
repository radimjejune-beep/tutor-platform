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

function request(method, objectKey, { query, headers, body } = {}) {
  const s = sign(method, objectKey, { query, headers });
  const u = new URL(s.url);
  const lib = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(u, { method, headers: s.headers, timeout: 10 * 60 * 1000 }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 300) return reject(new Error(`S3 ${method} ${res.statusCode}: ${buf.toString('utf8').slice(0, 300)}`));
        resolve({ status: res.statusCode, body: buf, headers: res.headers });
      });
    });
    req.on('timeout', () => req.destroy(new Error('S3: истекло время ожидания')));
    req.on('error', reject);
    if (body && typeof body.pipe === 'function') body.pipe(req);
    else req.end(body);
  });
}

// Загрузить файл с диска (поток, без чтения в память)
async function putFile(objectKey, filePath, contentType = 'application/octet-stream') {
  const size = fs.statSync(filePath).size;
  return request('PUT', objectKey, { headers: { 'content-type': contentType, 'content-length': size }, body: fs.createReadStream(filePath) });
}
const putBuffer = (objectKey, buf, contentType = 'application/octet-stream') =>
  request('PUT', objectKey, { headers: { 'content-type': contentType, 'content-length': buf.length }, body: buf });
const getBuffer = async (objectKey) => (await request('GET', objectKey)).body;
const remove = (objectKey) => request('DELETE', objectKey).catch(() => null);

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

module.exports = { enabled, putFile, putBuffer, getBuffer, remove, list, sign, signRaw };
