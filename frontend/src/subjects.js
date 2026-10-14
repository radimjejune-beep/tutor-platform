// subjects.js — предметы: от предмета зависят словарь или термины, озвучка, подсказки
import { useAuth } from './auth';
import { setSpeechLang } from './components/Vocab';

// Иностранные языки: словарь «слово — перевод», карточки и озвучка
const LANGS = {
  'Английский язык': { code: 'EN', speech: 'en-GB', write: 'по-английски' },
  'Немецкий язык': { code: 'DE', speech: 'de-DE', write: 'по-немецки' },
  'Французский язык': { code: 'FR', speech: 'fr-FR', write: 'по-французски' },
  'Испанский язык': { code: 'ES', speech: 'es-ES', write: 'по-испански' },
  'Итальянский язык': { code: 'IT', speech: 'it-IT', write: 'по-итальянски' },
  'Китайский язык': { code: 'ZH', speech: 'zh-CN', write: 'по-китайски' },
  'Корейский язык': { code: 'KO', speech: 'ko-KR', write: 'по-корейски' },
  'Японский язык': { code: 'JA', speech: 'ja-JP', write: 'по-японски' },
  'Русский как иностранный': { code: 'RU', speech: 'ru-RU', write: 'по-русски' },
};

export const SUBJECTS = [
  ...Object.keys(LANGS),
  'Математика', 'Физика', 'Химия', 'Биология', 'Информатика', 'Русский язык', 'Литература',
  'История', 'Обществознание', 'География', 'Право', 'Экономика', 'Начальная школа', 'Подготовка к школе', 'Музыка', 'Рисование',
];

// Всё, что зависит от предмета, в одном месте
export function subjectInfo(name) {
  const subject = name || 'Английский язык';
  // Свой язык, которого нет в списке («Турецкий язык»): тоже словарь, но без озвучки
  const lang = LANGS[subject] || (/язык/i.test(subject) && !/^русский язык$/i.test(subject) ? { code: '', speech: null, write: 'на изучаемом языке' } : null);
  if (lang) {
    return {
      subject, isLang: true, english: subject === 'Английский язык', speech: lang.speech,
      vocabTitle: 'Словарь', item: ['слово', 'слова', 'слов'], meaning: 'перевод', Meaning: 'Перевод',
      dirs: lang.code ? [`${lang.code} → RU`, `RU → ${lang.code}`] : ['Слово → перевод', 'Перевод → слово'],
      prompts: { choose: 'Выберите перевод', type: `Напишите ${lang.write}`, gap: 'Вставьте слово в предложение', listen: 'Послушайте и выберите слово' },
      addHint: 'Слово — перевод — пример. Перевод и пример можно не писать',
      placeholders: { level: 'A2', textbook: 'Учебник, например Speakout A1', goal: 'Свободно говорить в поездках' },
    };
  }
  return {
    subject, isLang: false, english: false, speech: null,
    vocabTitle: 'Термины', item: ['термин', 'термина', 'терминов'], meaning: 'определение', Meaning: 'Определение',
    dirs: ['Термин → определение', 'Определение → термин'],
    prompts: { choose: 'Выберите определение', type: 'Напишите термин', gap: 'Вставьте термин в предложение', listen: 'Выберите термин' },
    addHint: 'Термин — определение — пример. Определение и пример можно не писать',
    placeholders: { level: '9 класс', textbook: 'Учебник или программа', goal: 'ОГЭ на 5' },
  };
}

// Предмет текущего ученика (если задан) или репетитора
export function useSubject(studentSubject) {
  const { user, students } = useAuth();
  const info = subjectInfo(studentSubject || (students?.length === 1 ? students[0].subject : null) || user?.subject);
  setSpeechLang(info.speech);
  return info;
}
