// components/Quiz.jsx — тест: редактор (преподаватель) и прохождение / разбор (ученик)
import { Icon } from '../ui';
import { plural } from '../format';

const newId = () => Math.random().toString(36).slice(2, 9);
const pointsWord = (n) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;

export const blankQuestion = (type = 'choice') =>
  type === 'choice'
    ? { id: newId(), type, prompt: '', options: ['', ''], correct: [0], points: 1 }
    : { id: newId(), type, prompt: '', options: [], correct: [''], points: 1 };

// Убрать пустые варианты перед сохранением
export function cleanQuestions(questions) {
  return questions.map((q) => {
    if (q.type === 'choice') {
      const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      const correctIdx = kept.findIndex((x) => x.i === q.correct[0]);
      return { ...q, prompt: q.prompt.trim(), options: kept.map((x) => x.o), correct: [Math.max(0, correctIdx)] };
    }
    return { ...q, prompt: q.prompt.trim(), options: [], correct: q.correct.map((c) => String(c).trim()).filter(Boolean) };
  });
}

/* ============================================================
   Редактор вопросов
   ============================================================ */
export function QuizEditor({ questions, onChange }) {
  const set = (i, patch) => onChange(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i, dir) => {
    const next = [...questions];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {questions.map((q, i) => (
        <div key={q.id} className="q-edit">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 6 }}>
              <strong>Вопрос {i + 1}</strong>
              <select className="select" style={{ height: 34, width: 'auto', fontSize: 13.5 }} value={q.type}
                onChange={(e) => set(i, { ...blankQuestion(e.target.value), id: q.id, prompt: q.prompt, points: q.points })}>
                <option value="choice">Выбор ответа</option>
                <option value="text">Вписать ответ</option>
              </select>
              <select className="select" style={{ height: 34, width: 'auto', fontSize: 13.5 }} value={q.points}
                onChange={(e) => set(i, { points: Number(e.target.value) })} aria-label="Баллы">
                {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{pointsWord(n)}</option>)}
              </select>
            </div>
            <div className="row" style={{ gap: 0 }}>
              <button type="button" className="icon-btn" aria-label="Выше" onClick={() => move(i, -1)} disabled={i === 0}><Icon name="arrowUp" size={18} /></button>
              <button type="button" className="icon-btn" aria-label="Ниже" onClick={() => move(i, 1)} disabled={i === questions.length - 1}><Icon name="arrowDown" size={18} /></button>
              <button type="button" className="icon-btn" aria-label="Удалить вопрос" onClick={() => onChange(questions.filter((_, k) => k !== i))}><Icon name="trash" size={18} /></button>
            </div>
          </div>

          <textarea className="textarea" style={{ minHeight: 60 }} placeholder={q.type === 'choice' ? 'She ___ a lawyer.' : 'Past Simple от go: I ___ home yesterday.'}
            value={q.prompt} onChange={(e) => set(i, { prompt: e.target.value })} />

          {q.type === 'choice' ? (
            <>
              <div className="small muted" style={{ marginTop: 10 }}>Варианты — отметьте правильный</div>
              {q.options.map((o, k) => (
                <div key={k} className="q-option-row">
                  <input type="radio" name={`c-${q.id}`} checked={q.correct[0] === k} onChange={() => set(i, { correct: [k] })} aria-label="Правильный ответ" />
                  <input className="input" style={{ height: 38 }} value={o} placeholder={`Вариант ${k + 1}`}
                    onChange={(e) => set(i, { options: q.options.map((x, n) => (n === k ? e.target.value : x)) })} />
                  {q.options.length > 2 && (
                    <button type="button" className="icon-btn" aria-label="Убрать вариант"
                      onClick={() => set(i, {
                        options: q.options.filter((_, n) => n !== k),
                        correct: [q.correct[0] > k ? q.correct[0] - 1 : q.correct[0] === k ? 0 : q.correct[0]],
                      })}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 8 && (
                <button type="button" className="btn btn-quiet btn-sm" style={{ marginTop: 6 }} onClick={() => set(i, { options: [...q.options, ''] })}>
                  <Icon name="plus" /> Вариант
                </button>
              )}
            </>
          ) : (
            <>
              <div className="small muted" style={{ marginTop: 10 }}>Правильные ответы — засчитается любой. Регистр и точка в конце не важны</div>
              {q.correct.map((c, k) => (
                <div key={k} className="q-option-row">
                  <input className="input" style={{ height: 38 }} value={c} placeholder={k === 0 ? 'went' : 'другой допустимый вариант'}
                    onChange={(e) => set(i, { correct: q.correct.map((x, n) => (n === k ? e.target.value : x)) })} />
                  {q.correct.length > 1 && (
                    <button type="button" className="icon-btn" aria-label="Убрать ответ" onClick={() => set(i, { correct: q.correct.filter((_, n) => n !== k) })}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              ))}
              {q.correct.length < 10 && (
                <button type="button" className="btn btn-quiet btn-sm" style={{ marginTop: 6 }} onClick={() => set(i, { correct: [...q.correct, ''] })}>
                  <Icon name="plus" /> Ещё вариант ответа
                </button>
              )}
            </>
          )}
        </div>
      ))}

      <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...questions, blankQuestion('choice')])}>
          <Icon name="plus" /> Вопрос с выбором
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...questions, blankQuestion('text')])}>
          <Icon name="plus" /> Вопрос с ответом словом
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Прохождение и разбор теста
   mode: 'answer' — ученик отвечает; 'view' — только смотрим; 'key' — преподаватель видит ключ
   results: {id: true/false} — после проверки; correct в вопросах — если открыты
   ============================================================ */
export function QuizForm({ questions, answers = {}, onChange, mode = 'answer', results }) {
  const editable = mode === 'answer';
  const setAnswer = (id, v) => onChange?.({ ...answers, [id]: v });

  return (
    <div className="quiz">
      {questions.map((q, i) => {
        const res = results ? results[q.id] : undefined;
        const given = answers[q.id];
        const showCorrect = Array.isArray(q.correct) && (results || mode === 'key');
        return (
          <div key={q.id} className={`question ${res === true ? 'ok' : res === false ? 'bad' : ''}`}>
            <div className="question-head">
              <div className="question-prompt">{i + 1}. {q.prompt}</div>
              <div className="question-points">{pointsWord(q.points)}</div>
            </div>

            {q.type === 'choice' ? (
              q.options.map((o, k) => {
                const selected = Number(given) === k && given !== undefined && given !== '';
                let cls = selected ? 'selected' : '';
                if (showCorrect) cls = k === q.correct[0] ? 'correct' : selected ? 'wrong' : '';
                return (
                  <label key={k} className={`option ${cls}`} style={editable ? undefined : { cursor: 'default' }}>
                    <input type="radio" name={`q-${q.id}`} checked={selected} disabled={!editable} onChange={() => setAnswer(q.id, k)} />
                    {o}
                  </label>
                );
              })
            ) : (
              <input className="input" value={given ?? ''} disabled={!editable} placeholder="Ваш ответ"
                onChange={(e) => setAnswer(q.id, e.target.value)}
                style={res === false ? { borderColor: 'var(--danger)' } : res === true ? { borderColor: 'var(--green)' } : undefined} />
            )}

            {mode === 'key' && q.type === 'text' && (
              <div className="answer-note ok">Правильно: {q.correct.join(' / ')}</div>
            )}
            {res === true && <div className="answer-note ok">Верно</div>}
            {res === false && (
              <div className="answer-note bad">
                {given === undefined || given === '' ? 'Нет ответа' : 'Неверно'}
                {showCorrect && q.type === 'text' ? `. Правильно: ${q.correct.join(' / ')}` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
