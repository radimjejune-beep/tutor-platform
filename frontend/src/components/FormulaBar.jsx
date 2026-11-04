// components/FormulaBar.jsx — кнопки для формул над формой: дробь, степень, корень, индексы, греческие буквы.
// Вставляют заготовку в поле, где сейчас курсор, и показывают, как формулу увидит ученик.
// Показывается только у предметов с формулами (математика, физика, химия...).
import { useEffect, useRef, useState } from 'react';
import { useSubject } from '../subjects';
import { MathText, hasMath } from './MathText';

const KEYS = [
  { label: 'a/b', title: 'Дробь', ins: '$\\frac{a}{b}$', sel: [7, 8] },
  { label: 'x²', title: 'Степень', ins: '$x^{2}$', sel: [4, 5] },
  { label: 'x₁', title: 'Нижний индекс', ins: '$x_{1}$', sel: [4, 5] },
  { label: '√', title: 'Корень', ins: '$\\sqrt{x}$', sel: [7, 8] },
  { label: 'ⁿ√', title: 'Корень степени n', ins: '$\\sqrt[3]{x}$', sel: [10, 11] },
  { label: '±', ins: '$\\pm$' }, { label: '·', ins: '$\\cdot$' }, { label: '÷', ins: '$\\div$' },
  { label: '≤', ins: '$\\le$' }, { label: '≥', ins: '$\\ge$' }, { label: '≠', ins: '$\\ne$' }, { label: '≈', ins: '$\\approx$' },
  { label: '∞', ins: '$\\infty$' }, { label: '°', ins: '$^\\circ$' },
  { label: 'π', ins: '$\\pi$' }, { label: 'α', ins: '$\\alpha$' }, { label: 'β', ins: '$\\beta$' }, { label: 'Δ', ins: '$\\Delta$' }, { label: 'λ', ins: '$\\lambda$' }, { label: 'Ω', ins: '$\\Omega$' },
  { label: '∠', ins: '$\\angle$' }, { label: '⊥', ins: '$\\perp$' }, { label: '∥', ins: '$\\parallel$' }, { label: 'a⃗', title: 'Вектор', ins: '$\\vec{a}$', sel: [6, 7] },
  { label: 'lim', ins: '$\\lim_{x \\to 0}$' }, { label: '∫', title: 'Интеграл', ins: '$\\int_{a}^{b} f(x)\\,dx$' }, { label: 'Σ', title: 'Сумма', ins: '$\\sum_{i=1}^{n}$' },
  { label: 'log', ins: '$\\log_{2} x$' }, { label: 'sin', ins: '$\\sin x$' },
  { label: 'H₂O', title: 'Химическая формула', ins: '$H_2O$' }, { label: '→', title: 'Стрелка реакции', ins: '$\\rightarrow$' }, { label: '⇄', ins: '$\\rightleftarrows$' },
];

// Записать значение в поле React так, чтобы форма это заметила
function setNative(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function FormulaBar({ subject, scope }) {
  const subj = useSubject(subject);
  const last = useRef(null);
  const [preview, setPreview] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = scope?.current || document;
    const onFocus = (e) => {
      const el = e.target;
      if ((el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el.type === 'text' || !el.type))) && !el.closest('.formula-bar')) {
        last.current = el;
        setPreview(el.value);
      }
    };
    const onInput = (e) => { if (e.target === last.current) setPreview(e.target.value); };
    root.addEventListener('focusin', onFocus);
    root.addEventListener('input', onInput);
    return () => { root.removeEventListener('focusin', onFocus); root.removeEventListener('input', onInput); };
  }, [scope]);

  if (!subj.formulas) return null;

  const insert = (k) => {
    const el = last.current;
    if (!el || !document.body.contains(el)) return;
    const a = el.selectionStart ?? el.value.length;
    const b = el.selectionEnd ?? a;
    setNative(el, el.value.slice(0, a) + k.ins + el.value.slice(b));
    el.focus();
    const [s, e] = k.sel || [k.ins.length, k.ins.length];
    requestAnimationFrame(() => el.setSelectionRange(a + s, a + e));
    setPreview(el.value);
  };

  return (
    <div className="formula-bar">
      <div className="row-between">
        <span className="small muted">Формулы: поставьте курсор в поле и нажмите кнопку. Формула пишется между знаками $</span>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(!open)}>{open ? 'Свернуть' : 'Все кнопки'}</button>
      </div>
      <div className="formula-keys">
        {(open ? KEYS : KEYS.slice(0, 14)).map((k) => (
          <button type="button" key={k.ins} title={k.title || k.ins} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(k)}>{k.label}</button>
        ))}
      </div>
      {hasMath(preview) && (
        <div className="formula-preview">
          <span className="meta-label">Так увидит ученик</span>
          <MathText as="div" subject={subject} className="instructions">{preview}</MathText>
        </div>
      )}
    </div>
  );
}
