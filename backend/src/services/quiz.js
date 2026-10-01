// services/quiz.js — вопросы теста: проверка формата, автооценка, скрытие ответов
const { z } = require('zod');

// Вопрос:
//  choice — выбор одного варианта: options ['am','is','are'], correct [1]
//  text   — вписать ответ:        correct ['went', 'did go'] (любой из вариантов засчитывается)
const questionSchema = z
  .object({
    id: z.string().trim().min(1).max(20),
    type: z.enum(['choice', 'text']),
    prompt: z.string().trim().min(1, 'Вопрос не может быть пустым').max(1000),
    options: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
    correct: z.array(z.union([z.number().int().min(0), z.string().trim().min(1).max(300)])).min(1, 'Укажите правильный ответ').max(10),
    points: z.number().int().min(1).max(10).default(1),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.type === 'choice') {
      if (q.options.length < 2) ctx.addIssue({ code: 'custom', message: 'Нужно минимум 2 варианта ответа' });
      const idx = q.correct[0];
      if (q.correct.length !== 1 || typeof idx !== 'number' || idx >= q.options.length) {
        ctx.addIssue({ code: 'custom', message: 'Отметьте один правильный вариант' });
      }
    } else if (q.correct.some((c) => typeof c !== 'string')) {
      ctx.addIssue({ code: 'custom', message: 'Правильные ответы должны быть текстом' });
    }
  });

const questionsSchema = z
  .array(questionSchema)
  .max(50)
  .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, 'Повторяются id вопросов');

// Сравнение текстовых ответов без учёта регистра, лишних пробелов, точки в конце и вида апострофа
const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?;,]+$/, '')
    .trim();

function isCorrect(q, answer) {
  if (answer === undefined || answer === null || answer === '') return false;
  if (q.type === 'choice') return Number(answer) === q.correct[0];
  const a = normalize(answer);
  return q.correct.some((c) => normalize(c) === a);
}

// Оценка: { score: % , earned, total, results: {id: true/false} }
function grade(questions, answers = {}) {
  if (!questions?.length) return null;
  let earned = 0;
  let total = 0;
  const results = {};
  for (const q of questions) {
    const ok = isCorrect(q, answers[q.id]);
    results[q.id] = ok;
    total += q.points;
    if (ok) earned += q.points;
  }
  return { score: Math.round((earned / total) * 100), earned, total, results };
}

// Для ученика до проверки — без правильных ответов
const hideAnswers = (questions) => (questions || []).map(({ correct, ...rest }) => rest);

module.exports = { questionsSchema, grade, hideAnswers, normalize };
