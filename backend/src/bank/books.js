// bank/books.js — учебники и юниты банка заданий.
// Названия учебников и тем юнитов нужны только чтобы найти задания «к этому юниту».
// Тексты и упражнения учебников в банк не копируются: все задания авторские.
const BOOKS = [
  {
    id: 'solutions-elem-3',
    subject: 'Английский язык',
    title: 'Solutions Elementary, 3rd edition',
    short: 'Solutions Elementary',
    units: [
      { code: 'I', title: 'Introduction', topics: 'личная информация, be и have got, музыкальные инструменты, can, артикли, this / that' },
      { code: '1', title: 'Family and friends', topics: 'семья, Present Simple, описание людей' },
      { code: '2', title: 'School days', topics: 'распорядок дня, have to, наречия частоты, should' },
      { code: '3', title: 'Style', topics: 'одежда, Present Continuous, Present Simple и Present Continuous' },
      { code: '4', title: 'Food', topics: 'еда, исчисляемые и неисчисляемые, there is / there are, some / any, much / many' },
      { code: '5', title: 'In the city', topics: 'места в городе, сравнительная и превосходная степень, как пройти' },
      { code: '6', title: 'Going wild', topics: 'животные, Past Simple (правильные глаголы), was / were, could' },
      { code: '7', title: 'Digital world', topics: 'техника и интернет, Past Simple (неправильные глаголы, вопросы и отрицания)' },
      { code: '8', title: 'Be active!', topics: 'спорт, be going to, will' },
      { code: '9', title: 'Home sweet home!', topics: 'дом и мебель, Present Perfect, just / already / yet' },
    ],
  },
  {
    id: 'speakout-a1-3',
    subject: 'Английский язык',
    title: 'Speakout A1, 3rd edition',
    short: 'Speakout A1',
    units: [
      { code: '1', title: 'Welcome', topics: 'приветствия, страны и национальности, профессии, be (I, you, he, she, it), a / an' },
      { code: '2', title: 'People', topics: 'люди и семья, be (we, you, they), притяжательные местоимения, вопросы с be' },
      { code: '3', title: 'Things', topics: 'предметы, притяжательный \'s, have, вопросы yes / no, How much?' },
      { code: '4', title: 'Food and routines', topics: 'еда и напитки, распорядок дня, время, в кафе, Present Simple' },
      { code: '5', title: 'Action', topics: 'глаголы действия, can, просьбы и предложения, даты и месяцы' },
      { code: '6', title: 'Where?', topics: 'комнаты и мебель, места в городе, предлоги места, there is / there are' },
      { code: '7', title: 'Healthy lives', topics: 'повседневные дела, вопросы с wh- в Present Simple, was / were, части тела, как сказать, что плохо себя чувствуешь, спорт, повелительное наклонение' },
      { code: '8', title: 'Time out', topics: 'выходные и досуг, Past Simple (правильные и неправильные глаголы), транспорт и билеты, want / would like' },
    ],
  },
  {
    id: 'round-up-3',
    subject: 'Английский язык',
    title: 'Грамматика по темам, A1–A2 (темы совпадают с New Round-Up 3)',
    short: 'Грамматика A1–A2',
    grammar: true,
    units: [
      { code: '1', title: 'Plurals', topics: 'исчисляемые и неисчисляемые, множественное число' },
      { code: '2', title: 'Pronouns, be, have got, can', topics: 'личные местоимения, be, have got, can' },
      { code: '3', title: 'Possessives, demonstratives', topics: 'притяжательные, this / that / these / those' },
      { code: '4', title: 'Articles', topics: 'a / an / the' },
      { code: '5', title: 'Expressing quantity', topics: 'some / any, much / many, a few / a little' },
      { code: '6', title: 'Indefinite pronouns', topics: 'somebody, anything, nowhere' },
      { code: '7', title: 'Present Simple', topics: 'Present Simple, наречия частоты' },
      { code: '8', title: 'Present Continuous', topics: 'Present Continuous, сравнение с Present Simple' },
      { code: '9', title: 'Prepositions', topics: 'предлоги места, движения и времени' },
      { code: '10', title: 'Past Simple', topics: 'Past Simple, неправильные глаголы' },
      { code: '11', title: 'Present Perfect', topics: 'Present Perfect, ever / never / just / already / yet' },
      { code: '12', title: 'Past Continuous', topics: 'Past Continuous, сравнение с Past Simple' },
      { code: '13', title: 'The future', topics: 'will, be going to, shall' },
      { code: '14', title: 'Modal verbs', topics: 'can, must, have to, should' },
      { code: '15', title: 'Conditionals', topics: 'условные предложения 0 и 1' },
      { code: '16', title: 'Questions', topics: 'общие и специальные вопросы' },
      { code: '17', title: 'Passive', topics: 'страдательный залог' },
      { code: '18', title: 'Infinitive, -ing, too / enough', topics: 'to + глагол, -ing, too / enough' },
      { code: '19', title: 'Relative pronouns', topics: 'who / which / where' },
      { code: '20', title: 'Comparisons', topics: 'прилагательные и наречия, степени сравнения' },
    ],
  },
  {
    id: 'round-up-4',
    subject: 'Английский язык',
    title: 'Грамматика по темам, A2–B1 (темы совпадают с New Round-Up 4)',
    short: 'Грамматика A2–B1',
    grammar: true,
    units: [
      { code: '1', title: 'Present tenses', topics: 'Present Simple и Continuous, глаголы состояния' },
      { code: '2', title: 'Past Simple, Present Perfect', topics: 'Past Simple и Present Perfect, for / since' },
      { code: '3', title: 'Comparisons', topics: 'степени сравнения, as ... as, наречия' },
      { code: '4', title: 'The future', topics: 'will, be going to, Future Continuous' },
      { code: '5', title: 'Present Perfect Continuous', topics: 'Present Perfect Continuous' },
      { code: '6', title: 'Past habits', topics: 'Past Continuous, was going to, used to, be / get used to' },
      { code: '7', title: 'Pronouns', topics: 'возвратные, both / neither, притяжательные' },
      { code: '8', title: 'Past Perfect', topics: 'Past Perfect' },
      { code: '9', title: 'Modal verbs', topics: 'значения модальных глаголов' },
      { code: '10', title: 'Questions', topics: 'вопросы, вопросительные слова, разделительные вопросы' },
      { code: '11', title: 'Infinitive, gerund', topics: 'инфинитив и герундий' },
      { code: '12', title: 'Passive', topics: 'страдательный залог во всех временах' },
      { code: '13', title: 'Conditionals', topics: 'условные предложения 0–3' },
      { code: '14', title: 'Wishes', topics: 'I wish, if only' },
      { code: '15', title: 'Relatives', topics: 'относительные местоимения и придаточные' },
      { code: '16', title: 'Reported speech', topics: 'косвенная речь' },
      { code: '17', title: 'Prepositions, linking words', topics: 'предлоги, союзы и связки' },
      { code: '18', title: 'Articles', topics: 'артикли' },
    ],
  },
  {
    id: 'atanasyan-geom-7-9',
    subject: 'Математика',
    unitWord: 'глава',
    title: 'Геометрия, 7–9 классы (Атанасян и др.)',
    short: 'Геометрия 7–9',
    units: [
      { code: 'I', title: 'Начальные геометрические сведения', topics: '7 класс: отрезки, лучи, углы, смежные и вертикальные углы' },
      { code: 'II', title: 'Треугольники', topics: '7 класс: признаки равенства, медиана, биссектриса, высота, равнобедренный треугольник' },
      { code: 'III', title: 'Параллельные прямые', topics: '7 класс: признаки параллельности, углы при параллельных прямых' },
      { code: 'IV', title: 'Соотношения между сторонами и углами треугольника', topics: '7 класс: сумма углов, неравенство треугольника, прямоугольный треугольник' },
      { code: 'V', title: 'Четырёхугольники', topics: '8 класс: параллелограмм, трапеция, прямоугольник, ромб, квадрат' },
      { code: 'VI', title: 'Площадь', topics: '8 класс: площади многоугольников, теорема Пифагора' },
      { code: 'VII', title: 'Подобные треугольники', topics: '8 класс: признаки подобия, средняя линия, синус, косинус, тангенс' },
      { code: 'VIII', title: 'Окружность', topics: '8 класс: касательная, вписанный угол, вписанная и описанная окружности' },
      { code: 'IX', title: 'Векторы', topics: '9 класс: сложение и вычитание векторов, умножение на число' },
      { code: 'X', title: 'Метод координат', topics: '9 класс: координаты вектора, уравнения окружности и прямой' },
      { code: 'XI', title: 'Соотношения в треугольнике. Скалярное произведение', topics: '9 класс: теоремы синусов и косинусов, скалярное произведение' },
      { code: 'XII', title: 'Длина окружности и площадь круга', topics: '9 класс: правильные многоугольники, длина окружности, площадь круга' },
      { code: 'XIII', title: 'Движения', topics: '9 класс: симметрии, параллельный перенос, поворот' },
      { code: 'XIV', title: 'Начальные сведения из стереометрии', topics: '9 класс: многогранники, тела вращения, объёмы' },
    ],
  },
];

const bookById = (id) => BOOKS.find((b) => b.id === id) || null;
const unitOf = (bookId, code) => bookById(bookId)?.units.find((u) => u.code === code) || null;

// Какие учебники показывать репетитору: по его предмету
function bankSubject(subject) {
  const s = String(subject || 'Английский язык');
  if (/англ/i.test(s)) return 'Английский язык';
  if (/матем|геометр|алгебр/i.test(s)) return 'Математика';
  return null;
}

module.exports = { BOOKS, bookById, unitOf, bankSubject };
