// components/VocabPractice.jsx — отработка слов из личного словаря: пары, выбор перевода,
// напиши слово, вставь в предложение, услышь и выбери. Каждое слово сдвигается в повторении
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Spinner, Empty, Icon, useToast } from '../ui';
import { speak, canSpeak } from './Vocab';
import { useSubject } from '../subjects';

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clean = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}' /-]/gu, ' ').replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Предложение-пример с пропуском вместо слова
function gapOf(w) {
  if (!w.example) return null;
  const term = w.term.replace(/\s*\(.*?\)/g, '');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(w.example) ? w.example.replace(re, '_____') : null;
}

// Для каждого слова выбираем подходящий вид задания, чтобы не было однообразно
function buildTasks(words, pool) {
  const others = (w) => shuffle(pool.filter((p) => p.term.toLowerCase() !== w.term.toLowerCase())).slice(0, 3);
  return shuffle(words).map((w, i) => {
    const kinds = [];
    if (w.translation && pool.length >= 3) kinds.push('choose');
    if (w.translation) kinds.push('type');
    if (gapOf(w)) kinds.push('gap');
    if (pool.length >= 3 && canSpeak()) kinds.push('listen');
    const kind = kinds.length ? kinds[i % kinds.length] : 'type';
    const distract = others(w);
    if (kind === 'choose') return { w, kind, options: shuffle([w.translation, ...distract.map((d) => d.translation)]) };
    if (kind === 'listen') return { w, kind, options: shuffle([w.term, ...distract.map((d) => d.term)]) };
    if (kind === 'gap') return { w, kind, text: gapOf(w) };
    return { w, kind: w.translation ? 'type' : 'gap', text: gapOf(w) };
  });
}


export default function VocabPractice({ studentId, subject, homeworkId, lessonId, count = 12, onDone }) {
  const toast = useToast();
  const subj = useSubject(subject);
  const PROMPT = subj.prompts;
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState([]);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState(null); // { ok, given }
  const [final, setFinal] = useState(null);

  useEffect(() => {
    api.vocabPractice(studentId, count).then(setData).catch((e) => toast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, count]);

  const tasks = useMemo(() => (data ? buildTasks(data.words, data.pool) : []), [data]);
  const t = tasks[step];

  useEffect(() => {
    if (t?.kind === 'listen') speak(t.w.term);
  }, [t]);

  if (!data) return <Spinner />;
  if (!tasks.length) return <Empty title={subj.isLang ? 'Слов для отработки пока нет' : 'Терминов для отработки пока нет'}>Они появятся после урока или упражнений. Можно сдавать работу без этой части.</Empty>;

  if (final) {
    return (
      <div className="flash-done">
        <div className="serif flash-big">{final.correct} из {final.total}</div>
        <p className="muted">
          {final.correct === final.total ? 'Всё верно!' : 'Ошибки вернутся в повторение уже завтра.'}
          {homeworkId ? ' Результат сохранён в задании.' : ''}
          {lessonId ? ' Преподаватель увидит результат к началу урока.' : ''}
          {final.correct > 0 ? ` +${final.correct * 2} очков.` : ''}
        </p>
        <button className="btn btn-secondary" onClick={() => onDone?.(final)}>Готово</button>
      </div>
    );
  }

  const check = (given) => {
    if (state) return;
    const w = t.w;
    const ok = t.kind === 'choose' ? given === w.translation : clean(given) === clean(w.term);
    setState({ ok, given });
    setResults((r) => [...r, { id: w.id, ok }]);
    speak(w.term);
  };

  const next = async () => {
    setState(null);
    setAnswer('');
    if (step + 1 < tasks.length) return setStep(step + 1);
    try {
      const r = await api.savePractice({ student_id: studentId, homework_id: homeworkId, lesson_id: lessonId, results });
      setFinal(r);
    } catch (e) {
      toast(e.message, 'error');
      setFinal({ correct: results.filter((x) => x.ok).length, total: results.length });
    }
  };

  const w = t.w;
  return (
    <div className="practice">
      <div className="row-between">
        <span className="meta-label">{PROMPT[t.kind]}</span>
        <span className="meta-label">{step + 1} / {tasks.length}</span>
      </div>
      <div className="bar" style={{ marginTop: 10 }}><span style={{ width: `${(step / tasks.length) * 100}%` }} /></div>

      <div className="practice-q">
        {t.kind === 'choose' && <span className="serif flash-big">{w.term}</span>}
        {t.kind === 'type' && <span className="serif flash-big">{w.translation}</span>}
        {t.kind === 'gap' && <span className="serif practice-gap">{t.text}</span>}
        {t.kind === 'gap' && w.translation && <span className="small muted">Подсказка: {w.translation}</span>}
        {t.kind === 'listen' && (
          <button type="button" className="btn btn-secondary" onClick={() => speak(w.term)}><Icon name="sound" /> Послушать ещё раз</button>
        )}
      </div>

      {(t.kind === 'choose' || t.kind === 'listen') && (
        <div className="practice-opts">
          {t.options.map((o) => {
            const right = t.kind === 'choose' ? o === w.translation : o === w.term;
            const cls = state ? (right ? 'ok' : state.given === o ? 'bad' : '') : '';
            return <button key={o} type="button" className={`practice-opt ${cls}`} disabled={Boolean(state)} onClick={() => check(o)}>{o}</button>;
          })}
        </div>
      )}
      {(t.kind === 'type' || t.kind === 'gap') && (
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (answer.trim()) check(answer); }}>
          <input className="input practice-input" id="practice-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={Boolean(state)}
            autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Ответ" autoFocus aria-label="Ответ" />
          {!state && <button className="btn" disabled={!answer.trim()}>Проверить</button>}
        </form>
      )}

      {state && (
        <div className={`practice-fb ${state.ok ? 'ok' : 'bad'}`}>
          {state.ok ? 'Верно!' : <>Правильно: <b>{t.kind === 'choose' ? w.translation : w.term}</b></>}
          {w.example && t.kind !== 'gap' && <span className="small"> · {w.example}</span>}
        </div>
      )}
      {state && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={next} autoFocus>{step + 1 < tasks.length ? 'Дальше' : 'Закончить'}</button>
        </div>
      )}
    </div>
  );
}
