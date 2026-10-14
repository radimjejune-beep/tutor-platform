// components/SubjectInput.jsx — предмет: выбрать из списка или написать свой
import { SUBJECTS } from '../subjects';

export default function SubjectInput({ value, onChange, required, placeholder = 'Начните вводить или выберите' }) {
  return (
    <>
      <input className="input" list="subject-list" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={100} />
      <datalist id="subject-list">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
    </>
  );
}
