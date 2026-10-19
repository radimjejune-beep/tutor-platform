// components/WordPaste.jsx — вставка слов списком, как импорт в Quizlet.
// Скопировали таблицу из Word, Excel, Google Таблиц или Quizlet: слово и перевод разделены Tab,
// карточки идут с новой строки. Можно выбрать другой разделитель или свой символ.
import { useEffect, useMemo, useState } from 'react';

const TERM_SEPS = [
  { k: 'auto', label: 'Сам определит' },
  { k: 'tab', label: 'Tab' },
  { k: 'dash', label: 'Тире' },
  { k: 'comma', label: 'Запятая' },
  { k: 'custom', label: 'Свой символ' },
];
const CARD_SEPS = [
  { k: 'line', label: 'Новая строка' },
  { k: 'semi', label: 'Точка с запятой' },
  { k: 'custom', label: 'Свой символ' },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Как разделены слово и перевод, если выбрано «Сам определит»
function detect(text) {
  if (text.includes('\t')) return 'tab';
  if (/\s[—–-]\s|[—–]/.test(text)) return 'dash';
  if (/=/.test(text)) return 'eq';
  return 'comma';
}

// Разобрать текст в карточки. termSep / cardSep: ключи выше, custom: свои символы
export function parseCards(text, { termSep = 'auto', cardSep = 'line', customTerm = '', customCard = '', swap = false } = {}) {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const cardRe = cardSep === 'semi' ? /;|\n/ : cardSep === 'custom' && customCard ? new RegExp(`${escapeRe(customCard)}|\\n`) : /\n/;
  const mode = termSep === 'auto' ? detect(src) : termSep;
  const out = [];
  for (const raw of src.split(cardRe)) {
    const line = raw.trim();
    if (!line) continue;
    let parts;
    if (mode === 'tab') parts = line.split('\t');
    else {
      // Делим только по первому разделителю: в переводе могут быть запятые и тире
      const re = mode === 'dash' ? /\s+[-—–]\s+|\s*[—–]\s*/ : mode === 'eq' ? /\s*=\s*/ : mode === 'comma' ? /\s*,\s*/ : customTerm ? new RegExp(`\\s*${escapeRe(customTerm)}\\s*`) : null;
      const m = re ? line.match(re) : null;
      parts = m ? [line.slice(0, m.index), line.slice(m.index + m[0].length)] : [line];
    }
    let [term = '', translation = '', ...rest] = parts.map((x) => x.trim());
    if (swap) [term, translation] = [translation, term];
    if (!term) continue;
    out.push({ term: term.slice(0, 200), translation: translation ? translation.slice(0, 300) : null, example: rest.join(' ').trim().slice(0, 1000) || null });
  }
  return out;
}

export default function WordPaste({ onWords, autoFocus, rows = 8, placeholder }) {
  const [text, setText] = useState('');
  const [termSep, setTermSep] = useState('auto');
  const [cardSep, setCardSep] = useState('line');
  const [customTerm, setCustomTerm] = useState('');
  const [customCard, setCustomCard] = useState('');
  const [swap, setSwap] = useState(false);
  const words = useMemo(() => parseCards(text, { termSep, cardSep, customTerm, customCard, swap }), [text, termSep, cardSep, customTerm, customCard, swap]);
  useEffect(() => { onWords?.(words, () => setText('')); }, [words]); // eslint-disable-line react-hooks/exhaustive-deps
  const detected = termSep === 'auto' && text ? { tab: 'Tab', dash: 'тире', comma: 'запятая', eq: 'знак =' }[detect(text)] : null;
  const noTranslation = words.filter((w) => !w.translation).length;

  return (
    <div className="paste">
      <textarea
        className="textarea paste-area"
        rows={rows}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Tab внутри поля вставляет табуляцию, а не уводит фокус
          if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const el = e.target;
            const a = el.selectionStart, b = el.selectionEnd;
            setText(text.slice(0, a) + '\t' + text.slice(b));
            requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 1; });
          }
        }}
        placeholder={placeholder || 'Вставьте список из Word, Excel, Google Таблиц или Quizlet.\n\nkeen on\tувлекаться\nproud of\tгордиться\nget on well with\tладить с\n\nМожно и так: keen on - увлекаться'}
        spellCheck={false}
      />
      <div className="paste-opts">
        <div>
          <div className="meta-label">Между словом и переводом</div>
          <div className="seg">
            {TERM_SEPS.map((o) => <button type="button" key={o.k} className={termSep === o.k ? 'on' : ''} onClick={() => setTermSep(o.k)}>{o.label}</button>)}
            {termSep === 'custom' && <input className="input paste-custom" value={customTerm} onChange={(e) => setCustomTerm(e.target.value)} placeholder="напр. :" maxLength={5} aria-label="Свой разделитель" />}
          </div>
          {detected && <div className="small muted" style={{ marginTop: 4 }}>Сейчас: {detected}</div>}
        </div>
        <div>
          <div className="meta-label">Между карточками</div>
          <div className="seg">
            {CARD_SEPS.map((o) => <button type="button" key={o.k} className={cardSep === o.k ? 'on' : ''} onClick={() => setCardSep(o.k)}>{o.label}</button>)}
            {cardSep === 'custom' && <input className="input paste-custom" value={customCard} onChange={(e) => setCustomCard(e.target.value)} placeholder="напр. |" maxLength={5} aria-label="Свой разделитель карточек" />}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} /> Сначала перевод, потом слово (поменять местами)</label>
      </div>
      {words.length > 0 && (
        <div className="paste-preview">
          <div className="row-between" style={{ marginBottom: 6 }}>
            <span className="meta-label">Получится карточек: {words.length}</span>
            {noTranslation > 0 && <span className="small" style={{ color: 'var(--danger)' }}>Без перевода: {noTranslation}. Проверьте разделитель</span>}
          </div>
          <table className="paste-table">
            <tbody>
              {words.slice(0, 6).map((w, i) => (
                <tr key={i}><td>{w.term}</td><td className={w.translation ? '' : 'muted'}>{w.translation || 'нет перевода'}</td></tr>
              ))}
            </tbody>
          </table>
          {words.length > 6 && <div className="small muted" style={{ marginTop: 4 }}>и ещё {words.length - 6}</div>}
        </div>
      )}
    </div>
  );
}
