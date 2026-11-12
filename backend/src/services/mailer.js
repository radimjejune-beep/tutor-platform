// services/mailer.js: отправка писем через SMTP почты на домене (порт 465, сразу TLS).
// Без сторонних пакетов: короткий SMTP-диалог на встроенном модуле tls.
// Переменные: SMTP_HOST, SMTP_PORT (по умолчанию 465), SMTP_USER (ящик, например noreply@lessonfold.ru),
// SMTP_PASS (пароль ящика), MAIL_FROM_NAME (подпись отправителя, по умолчанию Lessonfold).
const tls = require('tls');
const crypto = require('crypto');

const cfg = () => ({
  host: process.env['SMTP_HOST'] || '',
  port: Number(process.env['SMTP_PORT'] || 465),
  user: process.env['SMTP_USER'] || '',
  pass: process.env['SMTP_PASS'] || '',
  name: process.env['MAIL_FROM_NAME'] || 'Lessonfold',
});
const configured = () => { const c = cfg(); return Boolean(c.host && c.user && c.pass); };

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const header = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');

function buildMessage({ from, name, to, subject, text }) {
  const domain = String(from).split('@')[1] || 'localhost';
  return [
    `From: ${header(name)} <${from}>`,
    `To: <${to}>`,
    `Subject: ${header(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(text)),
  ].join('\r\n');
}

// Ответ SMTP может быть многострочным: «250-…» продолжение, «250 …» конец
function dialog(socket) {
  let buf = '';
  const waiters = [];
  socket.on('data', (d) => {
    buf += d.toString('utf8');
    let m;
    while ((m = buf.match(/^(\d{3}) [^\r\n]*\r?\n/m))) {
      const end = buf.indexOf(m[0]) + m[0].length;
      const chunk = buf.slice(0, end);
      buf = buf.slice(end);
      const w = waiters.shift();
      if (w) w({ code: Number(m[1]), text: chunk.trim() });
    }
  });
  return (line, expect) => new Promise((resolve, reject) => {
    waiters.push(({ code, text }) => (expect.includes(code) ? resolve(text) : reject(new Error(`SMTP ${code}: ${text.slice(0, 200)}`))));
    if (line !== null) socket.write(`${line}\r\n`);
  });
}

async function send({ to, subject, text }) {
  const c = cfg();
  if (!configured()) { console.log(`✉️ Почта не настроена (SMTP_HOST, SMTP_USER, SMTP_PASS), письмо для ${to} не отправлено`); return false; }
  const socket = tls.connect({ host: c.host, port: c.port, servername: c.host });
  socket.setTimeout(20000, () => socket.destroy(new Error('SMTP: нет ответа')));
  const errors = new Promise((_, reject) => socket.once('error', reject));
  const say = dialog(socket);
  const run = async () => {
    await say(null, [220]);
    await say(`EHLO ${String(c.user).split('@')[1] || 'localhost'}`, [250]);
    await say('AUTH LOGIN', [334]);
    await say(b64(c.user), [334]);
    await say(b64(c.pass), [235]);
    await say(`MAIL FROM:<${c.user}>`, [250]);
    await say(`RCPT TO:<${to}>`, [250, 251]);
    await say('DATA', [354]);
    const body = buildMessage({ from: c.user, name: c.name, to, subject, text }).replace(/\r\n\./g, '\r\n..');
    await say(`${body}\r\n.`, [250]);
    socket.write('QUIT\r\n');
    socket.end();
  };
  try {
    await Promise.race([run(), errors]);
    console.log(`✉️ Письмо отправлено: ${to}`);
    return true;
  } catch (e) {
    socket.destroy();
    console.error(`❌ Письмо не отправлено (${to}): ${e.message}`);
    return false;
  }
}

module.exports = { send, configured, buildMessage };
