// bank/books.js — учебники и юниты банка заданий.
// Названия учебников и тем юнитов нужны только чтобы найти задания «к этому юниту».
// Тексты и упражнения учебников в банк не копируются: все задания авторские.
const BOOKS = [
  {
    id: 'solutions-elem-3',
    title: 'Solutions Elementary, 3rd edition',
    short: 'Solutions Elementary',
    units: [
      { code: 'I', title: 'Introduction', topics: 'личная информация, be и have got, музыкальные инструменты, can, артикли, this / that' },
      { code: '1', title: 'Family and friends', topics: 'семья, Present Simple, описание людей' },
      { code: '2', title: 'School days', topics: 'распорядок дня, have to, наречия частоты, should' },
      { code: '3', title: 'Style', topics: 'одежда, Present Continuous, Present Simple и Present Continuous' },
      { code: '4', title: 'Food', topics: 'еда, исчисляемые и неисчисляемые, there is / there are, some / any, much / many' },
      { code: '5', title: 'In the city', topics: 'места в городе, сравнительная и превосходная степень, как пройти' },
      { code: '6', title: 'Going wild', topics: 'животные и природа' },
      { code: '7', title: 'Digital world', topics: 'техника и интернет' },
      { code: '8', title: 'Be active!', topics: 'спорт и активный отдых' },
      { code: '9', title: 'Home sweet home!', topics: 'дом, комнаты, мебель' },
    ],
  },
  {
    id: 'speakout-a1-3',
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
];

const bookById = (id) => BOOKS.find((b) => b.id === id) || null;
const unitOf = (bookId, code) => bookById(bookId)?.units.find((u) => u.code === code) || null;

module.exports = { BOOKS, bookById, unitOf };
