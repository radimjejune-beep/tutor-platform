// pages/tutor/ImportStudents.jsx — добавить сразу много учеников: вставить список, по строке на ученика.
// Можно сразу выдать входы ученикам и родителям и скопировать приглашения для всех.
import { useState } from 'react';
import { api } from '../../api';
import { Modal, Field, Icon, useToast } from '../../ui';
import { inviteText } from './modals';
import { useAuth } from '../../auth';

// «Иван Петров; A2; 1500» → { full_name, level, default_price }. Разделитель: точка с запятой, табуляция или запятая
export function parseStudents(text) {
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s*[;\t,]\s*/).map((x) => x.trim()).filter(Boolean);
    const name = parts.shift() || '';
    const out = { full_name: name.slice(0, 255) };
    for (const p of parts) {
      const n = Number(p.replace(/[\s₽р.]/gi, ''));
      if (/^\d[\d\s]*\s*(₽|р\.?|руб\.?)?$/i.test(p) && n >= 0 && n <= 100000) out.default_price = n;
      else if (!out.level && p.length <= 50) out.level = p;
    }
    return out;
  }).filter((s) => s.full_name.length >= 2);
}

const CATS = [['adult', 'Взрослые'], ['teen', 'Подростки'], ['child', 'Дети']];

export default function ImportStudents({ onClose, onDone }) {
  const toast = useToast();
  const { user } = useAuth();
  const tutor = user?.full_name && user.full_name !== 'Преподаватель' ? user.full_name : '';
  const [text, setText] = useState('');
  const [category, setCategory] = useState('adult');
  const [ownLogin, setOwnLogin] = useState(true);
  const [parentLogin, setParentLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const list = parseStudents(text);

  const setCat = (c) => { setCategory(c); setOwnLogin(c !== 'child'); setParentLogin(c !== 'adult'); };

  const run = async () => {
    setBusy(true);
    const rows = [];
    let stop = null;
    for (let i = 0; i < list.length; i++) {
      setProgress(i);
      const s = list[i];
      try {
        const st = await api.createStudent({ ...s, category });
        const row = { name: st.full_name, id: st.id, accounts: [] };
        if (ownLogin) {
          const r = await api.createStudentLogin(st.id, {}).catch((e) => ({ error: e.message }));
          row.accounts.push({ role: 'student', who: st.full_name, ...r });
        }
        if (parentLogin) {
          const r = await api.addParent(st.id, { full_name: `Родитель: ${st.full_name}` }).catch((e) => ({ error: e.message }));
          row.accounts.push({ role: 'parent', who: '', ...r });
        }
        rows.push(row);
      } catch (e) {
        stop = `«${s.full_name}» и дальше не добавлены: ${e.message}`;
        break;
      }
    }
    setResult({ rows, stop });
    setBusy(false);
    onDone();
  };

  const invites = (result?.rows || []).flatMap((r) => r.accounts.filter((a) => a.password).map((a) => `${a.role === 'parent' ? `Родителю (${r.name})` : r.name}:\n${inviteText({ login: a.login, password: a.password, who: a.role === 'parent' ? '' : r.name, role: a.role, tutor })}`));
  const copyAll = () => navigator.clipboard?.writeText(invites.join('\n\n• • •\n\n')).then(() => toast(`Скопировано приглашений: ${invites.length}`));
  const copyOne = (r, a) => navigator.clipboard?.writeText(inviteText({ login: a.login, password: a.password, who: a.role === 'parent' ? '' : r.name, role: a.role, tutor })).then(() => toast('Приглашение скопировано'));

  if (result) {
    return (
      <Modal title={`Добавлено учеников: ${result.rows.length}`} onClose={onClose} wide>
        {result.stop && <div className="alert" style={{ marginBottom: 12 }}>{result.stop}</div>}
        {invites.length > 0 && (
          <div className="row-between" style={{ marginBottom: 12 }}>
            <span className="small muted">Пароли показываются один раз. Скопируйте приглашения сейчас.</span>
            <button className="btn btn-sm" onClick={copyAll}><Icon name="send" size={16} /> Скопировать все приглашения</button>
          </div>
        )}
        <div className="table-scroll">
          <table className="import-table">
            <thead><tr><th>Ученик</th><th>Кто</th><th>Логин</th><th>Пароль</th><th /></tr></thead>
            <tbody>
              {result.rows.flatMap((r) => (r.accounts.length ? r.accounts : [{ role: null }]).map((a, i) => (
                <tr key={`${r.id}-${i}`}>
                  <td>{i === 0 ? r.name : ''}</td>
                  <td className="muted">{a.role === 'parent' ? 'Родитель' : a.role === 'student' ? 'Ученик' : 'Без входа'}</td>
                  <td>{a.error ? <span className="muted">{a.error}</span> : <b>{a.login}</b>}</td>
                  <td>{a.password && <code>{a.password}</code>}</td>
                  <td>{a.password && <button className="btn btn-quiet btn-sm" onClick={() => copyOne(r, a)}>Копировать</button>}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Готово</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Добавить списком" onClose={onClose} wide>
      <div className="form">
        <Field label="Ученики, по одному в строке" hint="Можно добавить уровень и цену урока через точку с запятой: «Иван Петров; A2; 1500». Остальное заполните потом в карточке.">
          <textarea className="input" rows={8} style={{ minHeight: 180, height: "auto", padding: "12px 14px", lineHeight: 1.5 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Анна Смирнова; A2; 1500\nМиша Петров; A1\nОля'} />
        </Field>
        <Field label="Кто это">
          <div className="seg">
            {CATS.map(([k, l]) => <button type="button" key={k} className={category === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}
          </div>
        </Field>
        <label className="check"><input type="checkbox" checked={ownLogin} onChange={(e) => setOwnLogin(e.target.checked)} /> Сразу выдать вход ученику</label>
        <label className="check"><input type="checkbox" checked={parentLogin} onChange={(e) => setParentLogin(e.target.checked)} /> Сразу выдать вход родителю</label>
        {list.length > 0 && (
          <div className="small muted">
            Будет добавлено: {list.length}. {list.slice(0, 4).map((s) => [s.full_name, s.level, s.default_price != null && `${s.default_price} ₽`].filter(Boolean).join(', ')).join(' · ')}{list.length > 4 ? ' …' : ''}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Отмена</button>
          <button type="button" className="btn" disabled={!list.length || busy} onClick={run}>
            {busy ? `Добавляем ${progress + 1} из ${list.length}…` : `Добавить${list.length ? ` (${list.length})` : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
