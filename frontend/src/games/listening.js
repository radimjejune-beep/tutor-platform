// A selection must be an actual option index; false, null and empty strings are not A.
export function listeningChoice(value, count) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return null;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && index < count ? index : null;
}
export function gradeListening(block, values) {
  return block.questions.map((question, k) => {
    const index = listeningChoice(Array.isArray(values) ? values[k] : undefined, block.options.length);
    const describe = i => `${String.fromCharCode(65 + i)} · ${block.options[i].text}`;
    return { k, ok: index === question.correct, given: index === null ? null : describe(index), expected: describe(question.correct), prompt: question.q };
  });
}
export const emptyListening = () => ({ t: 'listening', instruction: 'Listen to the recording. Choose the picture or answer for each question.', audio: null,
  options: [{ text: 'A picnic in the park', image: null }, { text: 'Dinner at a café', image: null }],
  questions: [{ q: 'What is Mia planning?', correct: 0 }, { q: 'What is Leo planning?', correct: 1 }] });
