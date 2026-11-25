// Local learning helpers. A focused practice is a new, unsaved game; it never
// changes the original answers, server result, material or assignment.
import { inlineMistakeText } from './inline-choice.js';
import { parseGaps, tokenize } from './logic.js';

export function exerciseInstruction(game) {
  if(game.type==='sheet'&&game.blocks.some(block=>block.t==='listening'))return 'Прослушайте запись и выберите ответ для каждого вопроса. Затем выполните задания ниже.';
  if (game.type === 'quick') return {
    quiz: 'Выберите ответ. Прочитайте обратную связь и переходите дальше в своём темпе.',
    type: 'Вспомните ответ без подсказок и напишите его. Enter — ответить.',
    match: 'Выберите карточку слева, затем её пару справа. Пару можно изменить до проверки.',
    memory: 'Открывайте по две карточки и находите пары. Запоминайте слова вместе с переводом.',
    anagram: 'Нажимайте буквы по порядку. Последнюю букву можно убрать до ответа.',
    tf: 'Решите, верно ли показана пара. Затем прочитайте ответ и продолжайте.',
    flip: 'Вспомните ответ, откройте карточку и честно оцените, знаете ли его.',
  }[game.template] || 'Выполните упражнение и проверьте себя.';
  return {
    match: 'Выберите карточку слева, затем её пару справа. Пару можно изменить до проверки.',
    order: 'Нажимайте слова по порядку. Нажмите слово в предложении, чтобы вернуть его.',
    gaps: game.mode === 'bank' ? 'Выберите слово, затем пропуск. Нажмите заполненный пропуск, чтобы изменить ответ.' : 'Заполните пропуски. Перемещаться между полями можно клавишей Tab.',
    groups: 'Выберите карточку и перенесите её нажатием в подходящую группу.',
    sheet: 'Выполните задания по порядку. Развёрнутые и устные ответы проверит преподаватель.',
    board: 'Выполните действия на поле: заполните ответы и распределите карточки.',
  }[game.type] || 'Выполните упражнение и проверьте себя.';
}

export function exerciseProgress(game, answers = {}) {
  let total = 0, done = 0;
  if (game.type === 'quick') {
    total = game.items.length;
    done = game.template === 'memory' ? new Set(answers.found || []).size : game.template === 'match' ? Object.keys(answers.pairs || {}).length : Object.values(answers.r || {}).filter(v => v !== undefined && v !== null).length;
  } else if (game.type === 'match') { total = game.pairs.length; done = Object.keys(answers.pairs || {}).length; }
  else if (game.type === 'gaps') { total = parseGaps(game.text).gaps.length; done = (answers.gaps || []).filter(v => String(v || '').trim()).length; }
  else if (game.type === 'order') { total = game.sentences.length; done = game.sentences.filter((s, i) => answers.sentences?.[i]?.length === tokenize(s).length).length; }
  else if (game.type === 'groups') { total = game.groups.reduce((n, g) => n + g.items.length, 0); done = Object.keys(answers.items || {}).length; }
  else return null; // Keep the existing block-specific counters for mixed sheets/boards.
  return { total, done: Math.min(total, done), percent: total ? Math.round(Math.min(total, done) / total * 100) : 0 };
}

export function buildMistakePractice(game, result) {
  const details = result?.details || [];
  const wrong = new Set(details.flatMap((d, i) => d.ok === false && !d.manual ? [i] : []));
  if (!wrong.size) return null;
  if (game.type === 'quick' || game.type === 'match') {
    const items = game.type === 'quick' ? game.items : game.pairs.map(p => ({ q: p.a, a: p.b }));
    // Retrieval without answer choices, including a single missed word. Keep
    // accepted alternatives, but remove distractors and any previous timer.
    return { type: 'quick', template: 'type', timer: 0, items: items.filter((_, i) => wrong.has(i)).map(x => game.template === 'anagram' ? { q: x.a.split('|')[0], a: x.q } : { q: x.q, a: x.a }) };
  }
  if (game.type === 'order') return { ...game, sentences: game.sentences.filter((_, i) => wrong.has(i)) };
  if (game.type === 'gaps') {
    let index = -1;
    return { ...game, text: game.text.replace(/\[([^\]]+)\]/g, (full, alternatives) => wrong.has(++index) ? full : alternatives.split('|')[0]) };
  }
  if (game.type === 'groups') {
    let i = 0;
    return { ...game, groups: game.groups.map(g => ({ ...g, items: g.items.filter(() => wrong.has(i++)) })) };
  }
  if (game.type === 'sheet') {
    const blocks = new Set(details.filter(d => d.ok === false && !d.manual).map(d => d.block));
    const manual = new Set(details.filter(d => d.manual).map(d => d.block));
    const selected = game.blocks.flatMap((b, i) => {
      if (!blocks.has(i) || manual.has(i)) return [];
      if (b.t === 'listening') { const missed=new Set(details.filter(d=>d.block===i&&d.ok===false).map(d=>d.k));return [{...b,questions:b.questions.filter((_,k)=>missed.has(k))}]; }
      if (b.t !== 'inline') return [b];
      const wrongSlots = new Set(details.filter(d => d.block === i && d.ok === false).map(d => d.k));
      return [{ ...b, text: inlineMistakeText(b.text, wrongSlots) }];
    });
    return selected.length ? { ...game, blocks: selected } : null;
  }
  // Free-layout boards can depend on other zones and elements. Keep their
  // original annotated review rather than producing an incomplete board.
  return null;
}
