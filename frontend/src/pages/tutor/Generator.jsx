// pages/tutor/Generator.jsx — конструктор по тексту или видео (как Twee, но без нейросети).
// Вставили текст статьи, песни или субтитры ролика, ссылку на YouTube. Сайт сам предлагает пропуски,
// слова для словаря и предложения для сборки, а вопросы на понимание и обсуждение пишет учитель.
// На выходе готовые упражнения в библиотеке, которые можно сразу выдать как задание.
import { useMemo, useState } from 'react';
import { api } from '../../api';
import { Icon, Link, navigate, useToast, Field } from '../../ui';
import { ytId } from '../../games/Sheet';
import { useSubject } from '../../subjects';

// Частые служебные слова: их не делаем пропусками и не берём в словарь
const STOP = new Set(`a an the and or but if so as at by for from in into of off on onto out over to up with about after again against all also am
are aren't be been before being below between both can can't could couldn't did didn't do does doesn't doing don't down during each few
further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm
i've is isn't it it's its itself let's me more most mustn't my myself no nor not now once only other ought our ours ourselves own same
shan't she she'd she'll she's should shouldn't some such than that that's their theirs them themselves then there there's these they
they'd they'll they're they've this those through too under until very was wasn't we we'd we'll we're we've were weren't what what's
when when's where where's which while who who's whom why why's will won't would wouldn't you you'd you'll you're you've your yours
yourself yourselves just like get got go goes going went really one two three yes yeah oh ok okay well thing things lot lots much many
make made say said says see know think want way also still even back time year years day days people man woman good new first last`.split(/\s+/));

// Ещё частые слова, которые не стоит учить отдельно
`without with within around because before after during until every never always often sometimes something nothing everything
someone anyone everyone another others little small big great long short high low old young right left different next
look looks looking looked come comes coming came take takes taking took give gives given use used using find found tell told ask asked
work works working worked seem seems feel feels felt try tried leave call called need needs needed keep keeps start started show shows
change changes changed help helps place part world life home school student students children child family friend friends week month
night morning evening today tomorrow yesterday point number group problem fact hand eye head word words example name kind
let maybe perhaps quite rather almost enough least less such either neither however though although`.split(/\s+/).forEach((w) => STOP.add(w));

const WORD = /[A-Za-zÀ-ÿА-Яа-яЁё][A-Za-zÀ-ÿА-Яа-яЁё'’-]*/g;
const MAX = 4800;

// Текст → куски: слова (с номером) и всё остальное как есть
function tokenize(text) {
  const out = [];
  let last = 0, m, n = 0;
  WORD.lastIndex = 0;
  while ((m = WORD.exec(text))) {
    if (m.index > last) out.push({ s: text.slice(last, m.index) });
    out.push({ s: m[0], w: n++, key: m[0].toLowerCase().replace(/’/g, "'") });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ s: text.slice(last) });
  return out;
}
const isContent = (t, prev) => t.key.length >= 4 && !STOP.has(t.key) && !/['’]/.test(t.s) && !(prev && !/[.!?]\s*$/.test(prev) && /^[A-ZА-Я]/.test(t.s));
const sentences = (text) => text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-ZА-Я"“])/).map((s) => s.trim()).filter(Boolean);

// Автоматически: пропуски равномерно по тексту
function autoGaps(tokens, count) {
  const cand = [];
  tokens.forEach((t, i) => { if (t.w !== undefined && isContent(t, tokens[i - 1]?.s)) cand.push(t.w); });
  if (!cand.length) return new Set();
  const step = Math.max(1, cand.length / count);
  const pick = new Set();
  const used = new Set();
  for (let k = 0; k < count && Math.floor(k * step) < cand.length; k++) {
    let j = Math.floor(k * step + step / 2);
    if (j >= cand.length) j = cand.length - 1;
    // одно слово один раз
    while (j < cand.length && used.has(tokens.find((t) => t.w === cand[j]).key)) j++;
    if (j >= cand.length) break;
    pick.add(cand[j]);
    used.add(tokens.find((t) => t.w === cand[j]).key);
  }
  return pick;
}
// Автоматически: слова для словаря (длинные и редкие, без повторов)
function autoVocab(tokens, count) {
  const seen = new Map();
  tokens.forEach((t, i) => { if (t.w !== undefined && isContent(t, tokens[i - 1]?.s) && t.key.length >= 6) seen.set(t.key, (seen.get(t.key) || 0) + 1); });
  return [...seen.keys()].sort((a, b) => b.length - a.length).slice(0, count);
}

// Вопросы: «T: ...», «F: ...», «? Вопрос | *верный | неверный»
function parseQuestions(text) {
  const out = [];
  const errors = [];
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const tf = line.match(/^(T|F|В|Н)\s*[:.)]\s*(.+)$/i);
    if (tf) {
      const truth = /^[TВ]/i.test(tf[1]);
      out.push({ t: 'choice', q: tf[2].trim(), options: ['True', 'False'], correct: truth ? 0 : 1 });
      return;
    }
    if (line.includes('|')) {
      const [q, ...opts] = line.replace(/^\?\s*/, '').split('|').map((x) => x.trim());
      const clean = opts.map((o) => o.replace(/^\*/, '').trim()).filter(Boolean);
      const correct = opts.findIndex((o) => o.startsWith('*'));
      if (clean.length >= 2 && correct >= 0) out.push({ t: 'choice', q, options: clean.slice(0, 8), correct: Math.min(correct, 7) });
      else errors.push(`Строка ${i + 1}: отметьте верный вариант звёздочкой *`);
      return;
    }
    errors.push(`Строка ${i + 1}: начните с T: или F:, или разделите варианты знаком |`);
  });
  return { out, errors };
}

export default function Generator() {
  const toast = useToast();
  const subj = useSubject();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [video, setVideo] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState('gap'); // что отмечаем кликом: gap | vocab
  const [gaps, setGaps] = useState(new Set());
  const [vocab, setVocab] = useState([]); // [{ term, translation }]
  const [bank, setBank] = useState(true);
  const [picked, setPicked] = useState(null); // выбранные предложения для сборки (индексы)
  const [questions, setQuestions] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [retell, setRetell] = useState(true);
  const [make, setMake] = useState({ sheet: true, gaps: true, match: true, order: true, set: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const src = text.length > MAX ? text.slice(0, MAX) : text;
  const tokens = useMemo(() => tokenize(src.replace(/\[/g, '(').replace(/\]/g, ')')), [src]);
  const words = tokens.filter((t) => t.w !== undefined).length;
  const sents = useMemo(() => sentences(src).filter((s) => { const n = s.split(/\s+/).length; return n >= 4 && n <= 14; }), [src]);
  const chosenSents = picked || new Set(sents.slice(0, 6).map((_, i) => i));
  const q = useMemo(() => parseQuestions(questions), [questions]);
  const disc = discussion.split('\n').map((l) => l.trim()).filter(Boolean);
  const vocabKeys = new Set(vocab.map((v) => v.term.toLowerCase()));
  const yt = ytId(video);

  const toggleWord = (t) => {
    if (mode === 'gap') {
      const n = new Set(gaps);
      if (n.has(t.w)) n.delete(t.w); else n.add(t.w);
      setGaps(n);
    } else if (vocabKeys.has(t.key)) setVocab(vocab.filter((v) => v.term.toLowerCase() !== t.key));
    else setVocab([...vocab, { term: t.s.replace(/’/g, "'"), translation: '' }]);
  };
  const auto = () => {
    setGaps(autoGaps(tokens, Math.min(12, Math.max(4, Math.round(words / 12)))));
    const have = new Set(vocab.map((v) => v.term.toLowerCase()));
    setVocab([...vocab, ...autoVocab(tokens, 10).filter((k) => !have.has(k)).map((k) => ({ term: k, translation: '' }))].slice(0, 24));
    setPicked(null);
  };

  const gapText = () => tokens.map((t) => (t.w !== undefined && gaps.has(t.w) ? `[${t.s}]` : t.s)).join('');
  const matchPairs = vocab.filter((v) => v.term.trim() && v.translation.trim()).slice(0, 24);
  const orderList = sents.filter((_, i) => chosenSents.has(i)).slice(0, 20);

  const plan = [
    make.sheet && (src.trim() || yt) && { k: 'sheet', title: `${title || 'Текст'}: понимание`, n: q.out.length + disc.length + (retell ? 1 : 0) },
    make.gaps && gaps.size > 0 && { k: 'gaps', title: `${title || 'Текст'}: пропуски`, n: gaps.size },
    make.match && matchPairs.length >= 2 && { k: 'match', title: `${title || 'Текст'}: слова`, n: matchPairs.length },
    make.order && orderList.length > 0 && { k: 'order', title: `${title || 'Текст'}: собери предложение`, n: orderList.length },
    make.set && matchPairs.length >= 2 && { k: 'set', title: `${title || 'Текст'}: карточки`, n: matchPairs.length },
  ].filter(Boolean);

  const create = async () => {
    if (!title.trim()) return toast('Напишите название', 'error');
    if (!plan.length) return toast('Нечего создавать: добавьте текст, пропуски, слова или вопросы', 'error');
    if (q.errors.length) return toast(q.errors[0], 'error');
    setBusy(true);
    const tags = [...new Set([title.trim(), ...topic.split(',').map((x) => x.trim())].filter(Boolean))].slice(0, 20).map((x) => x.slice(0, 40));
    const made = [];
    try {
      for (const p of plan) {
        if (p.k === 'set') {
          const r = await api.createWordSet({ title: p.title, words: matchPairs.map((v) => ({ term: v.term.trim(), translation: v.translation.trim() })), for_all: true });
          made.push({ title: p.title, link: `/wordsets/${r.id}`, set: true });
          continue;
        }
        let game;
        if (p.k === 'sheet') {
          const blocks = [];
          const paras = src.trim() ? src.trim().split(/\n{2,}/) : [];
          // Текст делим на блоки по 4500 знаков, к первому крепим видео
          let chunk = '';
          const chunks = [];
          for (const para of paras) {
            if ((chunk + '\n\n' + para).length > 4500 && chunk) { chunks.push(chunk); chunk = para; } else chunk = chunk ? `${chunk}\n\n${para}` : para;
          }
          if (chunk) chunks.push(chunk);
          if (!chunks.length) chunks.push('');
          chunks.forEach((c, i) => blocks.push({ t: 'text', text: (i === 0 ? `${yt && !c ? 'Watch the video.' : yt ? 'Watch the video and read the text.' : 'Read the text.'}\n\n` : '') + c, video: i === 0 && video.trim() ? video.trim() : null }));
          if (q.out.length) blocks.push({ t: 'text', text: q.out.every((x) => x.options[0] === 'True') ? 'True or false?' : 'Answer the questions.' }, ...q.out);
          if (disc.length) blocks.push({ t: 'text', text: 'Let\'s discuss.' }, ...disc.map((d) => ({ t: 'open', q: d })));
          if (retell) blocks.push({ t: 'voice', q: yt && !src.trim() ? 'Tell me about the video in your own words (5-6 sentences).' : 'Retell the text in your own words (5-6 sentences).' });
          game = { type: 'sheet', blocks: blocks.slice(0, 80) };
        }
        if (p.k === 'gaps') game = { type: 'gaps', text: gapText(), mode: bank ? 'bank' : 'type', distractors: [] };
        if (p.k === 'match') game = { type: 'match', pairs: matchPairs.map((v) => ({ a: v.term.trim().slice(0, 200), b: v.translation.trim().slice(0, 200) })) };
        if (p.k === 'order') game = { type: 'order', sentences: orderList.map((s) => s.slice(0, 400)) };
        const item = await api.createLibraryItem({ kind: 'game', title: p.title.slice(0, 255), tags, game });
        made.push({ title: p.title, id: item.id, link: `/library/${item.id}` });
      }
      setDone(made);
      toast(`Готово: ${made.length}`);
    } catch (err) {
      toast(err.message, 'error');
      if (made.length) setDone(made);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const ids = done.filter((d) => d.id).map((d) => d.id);
    return (
      <>
        <div className="page-head"><div><h1 className="page-title">Готово</h1><div className="lead">Упражнения лежат в библиотеке с тегом «{title}». Их можно поправить, выдать как задание или открыть на уроке.</div></div></div>
        <section className="panel">
          <div className="list">
            {done.map((d) => (
              <Link key={d.link} to={d.link} className="list-item clickable" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="avatar" style={{ background: 'var(--surface-2)' }}><Icon name={d.set ? 'cards' : 'quiz'} size={20} /></div>
                <div className="list-main"><div className="list-title">{d.title}</div><div className="list-sub">{d.set ? 'Набор карточек для самостоятельной тренировки' : 'Упражнение в библиотеке'}</div></div>
              </Link>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
            {ids.length > 0 && <button className="btn" onClick={() => navigate(`/homework/new?items=${ids.join(',')}`)}><Icon name="send" /> Выдать как задание</button>}
            <button className="btn btn-secondary" onClick={() => { setDone(null); setText(''); setTitle(''); setVideo(''); setGaps(new Set()); setVocab([]); setQuestions(''); setDiscussion(''); setPicked(null); }}>Ещё по другому тексту</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Link to="/library/games" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Библиотека</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">Задания по тексту и видео</h1>
          <div className="lead">Вставьте текст статьи, песни или субтитры ролика. Сайт предложит пропуски, слова и предложения для сборки, вы допишете вопросы. Получится 3-5 готовых упражнений за пару минут.</div>
        </div>
      </div>

      <section className="panel">
        <div className="form">
          <div className="form-row">
            <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Why we sleep" maxLength={120} /></Field>
            <Field label="Темы" hint="Через запятую. По ним сайт подскажет ученику, что повторить"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Present Simple, Daily routine" /></Field>
          </div>
          <Field label="Видео YouTube" hint="Необязательно. Субтитры ролика можно скопировать на YouTube: «Ещё» → «Показать текст видео»">
            <input className="input" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
          {yt && <div className="mat-yt gen-video"><iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Видео" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
          <Field label="Текст" hint={text.length > MAX ? `Текст длиннее ${MAX} знаков: в упражнения пойдут первые ${MAX}` : `${text.length} знаков`}>
            <textarea className="textarea" rows={9} value={text} onChange={(e) => { setText(e.target.value); setGaps(new Set()); setPicked(null); }} placeholder="Вставьте текст на английском (или на изучаемом языке)" />
          </Field>
        </div>
      </section>

      {words > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Пропуски и слова</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={auto}><Icon name="star" /> Подобрать автоматически</button>
          </div>
          <div className="row wrap" style={{ gap: 10, marginBottom: 10 }}>
            <span className="small muted">Нажимайте на слова в тексте. Сейчас отмечаю:</span>
            <div className="seg">
              <button type="button" className={mode === 'gap' ? 'on' : ''} onClick={() => setMode('gap')}>пропуски ({gaps.size})</button>
              <button type="button" className={mode === 'vocab' ? 'on' : ''} onClick={() => setMode('vocab')}>{subj.isLang ? 'слова' : 'термины'} для словаря ({vocab.length})</button>
            </div>
          </div>
          <div className="gen-text">
            {tokens.map((t, i) => (t.w === undefined
              ? <span key={i}>{t.s}</span>
              : <button key={i} type="button" className={`gen-w ${gaps.has(t.w) ? 'gap' : ''} ${vocabKeys.has(t.key) ? 'voc' : ''}`} onClick={() => toggleWord(t)}>{t.s}</button>))}
          </div>
          <div className="row wrap small muted" style={{ gap: 14, marginTop: 10 }}>
            <span><span className="gen-w gap" style={{ cursor: 'default' }}>слово</span> пропуск</span>
            <span><span className="gen-w voc" style={{ cursor: 'default' }}>слово</span> в словарь</span>
            <label className="check" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={bank} onChange={(e) => setBank(e.target.checked)} /> В пропусках показывать слова для выбора</label>
          </div>
        </section>
      )}

      {vocab.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">{subj.isLang ? 'Перевод слов' : 'Определения'}</h2>
            <span className="small muted">{matchPairs.length} из {vocab.length} заполнено, без перевода слово не войдёт</span>
          </div>
          <div className="gen-vocab">
            {vocab.map((v, i) => (
              <div key={i} className="gen-vocab-row">
                <input className="input" value={v.term} onChange={(e) => setVocab(vocab.map((x, k) => (k === i ? { ...x, term: e.target.value } : x)))} aria-label="Слово" />
                <input className="input" value={v.translation} placeholder={subj.Meaning} onChange={(e) => setVocab(vocab.map((x, k) => (k === i ? { ...x, translation: e.target.value } : x)))} aria-label={subj.Meaning} />
                <button type="button" className="icon-btn" aria-label="Убрать" onClick={() => setVocab(vocab.filter((_, k) => k !== i))}><Icon name="close" size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {sents.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Собери предложение</h2>
            <span className="small muted">выбрано {orderList.length}</span>
          </div>
          <div className="gen-sents">
            {sents.slice(0, 30).map((s, i) => (
              <label key={i} className="check"><input type="checkbox" checked={chosenSents.has(i)} onChange={(e) => { const n = new Set(chosenSents); if (e.target.checked) n.add(i); else n.delete(i); setPicked(n); }} /> {s}</label>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="section-title">Вопросы на понимание</h2>
        <p className="small muted" style={{ margin: '6px 0 10px' }}>По одному на строку. <b>T:</b> верное утверждение, <b>F:</b> неверное. Вопрос с вариантами: <b>? Вопрос | *верный | неверный | неверный</b></p>
        <textarea className="textarea" rows={5} value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder={'T: Most teenagers need about nine hours of sleep.\nF: Phones help us fall asleep faster.\n? Why do teenagers go to bed late? | *Their body clock changes | They drink coffee | They have no homework'} />
        {q.errors.map((e) => <div key={e} className="small" style={{ color: 'var(--danger)', marginTop: 4 }}>{e}</div>)}
        {q.out.length > 0 && !q.errors.length && <div className="small muted" style={{ marginTop: 6 }}>Вопросов: {q.out.length}</div>}
        <h2 className="section-title" style={{ marginTop: 22 }}>Обсуждение</h2>
        <p className="small muted" style={{ margin: '6px 0 10px' }}>Открытые вопросы, ученик отвечает письменно, вы проверяете.</p>
        <textarea className="textarea" rows={3} value={discussion} onChange={(e) => setDiscussion(e.target.value)} placeholder={'What time do you usually go to bed?\nDo you agree that schools should start later? Why?'} />
        <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={retell} onChange={(e) => setRetell(e.target.checked)} /> Пересказ голосом в конце</label>
      </section>

      <section className="panel">
        <h2 className="section-title">Что создать</h2>
        <div className="gen-make">
          {[
            ['sheet', 'Текст или видео с вопросами', 'текст, видео, вопросы, обсуждение и пересказ одним листом'],
            ['gaps', 'Пропуски', `${gaps.size} ${gaps.size === 1 ? 'пропуск' : 'пропусков'}${bank ? ', слова для выбора' : ', ввод вручную'}`],
            ['match', 'Найди пару', `${matchPairs.length} ${subj.isLang ? 'слов с переводом' : 'терминов'}`],
            ['order', 'Собери предложение', `${orderList.length} предложений из текста`],
            ['set', 'Набор карточек', 'те же слова для самостоятельной тренировки всем ученикам'],
          ].map(([k, t, d]) => (
            <label key={k} className={`gen-make-item ${make[k] ? 'on' : ''}`}>
              <input type="checkbox" checked={make[k]} onChange={(e) => setMake({ ...make, [k]: e.target.checked })} />
              <span><b>{t}</b><span className="small muted">{d}</span></span>
            </label>
          ))}
        </div>
        <div className="row-between" style={{ marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
          <span className="small muted">{plan.length ? `Будет создано: ${plan.map((p) => p.title.split(': ').pop()).join(', ')}` : 'Пока нечего создавать'}</span>
          <button className="btn" disabled={busy || !plan.length} onClick={create}>{busy ? 'Создаём…' : 'Создать упражнения'}</button>
        </div>
      </section>
    </>
  );
}
