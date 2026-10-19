// services/recommend.js — «Что повторить»: сайт сам подсказывает слабые темы ученика.
// Смотрим только на то, что уже есть в базе (без нейросети):
//   • упражнения: последний результат по каждому, средний по темам (теги материала, номер задания ОГЭ/ЕГЭ)
//   • домашние задания с низкой оценкой
//   • слова, которые ученик часто забывает, и накопившееся повторение
//   • наборы карточек, которые начаты и брошены
//   • темы программы, пройденные давно: пора освежить
// Каждая подсказка: { kind, title, reason, priority, link, item_id? }. link ведёт в кабинет ученика.
const { query } = require('../db');

const WEAK = 70; // ниже этого процента тема или упражнение считается слабым
const STRONG = 90;
const DAY = 864e5;
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
};
const days = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DAY));
const ago = (d) => { const n = days(d); return n === 0 ? 'сегодня' : n === 1 ? 'вчера' : `${n} ${plural(n, 'день', 'дня', 'дней')} назад`; };

// Темы материала: теги и номер экзаменационного задания
function topicsOf(item) {
  const t = [...(item.tags || [])].map((x) => String(x).trim()).filter(Boolean);
  if (item.exam && item.exam_task) t.push(`${item.exam}, задание ${item.exam_task}`);
  return [...new Set(t)];
}

async function recommendations(studentId) {
  const recs = [];
  const strong = [];

  // ---------- Упражнения: последняя попытка по каждому за 90 дней ----------
  const { rows: games } = await query(
    `SELECT DISTINCT ON (r.item_id) r.item_id, r.score, r.created_at, r.homework_id, li.title, li.tags, li.exam, li.exam_task,
            (SELECT MAX(x.score) FROM game_results x WHERE x.item_id = r.item_id AND x.student_id = r.student_id) AS best,
            (SELECT COUNT(*)::int FROM game_results x WHERE x.item_id = r.item_id AND x.student_id = r.student_id) AS attempts
       FROM game_results r JOIN library_items li ON li.id = r.item_id
      WHERE r.student_id = $1 AND r.total > 0 AND r.created_at > NOW() - INTERVAL '90 days'
      ORDER BY r.item_id, r.created_at DESC`,
    [studentId]
  );
  const byTopic = new Map();
  for (const g of games) {
    for (const t of topicsOf(g)) {
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(g);
    }
  }
  const weakTopics = new Set();
  for (const [topic, list] of byTopic) {
    const avg = Math.round(list.reduce((n, g) => n + g.score, 0) / list.length);
    if ((list.length >= 2 && avg < WEAK) || (list.length === 1 && avg < 50)) {
      weakTopics.add(topic);
      const worst = [...list].sort((a, b) => a.score - b.score)[0];
      recs.push({
        kind: 'topic',
        title: topic,
        reason: list.length > 1 ? `в среднем ${avg}% в ${list.length} ${plural(list.length, 'упражнении', 'упражнениях', 'упражнениях')}` : `${avg}% в упражнении «${worst.title}»`,
        priority: 110 - avg + Math.min(list.length, 5) * 2,
        link: worst.homework_id ? `/homework/${worst.homework_id}` : null,
        item_id: worst.item_id,
      });
    } else if (list.length >= 2 && avg >= STRONG) {
      strong.push({ title: topic, reason: `в среднем ${avg}%` });
    }
  }
  for (const g of games) {
    if (g.score >= WEAK) continue;
    // Если тема упражнения уже в подсказках, отдельно упражнение не повторяем
    if (topicsOf(g).some((t) => weakTopics.has(t))) continue;
    recs.push({
      kind: 'exercise',
      title: g.title,
      reason: `последний результат ${g.score}%${g.best > g.score ? `, лучший ${g.best}%` : ''}, ${ago(g.created_at)}`,
      priority: 100 - g.score,
      link: g.homework_id ? `/homework/${g.homework_id}` : null,
      item_id: g.item_id,
    });
  }

  // ---------- Домашние задания с низкой оценкой ----------
  const { rows: hw } = await query(
    `SELECT h.id, a.title, COALESCE(h.score, h.quiz_score) AS s, COALESCE(h.submitted_at, h.created_at) AS at
       FROM homework h JOIN assignments a ON a.id = h.assignment_id
      WHERE h.student_id = $1 AND h.status IN ('submitted', 'checked') AND COALESCE(h.score, h.quiz_score) < $2
        AND h.created_at > NOW() - INTERVAL '60 days'
      ORDER BY s LIMIT 3`,
    [studentId, WEAK]
  );
  for (const h of hw) {
    recs.push({ kind: 'homework', title: h.title, reason: `оценка ${h.s}%: стоит разобрать ошибки`, priority: 95 - h.s, link: `/homework/${h.id}` });
  }

  // ---------- Слова ----------
  const { rows: forgotten } = await query(
    'SELECT term FROM vocab_items WHERE student_id = $1 AND lapses >= 2 AND box < 4 ORDER BY lapses DESC, last_reviewed_at DESC NULLS LAST LIMIT 6',
    [studentId]
  );
  if (forgotten.length) {
    recs.push({
      kind: 'words',
      title: 'Слова, которые часто забываются',
      reason: forgotten.map((w) => w.term).join(', '),
      priority: 45 + forgotten.length * 4,
      link: '/words',
    });
  }
  const { rows: due } = await query('SELECT COUNT(*)::int AS n FROM vocab_items WHERE student_id = $1 AND due_on <= CURRENT_DATE', [studentId]);
  if (due[0].n >= 10) {
    recs.push({ kind: 'due', title: `Повторить ${due[0].n} ${plural(due[0].n, 'слово', 'слова', 'слов')}`, reason: 'накопились в словаре, займёт 5-10 минут', priority: 30 + Math.min(due[0].n, 40), link: '/words' });
  }

  // ---------- Наборы карточек: начаты и брошены или не начаты ----------
  const { rows: sets } = await query(
    `SELECT ws.id, ws.title, jsonb_array_length(ws.words) AS total, ws.created_at,
            (SELECT COUNT(*)::int FROM word_set_progress p WHERE p.set_id = ws.id AND p.student_id = s.id AND p.level = 3) AS learned,
            (SELECT MAX(created_at) FROM practice_log l WHERE l.set_id = ws.id AND l.student_id = s.id) AS last
       FROM word_sets ws JOIN students s ON s.tutor_id = ws.tutor_id
      WHERE s.id = $1 AND (ws.for_all OR EXISTS (SELECT 1 FROM word_set_students x WHERE x.set_id = ws.id AND x.student_id = s.id))`,
    [studentId]
  );
  for (const s of sets) {
    const left = s.total - s.learned;
    if (left <= 0) continue;
    if (!s.last) {
      if (days(s.created_at) >= 2) recs.push({ kind: 'set', title: `Набор «${s.title}»`, reason: `ещё не начат, ${s.total} ${plural(s.total, 'слово', 'слова', 'слов')}`, priority: 35, link: `/words/set/${s.id}` });
    } else if (days(s.last) >= 4) {
      recs.push({ kind: 'set', title: `Доучить набор «${s.title}»`, reason: `осталось ${left} из ${s.total}, последний раз ${ago(s.last)}`, priority: 38 + Math.min(left, 20), link: `/words/set/${s.id}` });
    }
  }

  // ---------- Темы программы, пройденные давно ----------
  const { rows: old } = await query(
    `SELECT title, completed_on FROM progress_topics
      WHERE student_id = $1 AND status = 'done' AND completed_on BETWEEN CURRENT_DATE - 120 AND CURRENT_DATE - 14
      ORDER BY completed_on LIMIT 2`,
    [studentId]
  );
  for (const t of old) {
    if (weakTopics.has(t.title)) continue;
    recs.push({ kind: 'review', title: t.title, reason: `пройдена ${ago(t.completed_on)}: пора освежить`, priority: 20 + Math.min(days(t.completed_on), 60) / 6, link: '/progress' });
  }

  // У слабой темы без ссылки ищем теорию с таким тегом: ученик сможет перечитать правило
  for (const r of recs) {
    if (r.kind !== 'topic' || r.link) continue;
    const { rows: th } = await query(
      `SELECT li.id FROM library_items li JOIN students s ON s.tutor_id = li.tutor_id
        WHERE s.id = $1 AND li.kind = 'theory' AND (lower($2) = ANY(SELECT lower(x) FROM unnest(li.tags) x) OR li.title ILIKE '%' || $2 || '%')
        ORDER BY li.updated_at DESC LIMIT 1`,
      [studentId, r.title]
    );
    if (th[0]) { r.link = `/theory/${th[0].id}`; r.reason += ', есть теория'; }
  }

  recs.sort((a, b) => b.priority - a.priority);
  return { items: recs.slice(0, 6), more: Math.max(0, recs.length - 6), strong: strong.slice(0, 4) };
}

module.exports = { recommendations };
