// services/telegram.js — бот: привязка учеников, родителей и преподавателя, уведомления, команды, итоги урока.
// Один бот на всё. Если бот магазина (LF_BOT_TOKEN) тот же или TELEGRAM_BOT_TOKEN не задан, сообщения читает
// магазин и сначала отдаёт их сюда: подключённые ученики и родители получают учебное меню, остальные попадают в магазин.
// Если задан отдельный TELEGRAM_BOT_TOKEN, этот бот работает сам по себе (long polling, вебхук не нужен).
const crypto = require('crypto');
const { query } = require('../db');

const OWN_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';
const SHOP_TOKEN = process.env['LF_BOT_TOKEN'] || '';
const SHOP_ON = Boolean(SHOP_TOKEN && process.env['LF_PUBLIC_URL']);
// Общий бот с магазином: токены совпадают или свой токен не задан
const SHARED = SHOP_ON && (!OWN_TOKEN || OWN_TOKEN === SHOP_TOKEN);
const TOKEN = OWN_TOKEN || SHOP_TOKEN;
const API = process.env['TELEGRAM_API_URL'] || 'https://api.telegram.org';
const TZ = process.env['APP_TIMEZONE'] || 'Europe/Moscow';

let botUsername = null;
let running = false;

async function call(method, body) {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(40000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  return data.result;
}

const enabled = () => Boolean(TOKEN);
const username = () => botUsername;
const sendMessage = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra });

// Постоянное меню соответствует привязанной роли. Выбор роли без привязки не даёт доступа.
const STUDY={lessons:'Расписание',homework:'Домашка',words:'Слова',cabinet:'Кабинет',grammar:'Вспомнить тему',progress:'Мой прогресс',help:'Помощь',menu:'Главное меню',shop:'Магазин материалов'};
const TUTOR={today:'Сегодня',check:'На проверку',students:'Ученики',materials:'Мои материалы'};
function roleKeyboard(user){
 const layout=user.role==='tutor'?[[TUTOR.today,TUTOR.check],[TUTOR.students,TUTOR.materials],[STUDY.cabinet,STUDY.shop],['Мои покупки',STUDY.help]]:
 user.role==='parent'?[['Мои дети',STUDY.lessons],[STUDY.homework,'Результаты'],[STUDY.cabinet,STUDY.help]]:
 [[STUDY.lessons,STUDY.homework],[STUDY.words,STUDY.grammar],[STUDY.progress,STUDY.cabinet],[STUDY.help]];
 return {keyboard:layout.map(r=>r.filter(x=>SHARED||x!==STUDY.shop).map(text=>({text}))).filter(r=>r.length),resize_keyboard:true,is_persistent:true};
}
function roleCommands(user){
 return [{command:'menu',description:'Главное меню'},...(user.role==='tutor'?[{command:'today',description:'Уроки сегодня'},{command:'check',description:'Работы на проверку'}]:[{command:'lessons',description:'Ближайшие уроки'},{command:'homework',description:'Домашние работы и диагностики'},{command:'words',description:'Слова на повторение'}]),{command:'help',description:'Помощь'},{command:'stop',description:'Отключить уведомления'}];
}
async function linkedUser(chatId){
 const {rows}=await query(`SELECT u.id,u.role,u.full_name,u.tutor_id FROM telegram_links tl JOIN users u ON u.id=tl.user_id
 LEFT JOIN users owner ON owner.id=u.tutor_id WHERE tl.chat_id=$1 AND u.is_active
 AND (u.role='tutor' OR (owner.role='tutor' AND owner.is_active))`,[chatId]);return rows[0];
}
async function educationAllowed(userOrId){
 let user=userOrId;
 if(typeof userOrId!=='object'){const {rows:[u]}=await query(`SELECT u.id,u.role,u.tutor_id FROM users u LEFT JOIN users owner ON owner.id=u.tutor_id WHERE u.id=$1 AND u.is_active AND (u.role='tutor' OR(owner.role='tutor' AND owner.is_active))`,[userOrId]);user=u;}
 if(!user)return false;
 return (await require('./guardians').status({...user,tid:user.role==='tutor'?user.id:user.tutor_id})).can_use;
}
async function consentWaiting(chatId){await say(chatId,{text:'Для учебных данных необходимо подтверждение документов родителем в отдельном родительском аккаунте. Откройте кабинет; преподаватель поможет с привязкой. До подтверждения учебные данные в боте закрыты.',buttons:buttonRows(btn('Открыть кабинет',cabinetUrl('/')))});}
async function showMenu(chatId,user){
 await call('setMyCommands',{commands:roleCommands(user),scope:{type:'chat',chat_id:chatId}}).catch(()=>{});
 await say(chatId,helpText(user),{keyboard:roleKeyboard(user)});
}
async function onboarding(chatId){
 await say(chatId,{text:'<b>Lessonfold</b>\nПреподавателю — уроки и проверка, ученику — домашка и слова, родителю — расписание и результаты.\n\nДля учебных данных войдите на сайт и нажмите «Подключить Telegram» в кабинете. Покупать материалы можно без привязки учебного аккаунта.',buttons:buttonRows(btn('Открыть кабинет',cabinetUrl('/login')),SHARED&&{text:'Магазин материалов',callback_data:'cat'})});
}

// ------------------------------------------------------------
// Ссылка для привязки: t.me/бот?start=код (код живёт 30 минут)
// ------------------------------------------------------------
async function createLinkCode(userId) {
  const code = `link_${crypto.randomBytes(16).toString('hex')}`;
  await query('DELETE FROM telegram_link_codes WHERE user_id = $1 OR expires_at < NOW()', [userId]);
  await query(
    "INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')",
    [code, userId]
  );
  return `https://t.me/${botUsername}?start=${code}`;
}

// Чьи итоги будет получать пользователь
async function studentNamesFor(userId) {
  const { rows } = await query(
    `SELECT s.full_name FROM students s WHERE s.user_id = $1
     UNION
     SELECT s.full_name FROM students s JOIN parent_students ps ON ps.student_id = s.id WHERE ps.parent_user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.full_name);
}

const isLinkCode = (c) => /^(link_)?[0-9a-f]{32}$/.test(c || '');

// Обработать сообщение. Возвращает true, если сообщение наше (иначе в общем режиме его получит магазин)
async function handleUpdate(u) {
  if(u.callback_query)return handleStudyCallback(u.callback_query);
  const msg = u.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private') return false;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const [first, param] = text.split(/\s+/);
  const cmd = (first || '').split('@')[0].toLowerCase();

  // Привязка по ссылке из кабинета
  if (cmd === '/start' && isLinkCode(param)) {
    await linkByCode(chatId, msg, param);
    return true;
  }

  const user=await linkedUser(chatId);

  if (cmd === '/stop') {
    if (!user && SHARED) return false;
    await query('DELETE FROM telegram_links WHERE chat_id = $1', [chatId]);
    if (user) await call('deleteMyCommands', { scope: { type: 'chat', chat_id: chatId } }).catch(() => {});
    await say(chatId, user ? '<b>Уведомления отключены</b>\nПодключить снова можно в личном кабинете.' : 'Уведомления и так не подключены.', { reply_markup: { remove_keyboard: true } });
    return true;
  }

  // Чужие сообщения в общем боте отдаём магазину
  if (!user) {
    if(cmd==='/start'&&!param||cmd==='/menu'||text===STUDY.menu){await onboarding(chatId);return true;}
    if (SHARED) return false;
    await say(chatId, 'Сначала подключите бота в личном кабинете Lessonfold: кнопка «Подключить Telegram».');
    return true;
  }

  // Ссылки конкретных покупок/бесплатных уроков сохраняют прежнюю маршрутизацию магазина.
  if(SHARED&&cmd==='/start'&&param)return false;
  if(SHARED&&((SHOP_TEXTS.has(text)&&text!==STUDY.help)||['/catalog','/mine','/free','/courses'].includes(cmd)))return false;
  if(!await educationAllowed(user)){await consentWaiting(chatId);return true;}
  if(cmd==='/start'||cmd==='/menu'||text===STUDY.menu||text===STUDY.help||cmd==='/help'){await showMenu(chatId,user);return true;}
  const handlers={
   [TUTOR.today]:cmdToday,[TUTOR.check]:cmdCheck,[TUTOR.students]:cmdStudents,[TUTOR.materials]:cmdMaterials,
   [STUDY.lessons]:cmdLessons,[STUDY.homework]:cmdHomework,[STUDY.words]:cmdWords,[STUDY.cabinet]:cmdCabinet,
   [STUDY.grammar]:cmdGrammar,[STUDY.progress]:cmdProgress,'Результаты':cmdProgress,'Мои дети':cmdChildren,
  };
  const handler=handlers[text]||COMMAND_HANDLERS[cmd];
  if(handler){await say(chatId,await handler(user));return true;}
  if(user.role==='tutor'){if(SHARED)return false;await showMenu(chatId,user);return true;}

  // Каталог уроков и прочие кнопки магазина в общем боте работают и для них
  if (SHARED && SHOP_TEXTS.has(text)) return false;
  if (SHARED && cmd !== '/start' && cmd.startsWith('/') && !COMMAND_HANDLERS[cmd]) return false;
  const hello = cmd === '/start' ? `<b>Здравствуйте, ${esc(user.full_name.split(' ')[0])}!</b>\n\n` : '';
  const h = helpText(user);
  await say(chatId, { text: hello + h.text, buttons: h.buttons }, { keyboard: roleKeyboard(user) });
  return true;
}

// Кнопки и команды магазина: ученик тоже может ими пользоваться в общем боте
const SHOP_TEXTS = new Set(['Мои покупки','Магазин материалов','Бесплатный урок', 'Каталог уроков', 'Курсы на год', 'Мои уроки', 'Помощь']);

// ------------------------------------------------------------
// Оформление: HTML-разметка и кнопки-ссылки под сообщением
// ------------------------------------------------------------
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const btn = (text, url) => (url && /^https:\/\//.test(url) ? { text, url } : null);
// Ряды кнопок: пустые убираем
const buttonRows = (...list) => list.map((r) => (Array.isArray(r) ? r : [r]).filter(Boolean)).filter((r) => r.length);

// Отправить ответ: строка или { text, buttons }. opts.keyboard — кнопки внизу экрана (вместо кнопок под сообщением)
async function say(chatId, reply, opts = {}) {
  const r = typeof reply === 'string' ? { text: reply } : reply;
  const extra = { parse_mode: 'HTML' };
  if (opts.reply_markup) extra.reply_markup = opts.reply_markup;
  else if (opts.keyboard) extra.reply_markup = opts.keyboard;
  else if (r.buttons && r.buttons.length) extra.reply_markup = { inline_keyboard: r.buttons };
  return sendMessage(chatId, safeText(r.text), extra);
}

async function linkByCode(chatId, msg, code) {
  const userId=await require('../db').transaction(async db=>{
    const {rows:found}=await db.query(`SELECT c.user_id FROM telegram_link_codes c JOIN users u ON u.id=c.user_id
     LEFT JOIN users owner ON owner.id=u.tutor_id WHERE c.code=$1 AND c.expires_at>NOW() AND u.is_active
     AND (u.role='tutor' OR (owner.role='tutor' AND owner.is_active)) FOR UPDATE OF c`,[code]);
    if(!found[0])return null;
    const uid=found[0].user_id;
    await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[uid]);
    await db.query('DELETE FROM telegram_links WHERE chat_id=$1 AND user_id<>$2',[chatId,uid]);
    await db.query(`INSERT INTO telegram_links(user_id,chat_id,username) VALUES($1,$2,$3)
     ON CONFLICT(user_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,username=EXCLUDED.username,linked_at=NOW()`,[uid,chatId,msg.from?.username||null]);
    await db.query('DELETE FROM telegram_link_codes WHERE user_id=$1',[uid]);return uid;
  });
  if(!userId){await say(chatId,'<b>Ссылка недоступна или устарела</b>\nПодключите Telegram заново из своего кабинета.');return;}
  const user=await linkedUser(chatId);
  if(!user){await onboarding(chatId);return;}
  if(!await educationAllowed(user)){await consentWaiting(chatId);return;}
  await say(chatId,'<b>Бот подключён</b>\nУведомления будут приходить сюда. Учебные данные доступны только вашему привязанному аккаунту. Отключить уведомления можно командой /stop.');
  await showMenu(chatId,user);
  console.log(`✅ Telegram подключён (пользователь #${userId})`);
}

async function cmdCabinet() {
  return { text: '<b>Личный кабинет</b>\nРасписание, задания, слова и прогресс.', buttons: buttonRows(btn('Открыть кабинет', cabinetUrl('/'))) };
}

// ------------------------------------------------------------
// Команды бота: ближайшие уроки, домашние задания, слова на повторение
// ------------------------------------------------------------
const COMMANDS = [
  { command: 'lessons', description: 'Ближайшие уроки' },
  { command: 'homework', description: 'Что задано' },
  { command: 'words', description: 'Слова на повторение' },
  { command: 'today', description: 'Уроки сегодня (для преподавателя)' },
  { command: 'check', description: 'Задания на проверку (для преподавателя)' },
  { command: 'stop', description: 'Отключить уведомления' },
];

const site = () => (process.env.FRONTEND_ORIGINS || '').split(',')[0].trim().replace(/\/$/, '');
// Ссылка в кабинет: на фронтенде hash-маршруты
const cabinetUrl = (path = '') => (site() ? `${site()}/#${path.startsWith('/') ? path : `/${path}`}` : '');

const fmtWeekday = (d) => {
  const s = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtTime = (d) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const fmtDay = (d) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${String(d).slice(0, 10)}T12:00:00`));
const plural = (n, a, b, c) => { const x = Math.abs(n) % 100; const y = x % 10; return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c; };

// Ученики, к которым относится пользователь (сам ученик или дети родителя)
async function studentsOf(user) {
  const { rows: list } = await query(
    `SELECT s.id, s.full_name FROM students s WHERE s.user_id = $1
     UNION
     SELECT s.id, s.full_name FROM students s JOIN parent_students ps ON ps.student_id = s.id WHERE ps.parent_user_id = $1`,
    [user.id]
  );
  return user._studentId?list.filter(s=>s.id===user._studentId):list;
}

function helpText(user) {
  if (user.role === 'tutor') {
    return { text: '<b>Меню преподавателя</b>\nСегодня — уроки на день. На проверку — сданные работы. Ученики и материалы открываются отдельными кнопками.\n\n/stop — отключить уведомления' };
  }
  return {
    text: (user.role==='parent'?'<b>Меню родителя</b>\nКнопка «Мои дети» позволяет открыть данные нужного ребёнка.\n\n':'')+'<b>Что я умею</b>\n· присылаю итоги уроков и новые задания\n· напоминаю об уроке за час и о сроке домашки\n\nКнопки внизу: расписание, домашка, слова.\n/stop отключить уведомления',
    buttons: buttonRows(btn('Открыть кабинет', cabinetUrl('/'))),
  };
}

async function cmdLessons(user) {
  if (user.role === 'tutor') return cmdToday(user);
  const kids = await studentsOf(user);
  if (!kids.length) return 'Ученик не найден. Проверьте подключение в кабинете.';
  const { rows: list } = await query(
    `SELECT l.id, l.starts_at, l.topic, s.full_name, COALESCE(NULLIF(l.call_link, ''), NULLIF(s.call_link, '')) AS call_link
       FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.student_id = ANY($1) AND l.status = 'scheduled' AND l.starts_at > NOW() - INTERVAL '30 minutes'
      ORDER BY l.starts_at LIMIT 5`,
    [kids.map((k) => k.id)]
  );
  if (!list.length) return { text: '<b>Ближайших уроков нет</b>\nКак только преподаватель поставит урок, он появится здесь.', buttons: buttonRows(btn('Расписание', cabinetUrl('/schedule'))) };
  const many = kids.length > 1;
  const lines = ['<b>Ближайшие уроки</b>', ''];
  for (const l of list) {
    lines.push(`<b>${fmtWeekday(l.starts_at)}</b>, ${fmtTime(l.starts_at)}${many ? ` · ${esc(l.full_name)}` : ''}`);
    if (l.topic) lines.push(`<i>${esc(l.topic)}</i>`);
  }
  const next = list[0];
  // ссылка на звонок, если ближайший урок сегодня
  const soon = new Date(next.starts_at) - Date.now() < 12 * 3600e3;
  return { text: lines.join('\n'), buttons: buttonRows(soon && btn('Подключиться к звонку', next.call_link), btn('Расписание', cabinetUrl('/schedule'))) };
}

async function cmdHomework(user) {
  if (user.role === 'tutor') return helpText(user);
  const kids = await studentsOf(user);
  const { rows: list } = await query(
    `SELECT h.id, a.title, a.due_on, s.full_name FROM homework h JOIN assignments a ON a.id = h.assignment_id JOIN students s ON s.id = h.student_id
      WHERE h.student_id = ANY($1) AND h.status = 'assigned'
      ORDER BY a.due_on NULLS LAST, h.id LIMIT 8`,
    [kids.map((k) => k.id)]
  );
  const {rows:tests}=await query(`SELECT r.id,t.title,t.due_on,s.full_name FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id
   JOIN students s ON s.id=r.student_id WHERE r.student_id=ANY($1::int[]) AND r.submitted_at IS NULL ORDER BY t.due_on NULLS LAST,r.id LIMIT 5`,[kids.map(k=>k.id)]);
  if(!list.length&&!tests.length)return {text:'<b>Новых заданий и диагностик нет</b> ✓',buttons:buttonRows(btn('Все работы и история',cabinetUrl('/homework')))};
  const many=kids.length>1,lines=['<b>Домашние работы и диагностики</b>',''];
  for(const h of list)lines.push(`· ${esc(h.title)}${h.due_on?`, до ${fmtDay(h.due_on)}`:''}${many?` · ${esc(h.full_name)}`:''}`);
  for(const h of tests)lines.push(`· Тест: ${esc(h.title)}${h.due_on?`, до ${fmtDay(h.due_on)}`:''}${many?` · ${esc(h.full_name)}`:''}`);
  return {text:lines.join('\n'),buttons:buttonRows(...list.slice(0,3).map(h=>btn(h.title.slice(0,35),cabinetUrl(`/homework/${h.id}`))),...tests.slice(0,2).map(h=>btn(`Тест: ${h.title}`.slice(0,35),cabinetUrl(`/diagnostics/runs/${h.id}`))),btn('Все работы и история',cabinetUrl('/homework')))};

}

async function cmdWords(user) {
  if (user.role === 'tutor') return helpText(user);
  const kids = await studentsOf(user);
  const { rows: list } = await query(
    `SELECT s.full_name, COUNT(v.id)::int AS due FROM students s
       LEFT JOIN vocab_items v ON v.student_id = s.id AND v.due_on <= CURRENT_DATE
      WHERE s.id = ANY($1) GROUP BY s.id, s.full_name ORDER BY s.full_name`,
    [kids.map((k) => k.id)]
  );
  const total = list.reduce((n, r) => n + r.due, 0);
  if (!total) return { text: '<b>Сегодня повторять нечего</b> ✓\nОтличная работа!', buttons: buttonRows(btn('Словарь', cabinetUrl('/words'))) };
  const lines = list.length > 1
    ? ['<b>Слова на повторение</b>', '', ...list.filter((r) => r.due).map((r) => `· ${esc(r.full_name)}: ${r.due}`)]
    : [`<b>На повторение ${total} ${plural(total, 'слово', 'слова', 'слов')}</b>`, 'Это минут пять.'];
  return { text: lines.join('\n'), buttons: buttonRows(btn('Повторить слова', cabinetUrl('/words'))) };
}

async function cmdToday(user) {
  if (user.role !== 'tutor') return cmdLessons(user);
  const { rows: list } = await query(
    `SELECT l.starts_at, s.full_name FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE s.tutor_id = $1 AND l.status = 'scheduled'
        AND (l.starts_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
      ORDER BY l.starts_at`,
    [user.id, TZ]
  );
  if (!list.length) return { text: '<b>Сегодня уроков нет</b>', buttons: buttonRows(btn('Расписание', cabinetUrl('/schedule'))) };
  return {
    text: [`<b>Сегодня ${list.length} ${plural(list.length, 'урок', 'урока', 'уроков')}</b>`, '', ...list.map((r) => `<b>${fmtTime(r.starts_at)}</b>  ${esc(r.full_name)}`)].join('\n'),
    buttons: buttonRows(btn('Расписание', cabinetUrl('/schedule'))),
  };
}

// Преподаватель: сданные задания, которые ждут проверки
async function cmdCheck(user) {
  if (user.role !== 'tutor') return helpText(user);
  const { rows: list } = await query(
    `SELECT h.id, h.assignment_id, a.title, s.full_name, h.submitted_at
       FROM homework h JOIN assignments a ON a.id = h.assignment_id JOIN students s ON s.id = h.student_id
      WHERE s.tutor_id = $1 AND h.status = 'submitted'
      ORDER BY h.submitted_at NULLS LAST, h.id LIMIT 10`,
    [user.id]
  );
  if (!list.length) return { text: '<b>Проверять нечего</b> ✓\nВсе сданные задания проверены.', buttons: buttonRows(btn('Задания', cabinetUrl('/homework'))) };
  const lines = [`<b>Ждут проверки: ${list.length}${list.length === 10 ? '+' : ''}</b>`, ''];
  for (const h of list) lines.push(`· ${esc(h.full_name)}: ${esc(h.title)}`);
  const first = list.slice(0, 4).map((h) => [btn(`${h.full_name.split(' ')[0]}: ${h.title}`.slice(0, 40), cabinetUrl(`/homework/${h.assignment_id}/review/${h.id}`))]);
  return { text: lines.join('\n'), buttons: buttonRows(...first, btn('Все задания', cabinetUrl('/homework'))) };
}

function safeText(text){
 let out='';for(const line of String(text).split('\n')){if(out.length+line.length+1>3800){out+='\n… Полный список доступен в кабинете.';break;}out+=(out?'\n':'')+line;}return out||'Откройте данные в кабинете.';
}
async function cmdGrammar(){return {text:'<b>Вспомнить грамматику</b>\nНайдите тему, прочитайте объяснение и потренируйтесь.',buttons:buttonRows(btn('Найти тему',cabinetUrl('/grammar')))};}
async function cmdProgress(user){
 if(user.role==='tutor')return {text:'<b>Прогресс учеников</b>',buttons:buttonRows(btn('Открыть учеников',cabinetUrl('/students')))};
 const kids=await studentsOf(user),ids=kids.map(k=>k.id);
 const {rows:list}=await query(`SELECT r.id,t.title,s.full_name,r.result FROM diagnostic_runs r JOIN diagnostic_tests t ON t.id=r.test_id
  JOIN students s ON s.id=r.student_id WHERE r.student_id=ANY($1::int[]) AND r.submitted_at IS NOT NULL ORDER BY r.submitted_at DESC LIMIT 5`,[ids]);
 const lines=['<b>Последние результаты</b>',''];
 for(const r of list)lines.push(`· ${esc(r.full_name)}: ${esc(r.title)} — ${Number(r.result?.score)||0}%`);
 if(!list.length)lines.push('Сданных диагностик пока нет. Пройденные темы и историю работ можно посмотреть в кабинете.');
 return {text:lines.join('\n'),buttons:buttonRows(...list.slice(0,3).map(r=>btn(`${r.full_name}: ${r.title}`.slice(0,40),cabinetUrl(`/diagnostics/runs/${r.id}`))),btn('Прогресс в кабинете',cabinetUrl('/progress')))};
}
async function cmdMaterials(user){if(user.role!=='tutor')return helpText(user);return {text:'<b>Материалы для урока</b>',buttons:buttonRows(btn('Моя библиотека',cabinetUrl('/library')),btn('Банк заданий',cabinetUrl('/bank')))};}
async function cmdStudents(user){
 if(user.role!=='tutor')return helpText(user);
 const {rows:list}=await query('SELECT id,full_name FROM students WHERE tutor_id=$1 ORDER BY full_name LIMIT 10',[user.id]);
 return {text:'<b>Мои ученики</b>\nОткройте карточку ученика для домашних работ и прогресса.',buttons:buttonRows(...list.map(s=>btn(s.full_name.slice(0,40),cabinetUrl(`/students/${s.id}/homework`))),btn('Все ученики',cabinetUrl('/students')))};
}
async function cmdChildren(user){
 if(user.role!=='parent')return helpText(user);const list=await studentsOf(user);
 return {text:'<b>Мои дети</b>\nВыберите, чьи данные показать.',buttons:buttonRows(...list.slice(0,20).map(s=>({text:s.full_name.slice(0,40),callback_data:`lf:child:${s.id}`})),btn('Кабинет',cabinetUrl('/')))};
}
async function handleStudyCallback(cq){
 if(!String(cq.data||'').startsWith('lf:'))return false;
 if(cq.message?.chat?.type!=='private'||cq.from?.id!==cq.message.chat.id)return true;
 const chatId=cq.message.chat.id,user=await linkedUser(chatId);
 await call('answerCallbackQuery',{callback_query_id:cq.id}).catch(()=>{});
 if(!user){await onboarding(chatId);return true;}
 if(!await educationAllowed(user)){await consentWaiting(chatId);return true;}
 const [,action,rawId]=cq.data.split(':'),sid=Number(rawId),kids=await studentsOf(user),child=kids.find(s=>s.id===sid);
 if(user.role!=='parent'||!child){await say(chatId,'Данные этого ученика недоступны. Откройте меню заново.');return true;}
 if(action==='child')await say(chatId,{text:`<b>${esc(child.full_name)}</b>\nЧто открыть?`,buttons:buttonRows([{text:'Ближайшие уроки',callback_data:`lf:ls:${sid}`},{text:'Домашка и тесты',callback_data:`lf:hw:${sid}`}],[{text:'Слова',callback_data:`lf:words:${sid}`},{text:'Результаты',callback_data:`lf:progress:${sid}`}])});
 else if(['ls','hw','words','progress'].includes(action)){const fn={ls:cmdLessons,hw:cmdHomework,words:cmdWords,progress:cmdProgress}[action];const r=await fn({...user,_studentId:sid});const data=typeof r==='string'?{text:r}:r;await say(chatId,{...data,text:`<b>${esc(child.full_name)}</b>\n\n${data.text}`});}
 else await showMenu(chatId,user);
 return true;
}

const COMMAND_HANDLERS = { '/grammar':cmdGrammar,'/progress':cmdProgress,'/students':cmdStudents,'/children':cmdChildren,'/materials':cmdMaterials, '/check': cmdCheck, '/lessons': cmdLessons, '/homework': cmdHomework, '/words': cmdWords, '/today': cmdToday, '/help': async (u) => helpText(u) };

// ------------------------------------------------------------
// Уведомления кабинета → Telegram (кто подключил бота)
// ------------------------------------------------------------
// Подпись кнопки по адресу в кабинете
function linkLabel(link) {
  if (/^\/homework\/\d+/.test(link)) return 'Открыть задание';
  if (/^\/lesson\//.test(link)) return 'Открыть урок';
  if (/^\/(schedule|lessons)/.test(link)) return 'Расписание';
  if (/^\/words/.test(link)) return 'Словарь';
  if (/^\/wordsets/.test(link)) return 'Карточки';
  if (/^\/leads/.test(link)) return 'Заявки';
  if (/^\/students\//.test(link)) return 'Карточка ученика';
  return 'Открыть в кабинете';
}

// Telegram-уведомления входят в тариф преподавателя: оставляем тех, чей преподаватель может ими пользоваться
async function byPlan(list) {
  const plans = require('./plans');
  const ok = new Map();
  const out = [], access = new Map();
  for (const r of list) {
    if (!ok.has(r.tutor_id)) ok.set(r.tutor_id, await plans.allows(r.tutor_id, 'telegram').catch(() => true));
    if(!access.has(r.user_id))access.set(r.user_id,await educationAllowed(r.user_id).catch(()=>false));
    if (ok.get(r.tutor_id)&&access.get(r.user_id)) out.push(r);
  }
  return out;
}

async function forward(userIds, { title, body = null, link = null }) {
  if (!enabled() || !botUsername || !userIds.length) return 0;
  const { rows: all } = await query(
    `SELECT tl.user_id, tl.chat_id, CASE WHEN u.role = 'tutor' THEN u.id ELSE u.tutor_id END AS tutor_id
       FROM telegram_links tl JOIN users u ON u.id = tl.user_id LEFT JOIN users owner ON owner.id=u.tutor_id WHERE tl.user_id = ANY($1::int[]) AND u.is_active AND (u.role='tutor' OR (owner.role='tutor' AND owner.is_active))`,
    [[...new Set(userIds)]]
  );
  const list = await byPlan(all);
  let sent = 0;
  for (const r of list) {
    const text = [`<b>${esc(title)}</b>`, body ? esc(body) : ''].filter(Boolean).join('\n\n');
    try {
      await say(r.chat_id, { text, buttons: buttonRows(link && btn(linkLabel(link), cabinetUrl(link))) });
      sent++;
    } catch (err) {
      console.error(`⚠️ Telegram: уведомление пользователю #${r.user_id} не доставлено:`, err.message);
      if (/blocked|deactivated|chat not found/i.test(err.message)) await query('DELETE FROM telegram_links WHERE user_id = $1', [r.user_id]);
    }
  }
  return sent;
}

// Цикл получения сообщений
async function poll() {
  let offset = 0;
  while (running) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message','callback_query'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(u).catch((e) => console.error('❌ Telegram: обработка сообщения:', e.message));
      }
    } catch (err) {
      console.error('⚠️ Telegram:', err.message);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

// Описание бота: его видят до нажатия «Старт» и в профиле. Ставим, только если вы не задали своё в @BotFather
const DESCRIPTION = [
  'Lessonfold: интерактивные уроки английского и личный кабинет ученика.',
  '',
  'Учителям: готовые уроки к школьным учебникам с играми, озвучкой и ответами. Начните с бесплатного урока.',
  '',
  'Ученикам и родителям: расписание, домашка, слова на повторение и напоминания. Подключите бота в личном кабинете кнопкой «Подключить Telegram».',
].join('\n');
const SHORT_DESCRIPTION = 'Интерактивные уроки английского. Ученикам: расписание, домашка и напоминания.';

// Отдельный бот платформы (не общий с магазином): только про учёбу
const PLATFORM_DESCRIPTION = [
  'Lessonfold: напоминания об уроках, домашка и слова на повторение.',
  '',
  'Ученикам и родителям: подключите бота в личном кабинете кнопкой «Подключить Telegram».',
  'Преподавателям: утренняя сводка и уведомления о сданных заданиях.',
].join('\n');
const PLATFORM_SHORT = 'Напоминания об уроках, домашка и слова. Подключается из кабинета Lessonfold.';

async function describe(shared) {
  try {
    const d = await call('getMyDescription');
    if (!d?.description) await call('setMyDescription', { description: shared ? DESCRIPTION : PLATFORM_DESCRIPTION });
    const sd = await call('getMyShortDescription');
    if (!sd?.short_description) await call('setMyShortDescription', { short_description: shared ? SHORT_DESCRIPTION : PLATFORM_SHORT });
  } catch (e) {
    console.error('⚠️ Telegram: описание бота:', e.message);
  }
}

async function start() {
  if (!enabled()) {
    console.log('⚠️ Telegram выключен: не задан TELEGRAM_BOT_TOKEN или LF_BOT_TOKEN');
    return;
  }
  try {
    const me = await call('getMe');
    botUsername = me.username;
    describe(SHARED);
    if (SHARED) {
      // сообщения читает бот магазина и отдаёт их сюда первыми
      try {
        require('../../lessonfold/src/bot').setPreHandler(handleUpdate);
      } catch (e) {
        console.error('❌ Telegram: не удалось подключиться к боту магазина:', e.message);
        return;
      }
      console.log(`✅ Telegram: @${botUsername} общий с магазином (ученики и родители получают учебное меню)`);
      return;
    }
    // Сообщения бота читает только одна копия сервера, иначе Telegram отвечает ошибкой 409
    if (!(await require('./jobs').holdLock('telegram-poll'))) {
      console.log('ℹ️ Telegram: сообщения читает другая копия сервера, эта только отправляет');
      setTimeout(start, 60000);
      return;
    }
    await call('deleteWebhook', { drop_pending_updates: false });
    await call('setMyCommands', { commands: COMMANDS }).catch((e) => console.error('⚠️ Telegram: меню команд:', e.message));
    running = true;
    console.log(`✅ Telegram-бот @${botUsername} запущен`);
    poll();
  } catch (err) {
    console.error('❌ Telegram не запустился:', err.message.replace(/bot\d+:[\w-]+/g, 'bot***'), '— проверьте токен и переменную TG_OPTION=1');
    setTimeout(start, 60000);
  }
}

// ------------------------------------------------------------
// Итоги урока → родителям и взрослому ученику, у кого подключён Telegram
// ------------------------------------------------------------
function formatWhen(d) {
  const fmt = (o) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...o }).format(new Date(d));
  const day = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${fmt({ hour: '2-digit', minute: '2-digit' })}`;
}

async function lessonRecipients(studentId) {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.role, tl.chat_id
       FROM users u
       LEFT JOIN telegram_links tl ON tl.user_id = u.id
      WHERE u.is_active AND (
            u.id IN (SELECT parent_user_id FROM parent_students WHERE student_id = $1)
         OR u.id = (SELECT user_id FROM students WHERE id = $1 AND category = 'adult'))`,
    [studentId]
  );
  const allowed=[];for(const r of rows)if(await educationAllowed(r.id).catch(()=>false))allowed.push(r);return allowed;
}

async function sendLessonSummary(lessonId) {
  if (!enabled() || !botUsername) return { error: 'Telegram-бот не подключён. Настройки → Telegram' };

  const { rows } = await query(
    `SELECT l.*, s.full_name AS student_name FROM lessons l JOIN students s ON s.id = l.student_id WHERE l.id = $1`,
    [lessonId]
  );
  const l = rows[0];
  if (!l) return { error: 'Занятие не найдено' };
  const { rows: tut } = await query('SELECT tutor_id FROM students WHERE id = $1', [l.student_id]);
  if (!(await require('./plans').allows(tut[0]?.tutor_id, 'telegram'))) return { error: 'Telegram-бот входит в тариф «Репетитор». Настройки → Тариф' };
  if (!l.summary && !l.topic) return { error: 'Сначала напишите, что сделали на уроке' };

  // Свежие задания этому ученику (выданы за последние 2 дня)
  const { rows: hw } = await query(
    `SELECT h.id, a.title, a.due_on FROM homework h JOIN assignments a ON a.id = h.assignment_id
      WHERE h.student_id = $1 AND h.status = 'assigned' AND h.created_at > NOW() - INTERVAL '2 days'
      ORDER BY h.id`,
    [l.student_id]
  );

  const lines = [`<b>Итоги урока</b> · ${esc(l.student_name)}`, `<i>${esc(formatWhen(l.starts_at))}</i>`];
  if (l.topic) lines.push('', `<b>Тема:</b> ${esc(l.topic)}`);
  if (l.summary) lines.push('', esc(l.summary));
  if (hw.length) {
    lines.push('', '<b>Домашнее задание</b>');
    for (const h of hw) lines.push(`· ${esc(h.title)}${h.due_on ? `, до ${fmtDay(h.due_on)}` : ''}`);
  }
  const text = lines.join('\n').slice(0, 4000);
  const buttons = buttonRows(hw.length === 1 && btn('Открыть задание', cabinetUrl(`/homework/${hw[0].id}`)), btn(hw.length > 1 ? 'Все задания' : 'Личный кабинет', cabinetUrl(hw.length > 1 ? '/homework' : '/')));

  const recipients = await lessonRecipients(l.student_id);
  const sent = [];
  const notConnected = [];
  const failed = [];
  for (const r of recipients) {
    if (!r.chat_id) {
      notConnected.push(r.full_name);
      continue;
    }
    try {
      await say(r.chat_id, { text, buttons });
      sent.push(r.full_name);
    } catch (err) {
      failed.push(r.full_name);
      console.error(`⚠️ Telegram: не доставлено ${r.full_name}:`, err.message);
      // Пользователь заблокировал бота — отвязываем
      if (/blocked|deactivated|chat not found/i.test(err.message)) {
        await query('DELETE FROM telegram_links WHERE user_id = $1', [r.id]);
      }
    }
  }
  if (sent.length) await query('UPDATE lessons SET summary_sent_at = NOW() WHERE id = $1', [lessonId]);
  console.log(`📝 Итоги урока #${lessonId}: отправлено ${sent.length}, не подключены ${notConnected.length}`);
  return { sent, not_connected: notConnected, failed };
}

module.exports = { byPlan, enabled, username, start, createLinkCode, sendLessonSummary, lessonRecipients, handleUpdate, forward, sendMessage, say, btn, rows:buttonRows, esc, cabinetUrl, studentsOf };
