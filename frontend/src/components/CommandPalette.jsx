// components/CommandPalette.jsx — быстрый поиск и действия (Ctrl+K / ⌘K или «/»)
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Icon, navigate } from '../ui';
import { NewLessonModal, PaymentModal, StudentModal } from '../pages/tutor/modals';

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е');

// Каждое слово запроса должно найтись в тексте команды
const match = (q, text) => norm(q).split(/\s+/).filter(Boolean).every((w) => norm(text).includes(w));

export function usePaletteHotkey(setOpen) {
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

export default function CommandPalette({ open, onClose, role, nav }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [data, setData] = useState({ students: [], groups: [] });
  const [modal, setModal] = useState(null);
  const input = useRef(null);
  const list = useRef(null);
  const tutor = role === 'tutor';

  useEffect(() => {
    if (!open) return;
    setQ('');
    setSel(0);
    setTimeout(() => input.current?.focus(), 0);
    if (tutor) {
      Promise.all([api.students('active').catch(() => []), api.groups().catch(() => [])]).then(([students, groups]) => setData({ students, groups }));
    }
  }, [open, tutor]);

  const commands = useMemo(() => {
    const go = (to) => () => navigate(to);
    const out = [];
    // Разделы
    for (const n of nav) out.push({ group: 'Разделы', icon: n.icon, label: n.label, run: go(n.to) });
    if (tutor) {
      out.push(
        { group: 'Действия', icon: 'plus', label: 'Новое занятие', run: () => setModal({ type: 'lesson' }) },
        { group: 'Действия', icon: 'book', label: 'Новое задание', run: go('/homework/new') },
        { group: 'Действия', icon: 'users', label: 'Новый ученик', run: () => setModal({ type: 'student' }) },
        { group: 'Действия', icon: 'users', label: 'Группы', run: go('/groups') },
        { group: 'Действия', icon: 'library', label: 'Новое упражнение', run: go('/library/new?kind=game') },
        { group: 'Действия', icon: 'play', label: 'Загрузить HTML-урок', run: go('/library/new?kind=html') },
      );
      for (const s of data.students) {
        const first = s.full_name;
        out.push(
          { group: 'Ученики', icon: 'users', label: s.full_name, hint: [s.level, s.textbook].filter(Boolean).join(', '), run: go(`/students/${s.id}`) },
          { group: 'Ученики', icon: 'plus', label: `Занятие: ${first}`, run: () => setModal({ type: 'lesson', studentId: s.id }), secondary: true },
          { group: 'Ученики', icon: 'book', label: `Задание: ${first}`, run: go(`/homework/new?student=${s.id}`), secondary: true },
          { group: 'Ученики', icon: 'wallet', label: `Оплата: ${first}`, run: () => setModal({ type: 'payment', student: s }), secondary: true },
          { group: 'Ученики', icon: 'cards', label: `Словарь: ${first}`, run: go(`/students/${s.id}/words`), secondary: true },
          { group: 'Ученики', icon: 'layers', label: `Курс: ${first}`, run: go(`/students/${s.id}/course`), secondary: true },
        );
      }
      for (const g of data.groups) {
        out.push({ group: 'Группы', icon: 'users', label: g.name, hint: g.members.map((m) => m.full_name.split(' ')[0]).join(', '), run: go(`/groups/${g.id}`) });
      }
    } else {
      out.push(
        { group: 'Действия', icon: 'play', label: 'Повторить слова', run: go('/words') },
        { group: 'Действия', icon: 'calendar', label: 'Записаться или перенести занятие', run: go('/schedule') },
      );
    }
    return out;
  }, [nav, tutor, data]);

  // Без запроса: разделы и действия; с запросом — всё, где совпали слова (подкоманды учеников только по запросу)
  const shown = useMemo(() => {
    const list2 = q.trim() ? commands.filter((c) => match(q, `${c.label} ${c.hint || ''}`)) : commands.filter((c) => !c.secondary && c.group !== 'Ученики' && c.group !== 'Группы');
    return list2.slice(0, 40);
  }, [q, commands]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (c) => {
    if (!c) return;
    const keepOpenForModal = ['Новое занятие', 'Новый ученик'].includes(c.label) || /^(Занятие|Оплата): /.test(c.label);
    c.run();
    if (!keepOpenForModal) onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]); }
    else if (e.key === 'Escape') onClose();
  };

  const closeModal = () => { setModal(null); onClose(); };

  if (!open && !modal) return null;
  let lastGroup = null;
  return (
    <>
      {open && !modal && (
        <div className="overlay palette-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <div className="palette" role="dialog" aria-modal="true" aria-label="Быстрый поиск">
            <div className="palette-input">
              <Icon name="search" size={18} />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} id="palette-q"
                placeholder={tutor ? 'Ученик, группа или действие: «оплата Анна», «задание»' : 'Куда перейти?'} aria-label="Поиск" autoComplete="off" />
              <kbd>Esc</kbd>
            </div>
            <div className="palette-list" ref={list} role="listbox">
              {!shown.length && <div className="palette-empty">Ничего не нашлось</div>}
              {shown.map((c, i) => {
                const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
                return (
                  <div key={`${c.group}-${c.label}`}>
                    {head && <div className="palette-group">{head}</div>}
                    <button role="option" aria-selected={i === sel} className="palette-item" onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
                      <Icon name={c.icon} size={17} />
                      <span className="palette-label">{c.label}</span>
                      {c.hint && <span className="palette-hint">{c.hint}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="palette-foot">↑ ↓ выбрать · Enter открыть · Ctrl K или / из любого места</div>
          </div>
        </div>
      )}
      {modal?.type === 'lesson' && <NewLessonModal studentId={modal.studentId} onClose={closeModal} onSaved={() => { closeModal(); navigate('/schedule'); }} />}
      {modal?.type === 'student' && <StudentModal onClose={closeModal} onSaved={(s) => { closeModal(); navigate(`/students/${s.id}/access`); }} />}
      {modal?.type === 'payment' && (
        <PaymentModal student={modal.student} onClose={closeModal} onSaved={closeModal} />
      )}
    </>
  );
}
