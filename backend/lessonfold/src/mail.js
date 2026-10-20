'use strict';
// Отправка писем через SMTP без внешних библиотек: SSL (465) или STARTTLS (587), AUTH LOGIN.
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { config } = require('./config');

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encWord = s => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');

function buildMessage({ from, fromName, to, subject, text, html }) {
  const boundary = 'lf' + crypto.randomBytes(12).toString('hex');
  const domain = String(from).split('@')[1] || 'localhost';
  const headers = [
    `From: ${fromName ? `${encWord(fromName)} <${from}>` : from}`,
    `To: ${to}`,
    `Subject: ${encWord(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=utf-8`, 'Content-Transfer-Encoding: base64', '', wrap76(b64(body))].join('\r\n');
  return headers.join('\r\n') + '\r\n\r\n' + part('text/plain', text) + '\r\n' + part('text/html', html) + `\r\n--${boundary}--\r\n`;
}

// Простой SMTP-диалог: ждём ответ с ожидаемым кодом на каждую команду
function smtpSend({ host, port, secure, user, pass, from, to, data, timeout = 20000 }) {
  return new Promise((resolve, reject) => {
    let sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buf = '';
    let waiter = null;
    const fail = e => { try { sock.destroy(); } catch {} reject(e); };
    const timer = setTimeout(() => fail(new Error('SMTP: нет ответа от сервера')), timeout);
    const onData = d => {
      buf += d.toString('utf8');
      const lines = buf.split('\r\n');
      // ответ закончен, когда последняя полная строка имеет вид "250 текст" (без дефиса)
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const resp = lines.slice(0, i + 1).join('\n');
          buf = lines.slice(i + 1).join('\r\n');
          const w = waiter; waiter = null;
          if (w) w(resp);
          return;
        }
      }
    };
    const attach = s => { s.on('data', onData); s.on('error', fail); };
    attach(sock);
    const read = () => new Promise(r => { waiter = r; });
    const cmd = async (line, okCodes) => {
      if (line !== null) sock.write(line + '\r\n');
      const resp = await read();
      const code = Number(resp.slice(0, 3));
      if (!okCodes.includes(code)) throw new Error(`SMTP ${line ? line.split(' ')[0] : 'приветствие'}: ${resp.replace(/\n/g, ' ').slice(0, 200)}`);
      return resp;
    };
    (async () => {
      await cmd(null, [220]);
      let ehlo = await cmd('EHLO lessonfold', [250]);
      if (!secure && /STARTTLS/i.test(ehlo)) {
        await cmd('STARTTLS', [220]);
        sock.removeListener('data', onData);
        sock = tls.connect({ socket: sock, servername: host });
        attach(sock);
        await new Promise((r, j) => { sock.once('secureConnect', r); sock.once('error', j); });
        ehlo = await cmd('EHLO lessonfold', [250]);
      }
      if (user) {
        await cmd('AUTH LOGIN', [334]);
        await cmd(b64(user), [334]);
        await cmd(b64(pass), [235]);
      }
      await cmd(`MAIL FROM:<${from}>`, [250]);
      await cmd(`RCPT TO:<${to}>`, [250, 251]);
      await cmd('DATA', [354]);
      await cmd(data.replace(/\r?\n\./g, '\r\n..') + '\r\n.', [250]);
      sock.write('QUIT\r\n');
      clearTimeout(timer);
      sock.end();
      resolve(true);
    })().catch(e => { clearTimeout(timer); fail(e); });
  });
}

// Отправить письмо. Если почта не настроена, возвращает { sent: false } и пишет в лог.
async function send({ to, subject, text, html }) {
  if (!config.mailEnabled) {
    console.log(`[почта не настроена] письмо для ${to}: ${subject}`);
    return { sent: false, error: 'Почта не настроена (SMTP_HOST, MAIL_FROM)' };
  }
  const data = buildMessage({ from: config.mailFrom, fromName: 'Lessonfold', to, subject, text, html });
  try {
    await smtpSend({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, user: config.smtpUser, pass: config.smtpPass, from: config.mailFrom, to, data });
    return { sent: true };
  } catch (e) {
    console.error('mail failed', to, e.message);
    return { sent: false, error: e.message };
  }
}

module.exports = { send, buildMessage };
