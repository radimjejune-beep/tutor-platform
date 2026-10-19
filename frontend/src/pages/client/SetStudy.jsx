// pages/client/SetStudy.jsx — ученик учит набор карточек от преподавателя
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Icon, Link, useToast } from '../../ui';
import Study, { LevelDot, wordsCount } from '../../components/Study';
import { speak, canSpeak } from '../../components/Vocab';
import { useSubject } from '../../subjects';

export function SetProgress({ p }) {
  const pct = (n) => `${p.total ? (n / p.total) * 100 : 0}%`;
  return (
    <div className="set-progress">
      <div className="set-bar" aria-hidden="true">
        <span className="lv3" style={{ width: pct(p.learned) }} />
        <span className="lv1" style={{ width: pct(p.learning) }} />
      </div>
      <div className="set-legend small muted">
        <span><LevelDot level={3} /> выучено {p.learned}</span>
        <span><LevelDot level={1} /> учу {p.learning}</span>
        <span><LevelDot level={0} /> новых {p.new}</span>
      </div>
    </div>
  );
}

export default function SetStudy({ id, student }) {
  const toast = useToast();
  const subj = useSubject(student.subject);
  const set = useLoad(() => api.wordSet(id, student.id), [id, student.id]);
  const [levels, setLevels] = useState(null); // обновлённые уровни после тренировки
  const [progress, setProgress] = useState(null);
  const [showList, setShowList] = useState(false);

  if (set.loading) return <Spinner />;
  if (set.error) return <ErrorBox error={set.error} onRetry={set.reload} />;
  const s = set.data;
  const lv = levels || new Map(s.words.map((w) => [w.term, w.level]));
  const words = s.words.map((w) => ({ key: w.term.toLowerCase(), term: w.term, translation: w.translation, example: w.example, level: lv.get(w.term) ?? 0 }));
  const p = progress || s.progress;

  const onFinish = async (mode, results, sec) => {
    const r = await api.saveSetProgress(id, { student_id: student.id, mode, duration_sec: sec, results: results.map((x) => ({ term: x.term, ok: x.ok })) });
    if (!r.saved) return 'Это пробный режим: результат не сохраняется.';
    setLevels(new Map(r.words.map((w) => [w.term, w.level])));
    setProgress(r.progress);
    const missed = results.filter((x) => !x.ok).length;
    return `Сохранено. Выучено ${r.progress.learned} из ${r.progress.total}.${missed && ['learn', 'write', 'test'].includes(mode) ? ' Ошибки добавлены в словарь на повторение.' : ''}`;
  };
  const toVocab = async () => {
    try {
      const r = await api.setToVocab(id, student.id);
      toast(r.added ? `В словарь добавлено: ${r.added}` : 'Все слова уже есть в словаре');
    } catch (err) { toast(err.message, 'error'); }
  };
  const reset = async () => {
    if (!window.confirm('Начать набор заново? Прогресс по словам обнулится.')) return;
    try {
      await api.resetSet(id, student.id);
      setLevels(null); setProgress(null); set.reload();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <Link to="/words" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> {subj.vocabTitle}</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{s.title}</h1>
          <div className="lead">{wordsCount(s.words.length)}{s.description ? `. ${s.description}` : ''}</div>
        </div>
      </div>
      <section className="panel">
        <SetProgress p={p} />
        <div style={{ marginTop: 22 }}>
          <Study words={words} subject={student.subject} onFinish={onFinish} />
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Карточки набора</h2>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowList(!showList)}>{showList ? 'Свернуть' : 'Показать все'}</button>
        </div>
        {showList && (
          <table className="vocab-table">
            <tbody>
              {words.map((w) => (
                <tr key={w.key}>
                  <td>{canSpeak() && <button className="icon-btn" aria-label="Послушать" onClick={() => speak(w.term)}><Icon name="sound" size={16} /></button>}</td>
                  <td className="vocab-term"><span className="serif">{w.term}</span>{w.translation && <span className="vocab-tr-sm">{w.translation}</span>}{w.example && <span className="small muted vocab-example">{w.example}</span>}</td>
                  <td className="vocab-tr">{w.translation}</td>
                  <td className="vocab-meta"><LevelDot level={w.level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row wrap" style={{ gap: 8, marginTop: showList ? 14 : 0 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={toVocab}><Icon name="plus" /> В мой словарь на повторение</button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={reset}>Начать заново</button>
        </div>
      </section>
    </>
  );
}
