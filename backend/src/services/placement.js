// services/placement.js — короткий тест уровня английского для страницы записи
// 20 вопросов от простого к сложному (A1 → B2). Свои задания, без чужих материалов
const QUESTIONS = [
  // A1
  { q: 'My sister ___ twelve years old.', options: ['is', 'are', 'am', 'be'], a: 0 },
  { q: '___ you like football?', options: ['Do', 'Does', 'Are', 'Is'], a: 0 },
  { q: 'There ___ two apples on the table.', options: ['is', 'are', 'be', 'has'], a: 1 },
  { q: 'He ___ to school every day.', options: ['go', 'goes', 'going', 'is go'], a: 1 },
  { q: 'This is ___ book. It belongs to me.', options: ['my', 'I', 'me', 'mine'], a: 0 },
  // A2
  { q: 'Yesterday we ___ to the cinema.', options: ['go', 'goes', 'went', 'have gone'], a: 2 },
  { q: 'She is ___ than her brother.', options: ['tall', 'taller', 'tallest', 'more tall'], a: 1 },
  { q: 'Look! It ___ outside.', options: ['rains', 'is raining', 'rained', 'rain'], a: 1 },
  { q: 'I ___ a new phone next week.', options: ['buy', 'am going to buy', 'bought', 'have bought'], a: 1 },
  { q: 'You ___ wear a uniform at our school. It is a rule.', options: ['must', 'can', 'may', 'would'], a: 0 },
  // B1
  { q: 'I ___ in this city since 2019.', options: ['live', 'lived', 'have lived', 'am living'], a: 2 },
  { q: 'If it ___ tomorrow, we will stay at home.', options: ['rains', 'will rain', 'rained', 'would rain'], a: 0 },
  { q: 'The bridge ___ in 1890.', options: ['built', 'was built', 'has built', 'is building'], a: 1 },
  { q: 'He asked me where I ___.', options: ['live', 'lived', 'do live', 'am living'], a: 1 },
  { q: 'I am not used to ___ up so early.', options: ['get', 'getting', 'got', 'have got'], a: 1 },
  // B2
  { q: 'If I ___ about the problem, I would have helped you.', options: ['knew', 'had known', 'have known', 'would know'], a: 1 },
  { q: 'By the time we arrived, the film ___.', options: ['already started', 'has already started', 'had already started', 'was already starting'], a: 2 },
  { q: 'I wish I ___ more time to travel.', options: ['have', 'had', 'will have', 'would have had'], a: 1 },
  { q: 'Hardly ___ the door when the phone rang.', options: ['I had opened', 'had I opened', 'I opened', 'did I opened'], a: 1 },
  { q: 'The report needs ___ before Friday.', options: ['to finish', 'finishing', 'finish', 'be finished'], a: 1 },
];

// Вопросы без ответов — для страницы
const publicTest = () => QUESTIONS.map((x, id) => ({ id, q: x.q, options: x.options }));

// Уровень: каждая ступень засчитывается, если на ней 3 из 5 верно и пройдены все ступени ниже
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
function grade(answers = {}) {
  let score = 0;
  const perLevel = [0, 0, 0, 0];
  QUESTIONS.forEach((x, id) => {
    if (Number(answers[id]) === x.a) {
      score++;
      perLevel[Math.floor(id / 5)]++;
    }
  });
  let level = 'Starter';
  for (let i = 0; i < LEVELS.length; i++) {
    if (perLevel[i] >= 3) level = LEVELS[i];
    else break;
  }
  return { score, total: QUESTIONS.length, level };
}

module.exports = { publicTest, grade };
