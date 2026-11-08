// components/VoiceUi.jsx — транскрипция слова и выбор британского голоса
import { useEffect, useState } from 'react';
import { britishVoices, chosenVoice, setVoice, speak, transcription } from '../voice';

// /ɪkˈspensɪv/ под словом, если она есть в словаре
export function Ipa({ text, className = 'flash-ipa' }) {
  const [ipa, setIpa] = useState(null);
  useEffect(() => {
    let alive = true;
    setIpa(null);
    transcription(text).then((v) => alive && setIpa(v));
    return () => { alive = false; };
  }, [text]);
  return ipa ? <span className={className}>{ipa}</span> : null;
}

// Выбор голоса для фраз и примеров. Отдельные слова всегда звучат записью диктора, если она есть
export function VoicePicker() {
  const [list, setList] = useState(() => britishVoices());
  const [name, setName] = useState(chosenVoice());
  useEffect(() => {
    const upd = () => setList(britishVoices());
    window.speechSynthesis?.addEventListener?.('voiceschanged', upd);
    const t = setTimeout(upd, 800);
    return () => { clearTimeout(t); window.speechSynthesis?.removeEventListener?.('voiceschanged', upd); };
  }, []);
  const pick = (v) => { setName(v); setVoice(v); speak('Could you help me, please?'); };
  return (
    <div className="voice-pick">
      <label className="small muted" htmlFor="voice-sel">Голос для фраз</label>
      <select id="voice-sel" className="input" value={name} onChange={(e) => pick(e.target.value)}>
        <option value="">Лучший британский (сам выберет)</option>
        {list.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/^Microsoft |Online \(Natural\) - /g, '').replace(/ \(.*\)$/, '')}</option>)}
      </select>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => speak('expensive', 'This phone is very expensive.')}>Проверить</button>
      {!list.length && <span className="small muted">На этом устройстве нет британского голоса. Слова всё равно звучат записью диктора, а для фраз лучше открыть в Edge или Chrome.</span>}
    </div>
  );
}
