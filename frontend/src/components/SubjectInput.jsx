// components/SubjectInput.jsx — предмет: выбрать из списка или написать свой
import {useId} from 'react';
import { SUBJECTS } from '../subjects';

export default function SubjectInput({ value, onChange, required, placeholder = 'Начните вводить или выберите', ...controlProps }) {
  const listId=useId();
  return (
    <>
      <input {...controlProps} className="input" list={listId} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={100} />
      <datalist id={listId}>{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
    </>
  );
}

SubjectInput.fieldControl=true;
