function listeningChoice(value, count) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return null;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && index < count ? index : null;
}
function gradeListening(block, values) {
  return block.questions.map((question, k) => {
    const index = listeningChoice(Array.isArray(values) ? values[k] : undefined, block.options.length);
    const describe = i => `${String.fromCharCode(65 + i)} · ${block.options[i].text}`;
    return { k, ok: index === question.correct, given: index === null ? null : describe(index), expected: describe(question.correct), prompt: question.q };
  });
}
module.exports = { listeningChoice, gradeListening };
