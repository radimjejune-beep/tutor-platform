import { words } from './logic.js';

export const WRITING_REVIEW = [
  'Я ответил на все вопросы задания',
  'У текста есть понятное начало, основная часть и завершение',
  'Я перечитал текст и проверил формы глаголов',
  'Я проверил написание слов и знаки препинания',
];

export function writingMetrics(text, block = {}) {
  const count = words(text).length;
  const paragraphs = String(text || '').trim().split(/\n\s*\n/).filter(s => s.trim()).length;
  const target = block.min_words && block.max_words ? `${block.min_words}–${block.max_words} слов` : block.min_words ? `от ${block.min_words} слов` : block.max_words ? `до ${block.max_words} слов` : 'Объём свободный';
  const remaining = Math.max(0, (block.min_words || 0) - count);
  const excess = block.max_words ? Math.max(0, count - block.max_words) : 0;
  const message = excess ? `Сократите на ${excess} слов, чтобы уложиться в объём.` : remaining ? `До минимального объёма ещё ${remaining} слов.` : count ? 'Объём подходит. Проверьте содержание и связность текста.' : 'Начните с первой мысли — текст можно доработать.';
  return { count, paragraphs, target, remaining, excess, message };
}

// Preserve a selection and paragraph breaks when inserting a teacher's starter.
export function insertWritingStarter(text, start, end, starter) {
  const before = text.slice(0, start), after = text.slice(end);
  const phrase = String(starter).trim();
  const inserted = `${before && !/\s$/.test(before) ? ' ' : ''}${phrase}${after && !/^\s/.test(after) ? ' ' : !after ? ' ' : ''}`;
  return { text: before + inserted + after, caret: before.length + inserted.length };
}
