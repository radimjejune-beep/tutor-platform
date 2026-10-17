// components/GameResults.jsx — результаты упражнений
import { relativeDay, time } from '../format';
import { FileAudio } from '../games/Sheet';

// Сгруппировать результаты по упражнению: { [item_id]: [новые первыми] }
export function byItem(results = []) {
  const map = {};
  for (const r of results) (map[r.item_id] ||= []).push(r);
  return map;
}

const when = (d) => `${relativeDay(d).toLowerCase()} в ${time(d)}`;

// Короткая строка под упражнением: лучший результат и число попыток
export function ResultLine({ results, who = 'Ваш' }) {
  if (!results?.length) return null;
  const best = results.reduce((a, b) => (b.score > a.score ? b : a));
  const last = results[0];
  return (
    <div className="result-line">
      <span className={`result-pill ${best.total && best.score === 100 ? 'perfect' : ''}`}>{best.total ? `${best.correct}/${best.total}` : 'сдано'}</span>
      <span>
        {best.total ? `${who === 'Лучший' ? 'Лучший результат' : `${who} лучший результат`}: ${best.score}%. ` : ''}Попыток: {results.length}, последняя {when(last.created_at)}
      </span>
    </div>
  );
}

// Подробно для проверки ДЗ: лучший результат и ошибки последней попытки
export function GameResultsPanel({ items, results }) {
  const map = byItem(results);
  const games = items.filter((i) => i.kind === 'game');
  if (!games.length) return null;
  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="section-title" style={{ marginBottom: 12 }}>Упражнения</h2>
      <div className="stack" style={{ gap: 10 }}>
        {games.map((g) => {
          const rs = map[g.id] || [];
          const last = rs[0];
          const mistakes = last ? (last.details || []).filter((d) => d.ok === false) : [];
          const manual = last ? (last.details || []).filter((d) => d.manual) : [];
          return (
            <div key={g.id} className="lib-card" style={{ padding: '16px 18px' }}>
              <div className="row-between" style={{ gap: 12 }}>
                <div className="list-title">{g.title}</div>
                {rs.length ? <ResultLine results={rs} who="Лучший" /> : <span className="small muted">Не проходил</span>}
              </div>
              {manual.length > 0 && (
                <div className="manual-answers">
                  <div className="small muted">Ответы на проверку, последняя попытка:</div>
                  {manual.map((d, i) => (
                    <div key={i} className="manual-answer">
                      <div className="small"><b>{d.prompt}</b></div>
                      {d.file_id ? <FileAudio id={d.file_id} /> : <div className="manual-text">{d.given || <span className="muted">без ответа</span>}</div>}
                    </div>
                  ))}
                </div>
              )}
              {mistakes.length > 0 && (
                <div className="small" style={{ marginTop: 10 }}>
                  <div className="muted" style={{ marginBottom: 4 }}>Ошибки в последней попытке:</div>
                  <ul className="mistakes">
                    {mistakes.slice(0, 12).map((d, i) => (
                      <li key={i}>
                        {d.prompt ? <b>{d.prompt}: </b> : null}
                        <span className="bad-text">{d.given || 'без ответа'}</span> → {d.expected}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Средний лучший результат по упражнениям (подсказка для оценки ДЗ)
export function averageBest(items, results) {
  const map = byItem(results);
  const scores = items
    .filter((i) => i.kind === 'game' && map[i.id]?.some((r) => r.total))
    .map((i) => Math.max(...map[i.id].filter((r) => r.total).map((r) => r.score)));
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}
