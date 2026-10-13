// components/WeekGrid.jsx — неделя сеткой: перетащить урок = перенести, клик по пустому месту = новый урок
import { useMemo, useRef, useState } from 'react';
import { time, LESSON_STATUS } from '../format';

const HOUR = 56; // высота часа, px
const SNAP = 15; // шаг переноса, минут
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Групповое занятие: одна карточка на всех учеников
function blocksOf(lessons) {
  const out = [];
  const groups = {};
  for (const l of lessons) {
    if (l.status === 'cancelled') continue;
    if (l.group_id) {
      const key = `${l.group_id}|${l.starts_at}`;
      if (!groups[key]) {
        groups[key] = { key, group: true, lesson: l, members: [] };
        out.push(groups[key]);
      }
      groups[key].members.push(l);
    } else out.push({ key: `l${l.id}`, group: false, lesson: l, members: [l] });
  }
  return out;
}

export default function WeekGrid({ from, lessons, onOpen, onCreate, onMove }) {
  const blocks = useMemo(() => blocksOf(lessons), [lessons]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(from.getTime() + i * 864e5));
  const today = new Date().toDateString();

  // Часы: с 8 до 22, расширяем, если есть уроки раньше или позже
  let startH = 8;
  let endH = 22;
  for (const b of blocks) {
    const d = new Date(b.lesson.starts_at);
    startH = Math.min(startH, d.getHours());
    endH = Math.max(endH, Math.ceil(d.getHours() + (d.getMinutes() + b.lesson.duration_min) / 60));
  }
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  const cols = useRef(null);
  const [drag, setDrag] = useState(null); // { key, day, minutes, moved }
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const pos = (b) => {
    const d = new Date(b.lesson.starts_at);
    return { day: (d.getDay() + 6) % 7, minutes: d.getHours() * 60 + d.getMinutes() };
  };

  // Где сейчас указатель: какой день и сколько минут от полуночи
  const pointAt = (e) => {
    const rect = cols.current.getBoundingClientRect();
    const colW = rect.width / 7;
    const day = Math.max(0, Math.min(6, Math.floor((e.clientX - rect.left) / colW)));
    const minutes = startH * 60 + ((e.clientY - rect.top) / HOUR) * 60;
    return { day, minutes };
  };

  const onDown = (b) => (e) => {
    if (b.members.every((m) => m.status !== 'scheduled')) return; // проведённые не двигаем
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    const cur = pos(b);
    setDrag({ key: b.key, b, day: cur.day, minutes: cur.minutes, grabDay: p.day - cur.day, grabMin: p.minutes - cur.minutes, moved: false, x: e.clientX, y: e.clientY });
  };
  const onMoveP = (e) => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 5 && Math.abs(e.clientY - drag.y) < 5) return;
    const p = pointAt(e);
    const minutes = Math.round((p.minutes - drag.grabMin) / SNAP) * SNAP;
    const day = Math.max(0, Math.min(6, p.day - drag.grabDay));
    setDrag({ ...drag, day, minutes: Math.max(startH * 60, Math.min(endH * 60 - SNAP, minutes)), moved: true });
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return onOpen(d.b);
    const orig = pos(d.b);
    if (orig.day === d.day && orig.minutes === d.minutes) return;
    const to = new Date(from.getTime() + d.day * 864e5);
    to.setHours(0, d.minutes, 0, 0);
    onMove(d.b, to);
  };

  const createAt = (dayIndex) => (e) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = startH * 60 + Math.floor((((e.clientY - rect.top) / HOUR) * 60) / 30) * 30;
    const d = new Date(from.getTime() + dayIndex * 864e5);
    d.setHours(0, minutes, 0, 0);
    onCreate(d);
  };

  return (
    <div className="week-scroll">
      <div className="week">
        <div className="week-head">
          <div />
          {days.map((d, i) => (
            <div key={i} className={`week-day ${d.toDateString() === today ? 'is-today' : ''}`}>
              <span>{DAY_NAMES[i]}</span> <b>{d.getDate()}</b>
            </div>
          ))}
        </div>
        <div className="week-body">
          <div className="week-hours">
            {hours.map((h) => <div key={h} style={{ height: HOUR }}><span>{String(h).padStart(2, '0')}:00</span></div>)}
          </div>
          <div className="week-cols" ref={cols} onPointerMove={onMoveP} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
            {days.map((d, i) => (
              <div key={i} className={`week-col ${d.toDateString() === today ? 'is-today' : ''}`} style={{ height: hours.length * HOUR }}
                onClick={createAt(i)} title="Нажмите, чтобы поставить занятие">
                {d.toDateString() === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                  <div className="week-now" style={{ top: ((nowMin - startH * 60) / 60) * HOUR }} aria-hidden="true" />
                )}
              </div>
            ))}
            {blocks.map((b) => {
              const p = drag?.key === b.key ? { day: drag.day, minutes: drag.minutes } : pos(b);
              const l = b.lesson;
              const st = b.members.every((m) => m.status === 'done') ? 'done' : b.members.some((m) => m.status === 'scheduled') ? 'scheduled' : l.status;
              const start = new Date(from.getTime() + p.day * 864e5);
              start.setHours(0, p.minutes, 0, 0);
              return (
                <button key={b.key} type="button"
                  className={`week-lesson st-${st} ${b.group ? 'is-group' : ''} ${drag?.key === b.key && drag.moved ? 'dragging' : ''}`}
                  style={{
                    left: `calc(${(p.day / 7) * 100}% + 3px)`,
                    width: `calc(${100 / 7}% - 6px)`,
                    top: ((p.minutes - startH * 60) / 60) * HOUR + 1,
                    height: Math.max((l.duration_min / 60) * HOUR - 2, 22),
                  }}
                  onPointerDown={onDown(b)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(b)}
                  aria-label={`${b.group ? l.group_name : l.student_name}, ${time(start)}`}>
                  <span className="wl-time">{time(start)}</span>
                  <span className="wl-name">{b.group ? l.group_name : l.student_name.split(' ')[0]}</span>
                  {b.group && <span className="wl-sub">{b.members.length} уч.</span>}
                  {st !== 'scheduled' && <span className="wl-sub">{LESSON_STATUS[st]?.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
