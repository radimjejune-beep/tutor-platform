// pages/client/Words.jsx — личный словарь ученика: повторение по карточкам и список слов
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon } from '../../ui';
import { FlashSession, VocabList, VocabStats, wordsWord } from '../../components/Vocab';
import VocabPractice from '../../components/VocabPractice';

export default function Words({ student, isParent }) {
  const vocab = useLoad(() => api.vocab(student.id), [student.id]);
  const [session, setSession] = useState(false);

  if (vocab.loading) return <Spinner />;
  if (vocab.error) return <ErrorBox error={vocab.error} onRetry={vocab.reload} />;
  const { items, stats } = vocab.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Словарь</h1>
          <div className="lead">
            {isParent ? `Слова, которые учит ${student.full_name.split(' ')[0]}: из уроков и из упражнений с ошибками.` : 'Слова из уроков и из упражнений, где были ошибки.'}
            {' '}Повторяйте понемногу каждый день.
          </div>
        </div>
      </div>

      {session ? (
        <section className="panel">
          {session === 'practice'
            ? <VocabPractice studentId={student.id} count={12} onDone={() => { setSession(false); vocab.reload(); }} />
            : <FlashSession studentId={student.id} onDone={() => { setSession(false); vocab.reload(); }} />}
        </section>
      ) : (
        <>
          <section className="panel words-hero">
            <VocabStats stats={stats} />
            <div className="row wrap" style={{ gap: 8 }}>
              {stats.total >= 4 && (
                <button className="btn btn-secondary" style={{ height: 48 }} onClick={() => setSession('practice')}>Тренировка</button>
              )}
              {stats.due > 0 ? (
                <button className="btn" style={{ height: 48 }} onClick={() => setSession('cards')}>
                  <Icon name="play" /> Повторить {wordsWord(stats.due)}
                </button>
              ) : (
                <div className="muted small">{stats.total ? 'На сегодня всё повторено' : ''}</div>
              )}
            </div>
          </section>

          <section className="panel">
            {items.length ? (
              <VocabList items={items} onChanged={vocab.reload} />
            ) : (
              <Empty title="Словарь пока пуст">Слова появятся после урока или первого упражнения.</Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}
