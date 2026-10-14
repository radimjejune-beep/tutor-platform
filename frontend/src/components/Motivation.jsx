// components/Motivation.jsx — серия дней, очки, лига недели и разминка перед уроком
import { useState } from 'react';
import { api } from '../api';
import { useLoad, Modal, Icon, Link } from '../ui';
import VocabPractice from './VocabPractice';
import { plural, time } from '../format';

const daysWord = (n) => plural(n, 'день', 'дня', 'дней');
const pointsWord = (n) => plural(n, 'очко', 'очка', 'очков');

// Карточка ученика: серия, очки, 14 дней активности, лига
export function MotivationCard({ studentId, compact }) {
  const m = useLoad(() => api.motivation(studentId), [studentId]);
  if (!m.data) return null;
  const d = m.data;
  const max = Math.max(1, ...d.days.map((x) => x.points));
  const me = d.league?.find((r) => r.me);

  return (
    <section className="motiv">
      <div className="motiv-stats">
        <div>
          <b className="serif">{d.streak}</b>
          <span>{daysWord(d.streak)} подряд{d.streak && !d.active_today ? ', позанимайтесь сегодня, чтобы не прервать' : ''}</span>
        </div>
        <div>
          <b className="serif">{d.points.week}</b>
          <span>{pointsWord(d.points.week)} за неделю</span>
        </div>
        {me && (
          <div>
            <b className="serif">{me.rank}</b>
            <span>место в лиге из {d.league_size}</span>
          </div>
        )}
      </div>
      <div className="motiv-days" aria-label="Активность за 14 дней">
        {d.days.map((x) => (
          <i key={x.day} title={`${x.day}: ${x.points} ${pointsWord(x.points)}`}
            style={{ opacity: x.points ? 0.25 + (0.75 * x.points) / max : 1 }} className={x.points ? 'on' : ''} />
        ))}
      </div>
      {!compact && d.league && (
        <div className="motiv-league">
          <span className="meta-label">Лига недели</span>
          <ol>
            {d.league.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={r.me ? 'me' : ''}>
                <span className="lg-rank">{r.rank}</span>
                <span className="lg-name">{r.me ? `${r.name} (вы)` : r.name}</span>
                <span className="lg-pts num">{r.points}</span>
              </li>
            ))}
          </ol>
          <div className="small muted">Очки: карточка 1, верное слово 2, верный ответ в упражнении 1, сданное ДЗ 10 и ещё 5, если вовремя. Неделя начинается в понедельник.</div>
        </div>
      )}
    </section>
  );
}

// Разминка: за час до урока и пока он идёт, если ещё не сделана
export function warmupOpen(lesson) {
  if (!lesson || lesson.status !== 'scheduled' || lesson.warmup_result) return false;
  const start = new Date(lesson.starts_at).getTime();
  const now = Date.now();
  return now >= start - 60 * 60000 && now <= start + lesson.duration_min * 60000;
}

export function WarmupBanner({ lesson, studentId, onDone }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null);
  if (!warmupOpen(lesson) && !done) return null;
  return (
    <>
      <div className="warmup">
        <div style={{ minWidth: 0 }}>
          <span className="meta-label">Перед уроком в {time(lesson.starts_at)}</span>
          <span className="serif warmup-title">{done ? `Разминка: ${done.correct} из ${done.total}` : 'Разминка, 8 слов, 3 минуты'}</span>
          {!done && <span className="small muted">Слова, в которых были ошибки. Преподаватель увидит, с чего начать.</span>}
        </div>
        {!done && <button className="btn" onClick={() => setOpen(true)}><Icon name="play" /> Начать</button>}
      </div>
      {open && (
        <Modal title="Разминка" onClose={() => setOpen(false)} wide>
          <VocabPractice studentId={studentId} lessonId={lesson.id} count={8}
            onDone={(r) => { setOpen(false); setDone(r); onDone?.(r); }} />
        </Modal>
      )}
    </>
  );
}

// Преподаватель: лига недели с полными именами и сериями
export function LeagueBoard() {
  const l = useLoad(() => api.league(), []);
  if (!l.data || !l.data.enabled || !l.data.students.length) return null;
  const list = l.data.students.slice(0, 8);
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-head">
        <h2 className="section-title">Лига недели</h2>
        <Link to="/settings/page" className="small muted">Настроить</Link>
      </div>
      <ol className="league-list">
        {list.map((s) => (
          <li key={s.id}>
            <span className="lg-rank">{s.rank}</span>
            <Link to={`/students/${s.id}`} className="lg-name">{s.full_name}</Link>
            <span className="small muted">{s.streak ? `${s.streak} ${daysWord(s.streak)} подряд` : 'нет серии'}</span>
            <span className="lg-pts num">{s.points}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
