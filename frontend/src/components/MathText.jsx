// components/MathText.jsx — текст с формулами: всё между $...$ показывается как формула (KaTeX).
// $x^2$, $\frac{1}{2}$, $\sqrt{x}$, $H_2O$. Две $$ подряд: формула отдельной строкой.
// У языков формулы выключены: в тексте про цены «$5 and $10» доллары остаются долларами.
// KaTeX загружается только когда в тексте есть формула, поэтому остальные страницы не тяжелеют.
import { useEffect, useState } from 'react';
import { useSubject } from '../subjects';

let katex = null;
let loading = null;
const listeners = new Set();
function loadKatex() {
  if (!loading) {
    loading = Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([m]) => { katex = m.default || m; listeners.forEach((fn) => fn()); })
      .catch(() => { loading = null; });
  }
  return loading;
}

const MATH = /(\$\$[^$]+\$\$|\$[^$\n]+\$)/g;
export const hasMath = (text) => /\$[^$\n]+\$/.test(String(text || ''));

function render(tex, display) {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display, trust: false, strict: 'ignore', maxSize: 20, maxExpand: 300, output: 'html' });
  } catch {
    return null;
  }
}

export function MathText({ children, as: Tag = 'span', className, style, subject, force }) {
  const subj = useSubject(subject);
  const text = String(children ?? '');
  const on = (force || !subj.isLang) && hasMath(text);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on || katex) return undefined;
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    loadKatex();
    return () => listeners.delete(fn);
  }, [on]);
  if (!on || !katex) return <Tag className={className} style={style}>{text}</Tag>;
  return (
    <Tag className={className} style={style}>
      {text.split(MATH).map((part, i) => {
        const block = part.startsWith('$$') && part.endsWith('$$') && part.length > 4;
        const inline = !block && part.startsWith('$') && part.endsWith('$') && part.length > 2;
        if (!block && !inline) return part;
        const html = render(block ? part.slice(2, -2) : part.slice(1, -1), block);
        // KaTeX экранирует текст сам (trust: false), поэтому вставлять его разметку безопасно
        return html ? <span key={i} className={block ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} /> : part;
      })}
    </Tag>
  );
}

export default MathText;
