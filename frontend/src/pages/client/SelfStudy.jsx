// pages/client/SelfStudy.jsx — полоска на главной: «учи сам», если есть наборы, которые ещё не выучены
import { api } from '../../api';
import { useLoad, Icon, Link } from '../../ui';
import { plural } from '../../format';

export function SelfStudyStrip({ studentId }) {
  const sets = useLoad(() => api.mySets(studentId), [studentId]);
  const open = (sets.data || []).filter((s) => s.progress.learned < s.progress.total);
  if (!open.length) return null;
  const words = open.reduce((n, s) => n + s.progress.total - s.progress.learned, 0);
  const one = open.length === 1;
  return (
    <Link to={one ? `/words/set/${open[0].id}` : '/words'} className="words-strip">
      <span>
        <span className="meta-label">Учи сам · карточки</span>
        <span className="serif words-strip-title">{one ? open[0].title : `${open.length} ${plural(open.length, 'набор', 'набора', 'наборов')} от преподавателя`}: ещё {words} {plural(words, 'слово', 'слова', 'слов')}</span>
      </span>
      <span className="btn btn-sm"><Icon name="play" /> Учить</span>
    </Link>
  );
}
