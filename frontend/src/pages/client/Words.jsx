// pages/client/Words.jsx — словарь ученика: наборы карточек от преподавателя, личный словарь,
// свои слова (вставкой, как в Quizlet) и самостоятельная тренировка в любое время
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Link, Modal, useToast } from '../../ui';
import { FlashSession, VocabList, VocabStats, wordsWord } from '../../components/Vocab';
import VocabPractice from '../../components/VocabPractice';
import Study, { wordsCount } from '../../components/Study';
import WordPaste from '../../components/WordPaste';
import { SetProgress } from './SetStudy';
import { useSubject } from '../../subjects';
import { shortDate, plural } from '../../format';

export default function Words({ student, isParent }) {
  const data = useLoad(() => Promise.all([api.vocab(student.id), api.mySets(student.id).catch(() => []), api.practiceActivity(student.id).catch(() => null)]), [student.id]);
  const [session, setSession] = useState(false);
  const [adding, setAdding] = useState(false);
  const subj = useSubject(student.subject);
  const name = student.full_name.split(' ')[0];

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [{ items, stats }, sets, activity] = data.data;
  const close = () => { setSession(false); data.reload(); };
  const studyWords = items.filter((w) => w.translation).map((w) => ({ key: String(w.id), id: w.id, term: w.term, translation: w.translation, example: w.example, level: w.box >= 4 ? 3 : w.box >= 2 ? 2 : w.box >= 1 ? 1 : 0 }));

  const onFinishVocab = async (mode, results, sec) => {
    await api.savePractice({ student_id: student.id, mode, duration_sec: sec, results: results.map((r) => ({ id: Number(r.key), ok: r.ok })) });
    return 'Сохранено. Слова с ошибками вернутся в повторение завтра.';
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{subj.vocabTitle}</h1>
          <div className="lead">
            {isParent ? `Наборы от преподавателя и ${subj.isLang ? 'слова' : 'термины'}, которые учит ${name}.` : `Учи в любое время: наборы от преподавателя, свои ${subj.isLang ? 'слова' : 'термины'} и повторение.`}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => setAdding(true)}><Icon name="plus" /> {subj.isLang ? 'Свои слова' : 'Свои термины'}</button>
      </div>

      {session ? (
        <section className="panel">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 className="section-title">{session === 'study' ? 'Мой словарь целиком' : session === 'practice' ? 'Тренировка' : 'Повторение'}</h2>
            <button className="btn btn-quiet btn-sm" onClick={close}><Icon name="close" /> Закрыть</button>
          </div>
          {session === 'practice' && <VocabPractice studentId={student.id} subject={student.subject} count={12} onDone={close} />}
          {session === 'cards' && <FlashSession studentId={student.id} subject={student.subject} onDone={close} />}
          {session === 'study' && <Study words={studyWords} subject={student.subject} onFinish={onFinishVocab} />}
        </section>
      ) : (
        <>
          {activity?.week?.sessions > 0 && (
            <div className="practice-week">
              <Icon name="flag" size={18} />
              <span>За неделю: {activity.week.sessions} {plural(activity.week.sessions, 'тренировка', 'тренировки', 'тренировок')}, {activity.week.days} {plural(activity.week.days, 'день', 'дня', 'дней')} с занятиями, {activity.week.answers} {plural(activity.week.answers, 'ответ', 'ответа', 'ответов')}.</span>
            </div>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2 className="section-title">Наборы карточек</h2>
              {sets.length > 0 && <span className="small muted">{sets.length} {plural(sets.length, 'набор', 'набора', 'наборов')}</span>}
            </div>
            {!sets.length && <p className="muted small" style={{ margin: 0 }}>Преподаватель пока не добавил наборы. Пока можно учить свой словарь ниже или добавить свои {subj.isLang ? 'слова' : 'термины'}.</p>}
            <div className="set-grid">
              {sets.map((s) => (
                <Link key={s.id} to={`/words/set/${s.id}`} className="set-card">
                  <span className="set-card-title">{s.title}</span>
                  <span className="small muted">{wordsCount(s.progress.total)}{s.last_practice ? ` · учил ${shortDate(s.last_practice)}` : ' · ещё не начат'}</span>
                  <SetProgress p={s.progress} />
                  <span className="set-card-go">{s.progress.learned === s.progress.total ? 'Повторить' : s.progress.new === s.progress.total ? 'Начать' : 'Продолжить'} <Icon name="play" size={14} /></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel words-hero">
            <div>
              <h2 className="section-title" style={{ marginBottom: 12 }}>Мой словарь</h2>
              <VocabStats stats={stats} />
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {studyWords.length >= 2 && <button className="btn btn-secondary" style={{ height: 48 }} onClick={() => setSession('study')}>Учить все</button>}
              {stats.total >= 4 && <button className="btn btn-secondary" style={{ height: 48 }} onClick={() => setSession('practice')}>Тренировка</button>}
              {stats.due > 0 ? (
                <button className="btn" style={{ height: 48 }} onClick={() => setSession('cards')}><Icon name="play" /> Повторить {wordsWord(stats.due, subj.item)}</button>
              ) : (
                <div className="muted small">{stats.total ? 'На сегодня всё повторено' : ''}</div>
              )}
            </div>
          </section>

          <section className="panel">
            {items.length ? (
              <VocabList items={items} onChanged={data.reload} />
            ) : (
              <Empty title="Пока пусто">{subj.isLang ? 'Слова' : 'Термины'} появятся после урока и упражнений. Можно добавить свои кнопкой вверху.</Empty>
            )}
          </section>
        </>
      )}
      {adding && <AddMine student={student} subj={subj} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); data.reload(); }} />}
    </>
  );
}

function AddMine({ student, subj, onClose, onSaved }) {
  const toast = useToast();
  const [words, setWords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.addMyWords(student.id, words.slice(0, 300));
      toast(r.added === r.total ? `Добавлено: ${r.added}` : `Добавлено: ${r.added}, остальные уже были`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={subj.isLang ? 'Добавить свои слова' : 'Добавить свои термины'} onClose={onClose} wide>
      <p className="small muted" style={{ marginTop: 0 }}>Вставь список из заметок, Word или Quizlet: {subj.isLang ? 'слово' : 'термин'} и {subj.meaning} через Tab, тире или запятую, каждая карточка с новой строки.</p>
      <WordPaste onWords={(w) => setWords(w)} autoFocus rows={7} />
      {words.length > 300 && <div className="small" style={{ color: 'var(--danger)' }}>За раз можно добавить до 300 карточек.</div>}
      {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="button" className="btn" disabled={!words.length || busy} onClick={save}>{busy ? 'Сохраняем…' : `Добавить${words.length ? ` (${Math.min(words.length, 300)})` : ''}`}</button>
      </div>
    </Modal>
  );
}
