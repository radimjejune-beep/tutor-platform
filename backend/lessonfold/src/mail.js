'use strict';
// Отправка писем через SMTP без внешних библиотек: SSL (465) или STARTTLS (587), AUTH LOGIN.
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { config } = require('./config');

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encWord = s => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');

function buildMessage({from,fromName,to,subject,text,html,attachments=[]}){
 for(const value of [from,fromName,to,subject])if(/[\r\n]/.test(String(value||'')))throw Error('Недопустимые символы в заголовках письма');
 for(const value of [from,to])if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value||'')))throw Error('Некорректный адрес почты');
 const alt='lf-alt-'+crypto.randomBytes(12).toString('hex'),mixed='lf-mix-'+crypto.randomBytes(12).toString('hex');
 const domain=String(from).split('@')[1]||'localhost';
 const type=attachments.length?`multipart/mixed; boundary="${mixed}"`:`multipart/alternative; boundary="${alt}"`;
 const headers=[`From: ${fromName?`${encWord(fromName)} <${from}>`:from}`,`To: ${to}`,`Subject: ${encWord(subject)}`,
  `Date: ${new Date().toUTCString().replace('GMT','+0000')}`,`Message-ID: <${crypto.randomBytes(16).toString('hex')}@${domain}>`,'MIME-Version: 1.0',`Content-Type: ${type}`];
 const part=(mime,body)=>[`--${alt}`,`Content-Type: ${mime}; charset=utf-8`,'Content-Transfer-Encoding: base64','',wrap76(b64(body||''))].join('\r\n');
 const alternative=part('text/plain',text)+'\r\n'+part('text/html',html)+`\r\n--${alt}--\r\n`;
 if(!attachments.length)return headers.join('\r\n')+'\r\n\r\n'+alternative;
 const files=attachments.map(file=>{
  if(!Buffer.isBuffer(file.data))throw Error('Некорректное вложение');
  const name=String(file.filename||'Teacher.pdf').replace(/[\/\\\x00-\x1f\x7f]/g,'_').slice(0,160);
  return [`--${mixed}`,'Content-Type: application/pdf',`Content-Disposition: attachment; filename="Teacher.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,'Content-Transfer-Encoding: base64','',wrap76(file.data.toString('base64'))].join('\r\n');
 });
 return headers.join('\r\n')+`\r\n\r\n--${mixed}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n`+alternative+files.join('\r\n')+`\r\n--${mixed}--\r\n`;
}

// Простой SMTP-диалог: ждём ответ с ожидаемым кодом на каждую команду
function smtpSend({host,port,secure,user,pass,from,to,data,timeout=20000}){
 return new Promise((resolve,reject)=>{
  let sock=secure?tls.connect({host,port,servername:host}):net.connect({host,port});
  let buf='',finished=false;const pending=[],responses=[];
  const timer=setTimeout(()=>fail(new Error('SMTP: нет ответа от сервера')),timeout);
  function fail(e){if(finished)return;finished=true;clearTimeout(timer);sock.destroy();while(pending.length)pending.shift().reject(e);reject(e);}
  function deliver(response){if(pending.length)pending.shift().resolve(response);else responses.push(response);}
  function onData(d){buf+=d.toString('utf8');let m;while((m=buf.match(/^(\d{3}) [^\r\n]*\r?\n/m))){const end=buf.indexOf(m[0])+m[0].length;deliver(buf.slice(0,end));buf=buf.slice(end);}}
  const attach=s=>{s.on('data',onData);s.on('error',fail);s.on('close',()=>{if(!finished)fail(new Error('SMTP: соединение закрыто'));});};attach(sock);
  const read=()=>responses.length?Promise.resolve(responses.shift()):new Promise((resolve,reject)=>pending.push({resolve,reject}));
  async function cmd(line,codes,label){
   const response=read();if(line!==null)sock.write(line+'\r\n');const text=await response,code=Number(text.slice(0,3));
   if(!codes.includes(code))throw new Error(label==='AUTH'?`SMTP AUTH: сервер отклонил вход (${code})`:`SMTP ${label}: ответ ${code}`);
   return text;
  }
  (async()=>{
   await cmd(null,[220],'приветствие');let ehlo=await cmd('EHLO lessonfold',[250],'EHLO');
   if(!secure){
    if(!/STARTTLS/i.test(ehlo))throw Error('SMTP: сервер не поддерживает STARTTLS; пароль не отправлен');
    await cmd('STARTTLS',[220],'STARTTLS');sock.removeListener('data',onData);
    sock=tls.connect({socket:sock,servername:host});attach(sock);
    await new Promise((r,j)=>{sock.once('secureConnect',r);sock.once('error',j);});
    await cmd('EHLO lessonfold',[250],'EHLO');
   }
   if(user){await cmd('AUTH LOGIN',[334],'AUTH');await cmd(b64(user),[334],'AUTH');await cmd(b64(pass),[235],'AUTH');}
   await cmd(`MAIL FROM:<${from}>`,[250],'MAIL FROM');await cmd(`RCPT TO:<${to}>`,[250,251],'RCPT TO');await cmd('DATA',[354],'DATA');
   await cmd(data.replace(/\r?\n\./g,'\r\n..')+'\r\n.',[250],'DATA');
   finished=true;clearTimeout(timer);sock.write('QUIT\r\n');sock.end();resolve(true);
  })().catch(fail);
 });
}

// Отправить письмо. Если почта не настроена, возвращает { sent: false } и пишет в лог.
async function send({ to, subject, text, html, attachments=[] }) {
  if (!config.mailEnabled) {
    console.log(`[почта не настроена] письмо для ${to}: ${subject}`);
    return { sent: false, error: 'Почта не настроена (SMTP_HOST, MAIL_FROM)' };
  }
  try {
    const data = buildMessage({ from: config.mailFrom, fromName: 'Lessonfold', to, subject, text, html, attachments });
    await smtpSend({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, user: config.smtpUser, pass: config.smtpPass, from: config.mailFrom, to, data });
    return { sent: true };
  } catch (e) {
    let error=String(e.message||e);for(const secret of [config.smtpPass,config.smtpPass&&b64(config.smtpPass)].filter(Boolean))error=error.split(secret).join('***');
    console.error('mail failed:',error);
    return {sent:false,error};
  }
}

module.exports = { send, buildMessage, smtpSend };
