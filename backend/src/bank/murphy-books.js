// Библиографические ориентиры; заголовки разделов написаны для Lessonfold.
// Тексты и структура упражнений издателя не используются.
const MURPHY_BOOKS = [
  {
    "id": "murphy-essential-4",
    "subject": "Английский язык",
    "title": "Essential Grammar in Use, 4th edition",
    "short": "Murphy Essential · 4",
    "grammar": true,
    "level": "A1–A2",
    "edition": 4,
    "year": 2015,
    "isbn": "9781107480551",
    "reference_only": true,
    "notice": "Самостоятельные материалы Lessonfold. Название книги и номера юнитов — ориентир для поиска. Lessonfold не связан с автором или издательством.",
    "units": [
      {
        "code": "1",
        "title": "Кто я и где я: формы be",
        "grammar_key": "mu-e4-1",
        "skill_ids": [
          "be"
        ]
      },
      {
        "code": "2",
        "title": "Вопросы с am, is, are",
        "grammar_key": "mu-e4-2",
        "skill_ids": [
          "be-questions"
        ]
      },
      {
        "code": "3",
        "title": "Действие происходит сейчас",
        "grammar_key": "mu-e4-3",
        "skill_ids": [
          "present-continuous"
        ]
      },
      {
        "code": "4",
        "title": "Вопросы о происходящем сейчас",
        "grammar_key": "mu-e4-4",
        "skill_ids": [
          "continuous-questions"
        ]
      },
      {
        "code": "5",
        "title": "Привычки и ежедневные дела",
        "grammar_key": "mu-e4-5",
        "skill_ids": [
          "present-simple"
        ]
      },
      {
        "code": "6",
        "title": "Чего мы обычно не делаем",
        "grammar_key": "mu-e4-6",
        "skill_ids": [
          "simple-negatives"
        ]
      },
      {
        "code": "7",
        "title": "Как спросить о привычках",
        "grammar_key": "mu-e4-7",
        "skill_ids": [
          "simple-questions"
        ]
      },
      {
        "code": "8",
        "title": "Каждый день или сейчас",
        "grammar_key": "mu-e4-8",
        "skill_ids": [
          "simple-or-continuous"
        ]
      },
      {
        "code": "9",
        "title": "Что у человека есть",
        "grammar_key": "mu-e4-9",
        "skill_ids": [
          "have-got"
        ]
      },
      {
        "code": "10",
        "title": "Состояние и место в прошлом",
        "grammar_key": "mu-e4-10",
        "skill_ids": [
          "was-were"
        ]
      },
      {
        "code": "11",
        "title": "Что произошло вчера",
        "grammar_key": "mu-e4-11",
        "skill_ids": [
          "past-simple"
        ]
      },
      {
        "code": "12",
        "title": "Вопросы и отрицания в прошлом",
        "grammar_key": "mu-e4-12",
        "skill_ids": [
          "past-questions"
        ]
      },
      {
        "code": "13",
        "title": "Чем занимались в тот момент",
        "grammar_key": "mu-e4-13",
        "skill_ids": [
          "past-continuous"
        ]
      },
      {
        "code": "14",
        "title": "Процесс и короткое событие",
        "grammar_key": "mu-e4-14",
        "skill_ids": [
          "past-continuous",
          "past-simple"
        ]
      },
      {
        "code": "15",
        "title": "Результат, важный сейчас",
        "grammar_key": "mu-e4-15",
        "skill_ids": [
          "present-perfect"
        ]
      },
      {
        "code": "16",
        "title": "Только что, уже и ещё нет",
        "grammar_key": "mu-e4-16",
        "skill_ids": [
          "perfect-adverbs"
        ]
      },
      {
        "code": "17",
        "title": "Было ли это когда-нибудь",
        "grammar_key": "mu-e4-17",
        "skill_ids": [
          "perfect-experience"
        ]
      },
      {
        "code": "18",
        "title": "Как давно это продолжается",
        "grammar_key": "mu-e4-18",
        "skill_ids": [
          "perfect-duration"
        ]
      },
      {
        "code": "19",
        "title": "Как долго и с какого момента",
        "grammar_key": "mu-e4-19",
        "skill_ids": [
          "for-since"
        ]
      },
      {
        "code": "20",
        "title": "Опыт и конкретный момент прошлого",
        "grammar_key": "mu-e4-20",
        "skill_ids": [
          "perfect-or-past"
        ]
      },
      {
        "code": "21",
        "title": "Кто-то делает это с предметом",
        "grammar_key": "mu-e4-21",
        "skill_ids": [
          "passive"
        ]
      },
      {
        "code": "22",
        "title": "Процесс и результат в пассиве",
        "grammar_key": "mu-e4-22",
        "skill_ids": [
          "passive-forms"
        ]
      },
      {
        "code": "23",
        "title": "Выбираем be, have или do",
        "grammar_key": "mu-e4-23",
        "skill_ids": [
          "auxiliary-forms"
        ]
      },
      {
        "code": "24",
        "title": "Правильные и неправильные формы",
        "grammar_key": "mu-e4-24",
        "skill_ids": [
          "verb-forms"
        ]
      },
      {
        "code": "25",
        "title": "Договорённости на завтра",
        "grammar_key": "mu-e4-25",
        "skill_ids": [
          "future-arrangements"
        ]
      },
      {
        "code": "26",
        "title": "Что мы собираемся делать",
        "grammar_key": "mu-e4-26",
        "skill_ids": [
          "going-to"
        ]
      },
      {
        "code": "27",
        "title": "Решение и предложение помощи",
        "grammar_key": "mu-e4-27",
        "skill_ids": [
          "future-will"
        ]
      },
      {
        "code": "28",
        "title": "Будущие факты и обещания",
        "grammar_key": "mu-e4-28",
        "skill_ids": [
          "will-predictions"
        ]
      },
      {
        "code": "29",
        "title": "Что, возможно, случится",
        "grammar_key": "mu-e4-29",
        "skill_ids": [
          "may-might"
        ]
      },
      {
        "code": "30",
        "title": "Что мы умеем и умели",
        "grammar_key": "mu-e4-30",
        "skill_ids": [
          "can-could"
        ]
      },
      {
        "code": "31",
        "title": "Что надо, нельзя и необязательно",
        "grammar_key": "mu-e4-31",
        "skill_ids": [
          "must-have-to"
        ]
      },
      {
        "code": "32",
        "title": "Как дать полезный совет",
        "grammar_key": "mu-e4-32",
        "skill_ids": [
          "should"
        ]
      },
      {
        "code": "33",
        "title": "Обязанности и вопросы о них",
        "grammar_key": "mu-e4-33",
        "skill_ids": [
          "have-to-basic"
        ]
      },
      {
        "code": "34",
        "title": "Как предложить и попросить",
        "grammar_key": "mu-e4-34",
        "skill_ids": [
          "like-would-like"
        ]
      },
      {
        "code": "35",
        "title": "Инструкции и совместные предложения",
        "grammar_key": "mu-e4-35",
        "skill_ids": [
          "imperative",
          "lets"
        ]
      },
      {
        "code": "36",
        "title": "Как было раньше",
        "grammar_key": "mu-e4-36",
        "skill_ids": [
          "used-to"
        ]
      },
      {
        "code": "37",
        "title": "Что есть в комнате или городе",
        "grammar_key": "mu-e4-37",
        "skill_ids": [
          "there-is"
        ]
      },
      {
        "code": "38",
        "title": "Наличие в прошлом и будущем",
        "grammar_key": "mu-e4-38",
        "skill_ids": [
          "there-tenses"
        ]
      },
      {
        "code": "39",
        "title": "Погода, время и расстояние",
        "grammar_key": "mu-e4-39",
        "skill_ids": [
          "impersonal-it"
        ]
      },
      {
        "code": "40",
        "title": "Короткие ответы без повторения",
        "grammar_key": "mu-e4-40",
        "skill_ids": [
          "auxiliary-verbs"
        ]
      },
      {
        "code": "41",
        "title": "Как показать интерес вопросом",
        "grammar_key": "mu-e4-41",
        "skill_ids": [
          "echo-questions"
        ]
      },
      {
        "code": "42",
        "title": "Как сказать «я тоже»",
        "grammar_key": "mu-e4-42",
        "skill_ids": [
          "so-neither"
        ]
      },
      {
        "code": "43",
        "title": "Как построить отрицание",
        "grammar_key": "mu-e4-43",
        "skill_ids": [
          "negative-forms"
        ]
      },
      {
        "code": "44",
        "title": "Как задать общий вопрос",
        "grammar_key": "mu-e4-44",
        "skill_ids": [
          "questions"
        ]
      },
      {
        "code": "45",
        "title": "Кто сделал и кого увидели",
        "grammar_key": "mu-e4-45",
        "skill_ids": [
          "subject-questions"
        ]
      },
      {
        "code": "46",
        "title": "О ком и с кем спрашиваем",
        "grammar_key": "mu-e4-46",
        "skill_ids": [
          "question-prepositions"
        ]
      },
      {
        "code": "47",
        "title": "Выбираем вопросительное слово",
        "grammar_key": "mu-e4-47",
        "skill_ids": [
          "which-how"
        ]
      },
      {
        "code": "48",
        "title": "Сколько времени занимает действие",
        "grammar_key": "mu-e4-48",
        "skill_ids": [
          "take-time"
        ]
      },
      {
        "code": "49",
        "title": "Как вежливо спросить дорогу",
        "grammar_key": "mu-e4-49",
        "skill_ids": [
          "indirect-questions"
        ]
      },
      {
        "code": "50",
        "title": "Как передать чужие слова",
        "grammar_key": "mu-e4-50",
        "skill_ids": [
          "reported-speech"
        ]
      },
      {
        "code": "51",
        "title": "Начальная форма, to и -ing",
        "grammar_key": "mu-e4-51",
        "skill_ids": [
          "basic-verb-forms"
        ]
      },
      {
        "code": "52",
        "title": "Хочу сделать и люблю делать",
        "grammar_key": "mu-e4-52",
        "skill_ids": [
          "gerund-infinitive"
        ]
      },
      {
        "code": "53",
        "title": "Хочу, чтобы кто-то сделал",
        "grammar_key": "mu-e4-53",
        "skill_ids": [
          "object-infinitive"
        ]
      },
      {
        "code": "54",
        "title": "Зачем выполняется действие",
        "grammar_key": "mu-e4-54",
        "skill_ids": [
          "purpose"
        ]
      },
      {
        "code": "55",
        "title": "Куда пойти и чем заняться",
        "grammar_key": "mu-e4-55",
        "skill_ids": [
          "go-patterns"
        ]
      },
      {
        "code": "56",
        "title": "Значения get в повседневной речи",
        "grammar_key": "mu-e4-56",
        "skill_ids": [
          "get-patterns"
        ]
      },
      {
        "code": "57",
        "title": "Делаем работу и создаём результат",
        "grammar_key": "mu-e4-57",
        "skill_ids": [
          "do-make"
        ]
      },
      {
        "code": "58",
        "title": "Действия с have",
        "grammar_key": "mu-e4-58",
        "skill_ids": [
          "have-expressions"
        ]
      },
      {
        "code": "59",
        "title": "Кто делает и кому помогают",
        "grammar_key": "mu-e4-59",
        "skill_ids": [
          "pronouns"
        ]
      },
      {
        "code": "60",
        "title": "Чей предмет: my, his, their",
        "grammar_key": "mu-e4-60",
        "skill_ids": [
          "possessive-adjectives"
        ]
      },
      {
        "code": "61",
        "title": "Чей это предмет без повторения названия",
        "grammar_key": "mu-e4-61",
        "skill_ids": [
          "possessive-pronouns"
        ]
      },
      {
        "code": "62",
        "title": "Различаем I, me, my и mine",
        "grammar_key": "mu-e4-62",
        "skill_ids": [
          "pronouns",
          "possessives"
        ]
      },
      {
        "code": "63",
        "title": "Сделать что-то самому",
        "grammar_key": "mu-e4-63",
        "skill_ids": [
          "reflexives"
        ]
      },
      {
        "code": "64",
        "title": "Кому принадлежит вещь",
        "grammar_key": "mu-e4-64",
        "skill_ids": [
          "possessive-case"
        ]
      },
      {
        "code": "65",
        "title": "Один предмет и профессия",
        "grammar_key": "mu-e4-65",
        "skill_ids": [
          "indefinite-article"
        ]
      },
      {
        "code": "66",
        "title": "Один и несколько",
        "grammar_key": "mu-e4-66",
        "skill_ids": [
          "plurals"
        ]
      },
      {
        "code": "67",
        "title": "Предметы и вещества",
        "grammar_key": "mu-e4-67",
        "skill_ids": [
          "countable"
        ]
      },
      {
        "code": "68",
        "title": "Порция и вещество",
        "grammar_key": "mu-e4-68",
        "skill_ids": [
          "mass-context"
        ]
      },
      {
        "code": "69",
        "title": "Первое и повторное упоминание",
        "grammar_key": "mu-e4-69",
        "skill_ids": [
          "articles"
        ]
      },
      {
        "code": "70",
        "title": "Когда понятно, какой именно предмет",
        "grammar_key": "mu-e4-70",
        "skill_ids": [
          "specific-the"
        ]
      },
      {
        "code": "71",
        "title": "На работу, домой и в кино",
        "grammar_key": "mu-e4-71",
        "skill_ids": [
          "institution-articles"
        ]
      },
      {
        "code": "72",
        "title": "Говорим о вещах в целом",
        "grammar_key": "mu-e4-72",
        "skill_ids": [
          "general-nouns"
        ]
      },
      {
        "code": "73",
        "title": "Названия мест и артикли",
        "grammar_key": "mu-e4-73",
        "skill_ids": [
          "geographic-articles"
        ]
      },
      {
        "code": "74",
        "title": "Этот, тот, эти и те",
        "grammar_key": "mu-e4-74",
        "skill_ids": [
          "demonstratives"
        ]
      },
      {
        "code": "75",
        "title": "Как не повторять существительное",
        "grammar_key": "mu-e4-75",
        "skill_ids": [
          "one-ones"
        ]
      },
      {
        "code": "76",
        "title": "Немного и сколько-нибудь",
        "grammar_key": "mu-e4-76",
        "skill_ids": [
          "some-any"
        ]
      },
      {
        "code": "77",
        "title": "Как сказать, что ничего нет",
        "grammar_key": "mu-e4-77",
        "skill_ids": [
          "no-none"
        ]
      },
      {
        "code": "78",
        "title": "Никто и ничего",
        "grammar_key": "mu-e4-78",
        "skill_ids": [
          "negative-pronouns"
        ]
      },
      {
        "code": "79",
        "title": "Кто-то, что-нибудь и где-то",
        "grammar_key": "mu-e4-79",
        "skill_ids": [
          "indefinite-pronouns"
        ]
      },
      {
        "code": "80",
        "title": "Все люди и каждый человек",
        "grammar_key": "mu-e4-80",
        "skill_ids": [
          "all-every-whole"
        ]
      },
      {
        "code": "81",
        "title": "Вся группа, большинство и часть",
        "grammar_key": "mu-e4-81",
        "skill_ids": [
          "quantifier-of"
        ]
      },
      {
        "code": "82",
        "title": "Два предмета и выбор между ними",
        "grammar_key": "mu-e4-82",
        "skill_ids": [
          "both-either"
        ]
      },
      {
        "code": "83",
        "title": "Много и сколько",
        "grammar_key": "mu-e4-83",
        "skill_ids": [
          "quantity"
        ]
      },
      {
        "code": "84",
        "title": "Немного и слишком мало",
        "grammar_key": "mu-e4-84",
        "skill_ids": [
          "few-little"
        ]
      },
      {
        "code": "85",
        "title": "Как описывать предмет",
        "grammar_key": "mu-e4-85",
        "skill_ids": [
          "adjective-order"
        ]
      },
      {
        "code": "86",
        "title": "Как выполняется действие",
        "grammar_key": "mu-e4-86",
        "skill_ids": [
          "adverbs"
        ]
      },
      {
        "code": "87",
        "title": "Выше, дешевле и интереснее",
        "grammar_key": "mu-e4-87",
        "skill_ids": [
          "comparisons"
        ]
      },
      {
        "code": "88",
        "title": "Сравнение с than",
        "grammar_key": "mu-e4-88",
        "skill_ids": [
          "comparative-modifiers"
        ]
      },
      {
        "code": "89",
        "title": "Такой же или не такой",
        "grammar_key": "mu-e4-89",
        "skill_ids": [
          "as-comparisons"
        ]
      },
      {
        "code": "90",
        "title": "Выбираем самый подходящий",
        "grammar_key": "mu-e4-90",
        "skill_ids": [
          "superlatives"
        ]
      },
      {
        "code": "91",
        "title": "Достаточное количество и степень",
        "grammar_key": "mu-e4-91",
        "skill_ids": [
          "enough"
        ]
      },
      {
        "code": "92",
        "title": "Слишком много и слишком сильно",
        "grammar_key": "mu-e4-92",
        "skill_ids": [
          "too"
        ]
      },
      {
        "code": "93",
        "title": "Порядок слов в обычной фразе",
        "grammar_key": "mu-e4-93",
        "skill_ids": [
          "word-order"
        ]
      },
      {
        "code": "94",
        "title": "Как часто и где поставить наречие",
        "grammar_key": "mu-e4-94",
        "skill_ids": [
          "frequency"
        ]
      },
      {
        "code": "95",
        "title": "Всё ещё, уже и пока нет",
        "grammar_key": "mu-e4-95",
        "skill_ids": [
          "still-yet"
        ]
      },
      {
        "code": "96",
        "title": "Кому дать и как это сказать",
        "grammar_key": "mu-e4-96",
        "skill_ids": [
          "double-object"
        ]
      },
      {
        "code": "97",
        "title": "Связываем мысли",
        "grammar_key": "mu-e4-97",
        "skill_ids": [
          "linkers"
        ]
      },
      {
        "code": "98",
        "title": "Когда произойдёт другое действие",
        "grammar_key": "mu-e4-98",
        "skill_ids": [
          "future-time-clauses"
        ]
      },
      {
        "code": "99",
        "title": "Если это случится",
        "grammar_key": "mu-e4-99",
        "skill_ids": [
          "conditionals"
        ]
      },
      {
        "code": "100",
        "title": "Если бы ситуация была другой",
        "grammar_key": "mu-e4-100",
        "skill_ids": [
          "second-conditional"
        ]
      },
      {
        "code": "101",
        "title": "Уточняем человека или предмет",
        "grammar_key": "mu-e4-101",
        "skill_ids": [
          "relative-clauses"
        ]
      },
      {
        "code": "102",
        "title": "Кого встретили и где остановились",
        "grammar_key": "mu-e4-102",
        "skill_ids": [
          "relative-omission"
        ]
      },
      {
        "code": "103",
        "title": "В час, в день и в месяц",
        "grammar_key": "mu-e4-103",
        "skill_ids": [
          "time-prepositions"
        ]
      },
      {
        "code": "104",
        "title": "От начала до конца периода",
        "grammar_key": "mu-e4-104",
        "skill_ids": [
          "time-ranges"
        ]
      },
      {
        "code": "105",
        "title": "До, после и во время",
        "grammar_key": "mu-e4-105",
        "skill_ids": [
          "during-while"
        ]
      },
      {
        "code": "106",
        "title": "Внутри, на поверхности и рядом",
        "grammar_key": "mu-e4-106",
        "skill_ids": [
          "place-prepositions"
        ]
      },
      {
        "code": "107",
        "title": "В школе, по адресу и на встрече",
        "grammar_key": "mu-e4-107",
        "skill_ids": [
          "at-places"
        ]
      },
      {
        "code": "108",
        "title": "Куда направляемся",
        "grammar_key": "mu-e4-108",
        "skill_ids": [
          "movement-to"
        ]
      },
      {
        "code": "109",
        "title": "Под, за и напротив",
        "grammar_key": "mu-e4-109",
        "skill_ids": [
          "place-prepositions"
        ]
      },
      {
        "code": "110",
        "title": "Через, над и вдоль",
        "grammar_key": "mu-e4-110",
        "skill_ids": [
          "movement-prepositions"
        ]
      },
      {
        "code": "111",
        "title": "Частые сочетания с предлогами",
        "grammar_key": "mu-e4-111",
        "skill_ids": [
          "preposition-expressions"
        ]
      },
      {
        "code": "112",
        "title": "Предлог после прилагательного",
        "grammar_key": "mu-e4-112",
        "skill_ids": [
          "preposition-ing",
          "adjective-prepositions-2"
        ]
      },
      {
        "code": "113",
        "title": "Предлог после глагола",
        "grammar_key": "mu-e4-113",
        "skill_ids": [
          "verb-prepositions-to-at"
        ]
      },
      {
        "code": "114",
        "title": "Глагол и короткая частица",
        "grammar_key": "mu-e4-114",
        "skill_ids": [
          "phrasal-intro"
        ]
      },
      {
        "code": "115",
        "title": "Куда поставить дополнение",
        "grammar_key": "mu-e4-115",
        "skill_ids": [
          "phrasal-object"
        ]
      }
    ]
  },
  {
    "id": "murphy-english-5",
    "subject": "Английский язык",
    "title": "English Grammar in Use, 5th edition",
    "short": "Murphy English · 5",
    "grammar": true,
    "level": "A2–B2",
    "edition": 5,
    "year": 2019,
    "isbn": "9781108457651",
    "reference_only": true,
    "notice": "Самостоятельные материалы Lessonfold. Название книги и номера юнитов — ориентир для поиска. Lessonfold не связан с автором или издательством.",
    "units": [
      {
        "code": "1",
        "title": "Действия сейчас и временные ситуации",
        "grammar_key": "mu-i5-1",
        "skill_ids": [
          "present-continuous"
        ]
      },
      {
        "code": "2",
        "title": "Привычки и постоянные факты",
        "grammar_key": "mu-i5-2",
        "skill_ids": [
          "present-simple"
        ]
      },
      {
        "code": "3",
        "title": "Обычно или в данный момент",
        "grammar_key": "mu-i5-3",
        "skill_ids": [
          "simple-or-continuous"
        ]
      },
      {
        "code": "4",
        "title": "Состояния и меняющееся значение глагола",
        "grammar_key": "mu-i5-4",
        "skill_ids": [
          "stative-verbs"
        ]
      },
      {
        "code": "5",
        "title": "Завершённые события прошлого",
        "grammar_key": "mu-i5-5",
        "skill_ids": [
          "past-simple"
        ]
      },
      {
        "code": "6",
        "title": "Процесс в определённый момент прошлого",
        "grammar_key": "mu-i5-6",
        "skill_ids": [
          "past-continuous"
        ]
      },
      {
        "code": "7",
        "title": "Опыт и результат к настоящему",
        "grammar_key": "mu-i5-7",
        "skill_ids": [
          "present-perfect"
        ]
      },
      {
        "code": "8",
        "title": "Недавний результат: just, already, yet",
        "grammar_key": "mu-i5-8",
        "skill_ids": [
          "perfect-adverbs"
        ]
      },
      {
        "code": "9",
        "title": "Длительность процесса до настоящего",
        "grammar_key": "mu-i5-9",
        "skill_ids": [
          "perfect-continuous"
        ]
      },
      {
        "code": "10",
        "title": "Результат и процесс: два Perfect",
        "grammar_key": "mu-i5-10",
        "skill_ids": [
          "perfect-result-process"
        ]
      },
      {
        "code": "11",
        "title": "Как давно продолжается ситуация",
        "grammar_key": "mu-i5-11",
        "skill_ids": [
          "perfect-duration"
        ]
      },
      {
        "code": "12",
        "title": "Период и начало отсчёта",
        "grammar_key": "mu-i5-12",
        "skill_ids": [
          "for-since"
        ]
      },
      {
        "code": "13",
        "title": "Опыт или событие с точной датой",
        "grammar_key": "mu-i5-13",
        "skill_ids": [
          "perfect-or-past"
        ]
      },
      {
        "code": "14",
        "title": "Завершённое и незавершённое время",
        "grammar_key": "mu-i5-14",
        "skill_ids": [
          "perfect-time-context"
        ]
      },
      {
        "code": "15",
        "title": "Событие раньше другого прошлого",
        "grammar_key": "mu-i5-15",
        "skill_ids": [
          "past-perfect"
        ]
      },
      {
        "code": "16",
        "title": "Длительный процесс перед событием",
        "grammar_key": "mu-i5-16",
        "skill_ids": [
          "past-perfect-continuous"
        ]
      },
      {
        "code": "17",
        "title": "Владение и действия с have",
        "grammar_key": "mu-i5-17",
        "skill_ids": [
          "have-got",
          "have-expressions"
        ]
      },
      {
        "code": "18",
        "title": "Привычки и состояния, которые изменились",
        "grammar_key": "mu-i5-18",
        "skill_ids": [
          "used-to"
        ]
      },
      {
        "code": "19",
        "title": "Будущие встречи и расписания",
        "grammar_key": "mu-i5-19",
        "skill_ids": [
          "future-arrangements"
        ]
      },
      {
        "code": "20",
        "title": "Намерения и видимые признаки",
        "grammar_key": "mu-i5-20",
        "skill_ids": [
          "going-to"
        ]
      },
      {
        "code": "21",
        "title": "Решение сейчас и предложение помощи",
        "grammar_key": "mu-i5-21",
        "skill_ids": [
          "future-will"
        ]
      },
      {
        "code": "22",
        "title": "Прогнозы, обещания и будущие факты",
        "grammar_key": "mu-i5-22",
        "skill_ids": [
          "will-predictions"
        ]
      },
      {
        "code": "23",
        "title": "Выбор способа говорить о будущем",
        "grammar_key": "mu-i5-23",
        "skill_ids": [
          "future-arrangements"
        ]
      },
      {
        "code": "24",
        "title": "Процесс и завершение к моменту будущего",
        "grammar_key": "mu-i5-24",
        "skill_ids": [
          "future-continuous",
          "future-perfect"
        ]
      },
      {
        "code": "25",
        "title": "Будущее в предложениях с when и if",
        "grammar_key": "mu-i5-25",
        "skill_ids": [
          "future-time-clauses"
        ]
      },
      {
        "code": "26",
        "title": "Умение и возможность в разных временах",
        "grammar_key": "mu-i5-26",
        "skill_ids": [
          "can-could",
          "be-able"
        ]
      },
      {
        "code": "27",
        "title": "Возможности, которые остались в прошлом",
        "grammar_key": "mu-i5-27",
        "skill_ids": [
          "could-have"
        ]
      },
      {
        "code": "28",
        "title": "Логические выводы: must и can't",
        "grammar_key": "mu-i5-28",
        "skill_ids": [
          "modal-deduction"
        ]
      },
      {
        "code": "29",
        "title": "Неуверенные предположения",
        "grammar_key": "mu-i5-29",
        "skill_ids": [
          "may-might"
        ]
      },
      {
        "code": "30",
        "title": "Возможный процесс и осторожные планы",
        "grammar_key": "mu-i5-30",
        "skill_ids": [
          "might-forms"
        ]
      },
      {
        "code": "31",
        "title": "Обязанности из правил и ситуации",
        "grammar_key": "mu-i5-31",
        "skill_ids": [
          "must-have-to"
        ]
      },
      {
        "code": "32",
        "title": "Запрет и отсутствие необходимости",
        "grammar_key": "mu-i5-32",
        "skill_ids": [
          "neednt"
        ]
      },
      {
        "code": "33",
        "title": "Как дать совет",
        "grammar_key": "mu-i5-33",
        "skill_ids": [
          "should"
        ]
      },
      {
        "code": "34",
        "title": "Советы и оценка действий в прошлом",
        "grammar_key": "mu-i5-34",
        "skill_ids": [
          "should-have"
        ]
      },
      {
        "code": "35",
        "title": "Предупреждение и время действовать",
        "grammar_key": "mu-i5-35",
        "skill_ids": [
          "had-better"
        ]
      },
      {
        "code": "36",
        "title": "Воображаемый результат и привычки прошлого",
        "grammar_key": "mu-i5-36",
        "skill_ids": [
          "would"
        ]
      },
      {
        "code": "37",
        "title": "Вежливые просьбы и предложения",
        "grammar_key": "mu-i5-37",
        "skill_ids": [
          "requests-offers"
        ]
      },
      {
        "code": "38",
        "title": "Реальная и воображаемая ситуация",
        "grammar_key": "mu-i5-38",
        "skill_ids": [
          "conditionals",
          "second-conditional"
        ]
      },
      {
        "code": "39",
        "title": "Нереальные условия и пожелания",
        "grammar_key": "mu-i5-39",
        "skill_ids": [
          "second-conditional",
          "wish-present"
        ]
      },
      {
        "code": "40",
        "title": "Другой исход уже случившегося",
        "grammar_key": "mu-i5-40",
        "skill_ids": [
          "third-conditional"
        ]
      },
      {
        "code": "41",
        "title": "Пожелания и сожаления",
        "grammar_key": "mu-i5-41",
        "skill_ids": [
          "wish"
        ]
      },
      {
        "code": "42",
        "title": "Действие в центре внимания",
        "grammar_key": "mu-i5-42",
        "skill_ids": [
          "passive"
        ]
      },
      {
        "code": "43",
        "title": "Страдательные формы разных времён",
        "grammar_key": "mu-i5-43",
        "skill_ids": [
          "passive-forms"
        ]
      },
      {
        "code": "44",
        "title": "Два объекта и особые конструкции пассива",
        "grammar_key": "mu-i5-44",
        "skill_ids": [
          "passive-patterns"
        ]
      },
      {
        "code": "45",
        "title": "Как передавать общие сообщения",
        "grammar_key": "mu-i5-45",
        "skill_ids": [
          "reporting-passive"
        ]
      },
      {
        "code": "46",
        "title": "Услуга, которую выполняют для нас",
        "grammar_key": "mu-i5-46",
        "skill_ids": [
          "have-something-done"
        ]
      },
      {
        "code": "47",
        "title": "Передача чужих слов",
        "grammar_key": "mu-i5-47",
        "skill_ids": [
          "reported-speech"
        ]
      },
      {
        "code": "48",
        "title": "Передача вопросов и просьб",
        "grammar_key": "mu-i5-48",
        "skill_ids": [
          "reported-questions"
        ]
      },
      {
        "code": "49",
        "title": "Как построить прямой вопрос",
        "grammar_key": "mu-i5-49",
        "skill_ids": [
          "questions",
          "subject-questions"
        ]
      },
      {
        "code": "50",
        "title": "Вопрос внутри другого предложения",
        "grammar_key": "mu-i5-50",
        "skill_ids": [
          "indirect-questions"
        ]
      },
      {
        "code": "51",
        "title": "Короткие ответы и вспомогательные глаголы",
        "grammar_key": "mu-i5-51",
        "skill_ids": [
          "auxiliary-verbs"
        ]
      },
      {
        "code": "52",
        "title": "Как переспросить и подтвердить",
        "grammar_key": "mu-i5-52",
        "skill_ids": [
          "question-tags"
        ]
      },
      {
        "code": "53",
        "title": "Глаголы, требующие -ing",
        "grammar_key": "mu-i5-53",
        "skill_ids": [
          "gerund-infinitive"
        ]
      },
      {
        "code": "54",
        "title": "Глаголы с to-инфинитивом",
        "grammar_key": "mu-i5-54",
        "skill_ids": [
          "verb-infinitive"
        ]
      },
      {
        "code": "55",
        "title": "Кто должен выполнить действие",
        "grammar_key": "mu-i5-55",
        "skill_ids": [
          "object-infinitive"
        ]
      },
      {
        "code": "56",
        "title": "Меняется форма — меняется смысл",
        "grammar_key": "mu-i5-56",
        "skill_ids": [
          "remember-stop"
        ]
      },
      {
        "code": "57",
        "title": "Попытка, необходимость и помощь",
        "grammar_key": "mu-i5-57",
        "skill_ids": [
          "try-need-help"
        ]
      },
      {
        "code": "58",
        "title": "Удовольствие и конкретное желание",
        "grammar_key": "mu-i5-58",
        "skill_ids": [
          "like-would-like"
        ]
      },
      {
        "code": "59",
        "title": "Как выразить предпочтение",
        "grammar_key": "mu-i5-59",
        "skill_ids": [
          "prefer-rather"
        ]
      },
      {
        "code": "60",
        "title": "Форма глагола после предлога",
        "grammar_key": "mu-i5-60",
        "skill_ids": [
          "preposition-ing"
        ]
      },
      {
        "code": "61",
        "title": "Привычная ситуация и привыкание",
        "grammar_key": "mu-i5-61",
        "skill_ids": [
          "be-used-to"
        ]
      },
      {
        "code": "62",
        "title": "Устойчивые сочетания перед -ing",
        "grammar_key": "mu-i5-62",
        "skill_ids": [
          "verb-preposition-ing"
        ]
      },
      {
        "code": "63",
        "title": "Стоит ли делать и есть ли смысл",
        "grammar_key": "mu-i5-63",
        "skill_ids": [
          "worth-point"
        ]
      },
      {
        "code": "64",
        "title": "Как объяснить цель действия",
        "grammar_key": "mu-i5-64",
        "skill_ids": [
          "purpose"
        ]
      },
      {
        "code": "65",
        "title": "Оценка действия через прилагательное",
        "grammar_key": "mu-i5-65",
        "skill_ids": [
          "adjective-infinitive"
        ]
      },
      {
        "code": "66",
        "title": "Решиться на действие и бояться последствий",
        "grammar_key": "mu-i5-66",
        "skill_ids": [
          "afraid-to-of"
        ]
      },
      {
        "code": "67",
        "title": "Видеть действие целиком или в процессе",
        "grammar_key": "mu-i5-67",
        "skill_ids": [
          "perception-verbs"
        ]
      },
      {
        "code": "68",
        "title": "Как кратко связать два действия",
        "grammar_key": "mu-i5-68",
        "skill_ids": [
          "participle-clauses"
        ]
      },
      {
        "code": "69",
        "title": "Что можно посчитать поштучно",
        "grammar_key": "mu-i5-69",
        "skill_ids": [
          "countable"
        ]
      },
      {
        "code": "70",
        "title": "Когда у существительного меняется значение",
        "grammar_key": "mu-i5-70",
        "skill_ids": [
          "mass-context"
        ]
      },
      {
        "code": "71",
        "title": "Один предмет, профессия и количество",
        "grammar_key": "mu-i5-71",
        "skill_ids": [
          "indefinite-article"
        ]
      },
      {
        "code": "72",
        "title": "Вводим предмет и возвращаемся к нему",
        "grammar_key": "mu-i5-72",
        "skill_ids": [
          "articles"
        ]
      },
      {
        "code": "73",
        "title": "Как собеседник понимает, о чём речь",
        "grammar_key": "mu-i5-73",
        "skill_ids": [
          "specific-the"
        ]
      },
      {
        "code": "74",
        "title": "Учреждение как место и как деятельность",
        "grammar_key": "mu-i5-74",
        "skill_ids": [
          "institution-articles"
        ]
      },
      {
        "code": "75",
        "title": "Обобщения о людях и предметах",
        "grammar_key": "mu-i5-75",
        "skill_ids": [
          "general-nouns"
        ]
      },
      {
        "code": "76",
        "title": "Виды, изобретения и группы людей",
        "grammar_key": "mu-i5-76",
        "skill_ids": [
          "generic-groups"
        ]
      },
      {
        "code": "77",
        "title": "Артикли с географическими названиями",
        "grammar_key": "mu-i5-77",
        "skill_ids": [
          "geographic-articles"
        ]
      },
      {
        "code": "78",
        "title": "Названия зданий и организаций",
        "grammar_key": "mu-i5-78",
        "skill_ids": [
          "name-articles"
        ]
      },
      {
        "code": "79",
        "title": "Согласование единственного и множественного",
        "grammar_key": "mu-i5-79",
        "skill_ids": [
          "plurals"
        ]
      },
      {
        "code": "80",
        "title": "Существительное перед существительным",
        "grammar_key": "mu-i5-80",
        "skill_ids": [
          "noun-compounds"
        ]
      },
      {
        "code": "81",
        "title": "Как выразить принадлежность",
        "grammar_key": "mu-i5-81",
        "skill_ids": [
          "possessives"
        ]
      },
      {
        "code": "82",
        "title": "Действие на себя и самостоятельность",
        "grammar_key": "mu-i5-82",
        "skill_ids": [
          "reflexives"
        ]
      },
      {
        "code": "83",
        "title": "Мой собственный и один из моих",
        "grammar_key": "mu-i5-83",
        "skill_ids": [
          "own-mine"
        ]
      },
      {
        "code": "84",
        "title": "Сообщить о наличии или описать ситуацию",
        "grammar_key": "mu-i5-84",
        "skill_ids": [
          "there-it"
        ]
      },
      {
        "code": "85",
        "title": "Неопределённое количество и выбор",
        "grammar_key": "mu-i5-85",
        "skill_ids": [
          "some-any"
        ]
      },
      {
        "code": "86",
        "title": "Как выразить отсутствие",
        "grammar_key": "mu-i5-86",
        "skill_ids": [
          "no-none"
        ]
      },
      {
        "code": "87",
        "title": "Выбираем выражение количества",
        "grammar_key": "mu-i5-87",
        "skill_ids": [
          "countable",
          "quantity"
        ]
      },
      {
        "code": "88",
        "title": "Все, большинство и часть группы",
        "grammar_key": "mu-i5-88",
        "skill_ids": [
          "quantifier-of"
        ]
      },
      {
        "code": "89",
        "title": "Два объекта: оба, любой, ни один",
        "grammar_key": "mu-i5-89",
        "skill_ids": [
          "both-either"
        ]
      },
      {
        "code": "90",
        "title": "Вся группа и целый объект",
        "grammar_key": "mu-i5-90",
        "skill_ids": [
          "all-every-whole"
        ]
      },
      {
        "code": "91",
        "title": "Каждый по отдельности и каждый в группе",
        "grammar_key": "mu-i5-91",
        "skill_ids": [
          "each-every"
        ]
      },
      {
        "code": "92",
        "title": "Уточнение человека или предмета",
        "grammar_key": "mu-i5-92",
        "skill_ids": [
          "relative-clauses"
        ]
      },
      {
        "code": "93",
        "title": "Когда относительное местоимение можно убрать",
        "grammar_key": "mu-i5-93",
        "skill_ids": [
          "relative-omission"
        ]
      },
      {
        "code": "94",
        "title": "Чей, где и с кем",
        "grammar_key": "mu-i5-94",
        "skill_ids": [
          "relative-prepositions"
        ]
      },
      {
        "code": "95",
        "title": "Дополнительное сообщение через запятые",
        "grammar_key": "mu-i5-95",
        "skill_ids": [
          "non-defining"
        ]
      },
      {
        "code": "96",
        "title": "Комментарий о ситуации и части группы",
        "grammar_key": "mu-i5-96",
        "skill_ids": [
          "relative-extended"
        ]
      },
      {
        "code": "97",
        "title": "Краткое определение через -ing и -ed",
        "grammar_key": "mu-i5-97",
        "skill_ids": [
          "reduced-relatives"
        ]
      },
      {
        "code": "98",
        "title": "Причина эмоции и чувство человека",
        "grammar_key": "mu-i5-98",
        "skill_ids": [
          "ed-ing"
        ]
      },
      {
        "code": "99",
        "title": "Порядок прилагательных и связочные глаголы",
        "grammar_key": "mu-i5-99",
        "skill_ids": [
          "adjective-order"
        ]
      },
      {
        "code": "100",
        "title": "Описание предмета и способа действия",
        "grammar_key": "mu-i5-100",
        "skill_ids": [
          "adverbs"
        ]
      },
      {
        "code": "101",
        "title": "Наречия, которые легко перепутать",
        "grammar_key": "mu-i5-101",
        "skill_ids": [
          "adverb-exceptions"
        ]
      },
      {
        "code": "102",
        "title": "Усиление с so и such",
        "grammar_key": "mu-i5-102",
        "skill_ids": [
          "so-such"
        ]
      },
      {
        "code": "103",
        "title": "Достаточно или чрезмерно",
        "grammar_key": "mu-i5-103",
        "skill_ids": [
          "too-enough"
        ]
      },
      {
        "code": "104",
        "title": "Насколько выражен признак",
        "grammar_key": "mu-i5-104",
        "skill_ids": [
          "degree-adverbs"
        ]
      },
      {
        "code": "105",
        "title": "Как сравнить два объекта",
        "grammar_key": "mu-i5-105",
        "skill_ids": [
          "comparisons"
        ]
      },
      {
        "code": "106",
        "title": "Насколько больше или лучше",
        "grammar_key": "mu-i5-106",
        "skill_ids": [
          "comparative-modifiers"
        ]
      },
      {
        "code": "107",
        "title": "Равенство и неравенство признаков",
        "grammar_key": "mu-i5-107",
        "skill_ids": [
          "as-comparisons"
        ]
      },
      {
        "code": "108",
        "title": "Самый высокий результат в группе",
        "grammar_key": "mu-i5-108",
        "skill_ids": [
          "superlatives"
        ]
      },
      {
        "code": "109",
        "title": "Объект, место и время в предложении",
        "grammar_key": "mu-i5-109",
        "skill_ids": [
          "word-order"
        ]
      },
      {
        "code": "110",
        "title": "Положение наречия возле глагола",
        "grammar_key": "mu-i5-110",
        "skill_ids": [
          "frequency"
        ]
      },
      {
        "code": "111",
        "title": "Что ещё продолжается и что уже произошло",
        "grammar_key": "mu-i5-111",
        "skill_ids": [
          "still-yet"
        ]
      },
      {
        "code": "112",
        "title": "Как подчеркнуть неожиданный факт",
        "grammar_key": "mu-i5-112",
        "skill_ids": [
          "even"
        ]
      },
      {
        "code": "113",
        "title": "Противопоставление фактов",
        "grammar_key": "mu-i5-113",
        "skill_ids": [
          "contrast"
        ]
      },
      {
        "code": "114",
        "title": "Действие на случай возможной ситуации",
        "grammar_key": "mu-i5-114",
        "skill_ids": [
          "in-case"
        ]
      },
      {
        "code": "115",
        "title": "Условие и его исключение",
        "grammar_key": "mu-i5-115",
        "skill_ids": [
          "unless"
        ]
      },
      {
        "code": "116",
        "title": "Одновременность и причина с as",
        "grammar_key": "mu-i5-116",
        "skill_ids": [
          "as-time-cause"
        ]
      },
      {
        "code": "117",
        "title": "Сходство и роль",
        "grammar_key": "mu-i5-117",
        "skill_ids": [
          "like-as"
        ]
      },
      {
        "code": "118",
        "title": "На что похожа ситуация",
        "grammar_key": "mu-i5-118",
        "skill_ids": [
          "as-if"
        ]
      },
      {
        "code": "119",
        "title": "Период и действие во времени",
        "grammar_key": "mu-i5-119",
        "skill_ids": [
          "during-while"
        ]
      },
      {
        "code": "120",
        "title": "Крайний срок и продолжительность",
        "grammar_key": "mu-i5-120",
        "skill_ids": [
          "by-until"
        ]
      },
      {
        "code": "121",
        "title": "Предлог для часов, дней и месяцев",
        "grammar_key": "mu-i5-121",
        "skill_ids": [
          "time-prepositions"
        ]
      },
      {
        "code": "122",
        "title": "Вовремя и в конце",
        "grammar_key": "mu-i5-122",
        "skill_ids": [
          "on-time-end"
        ]
      },
      {
        "code": "123",
        "title": "Базовое местоположение",
        "grammar_key": "mu-i5-123",
        "skill_ids": [
          "place-prepositions"
        ]
      },
      {
        "code": "124",
        "title": "Здания, адреса и мероприятия",
        "grammar_key": "mu-i5-124",
        "skill_ids": [
          "at-places"
        ]
      },
      {
        "code": "125",
        "title": "Точки на карте, этажи и поверхности",
        "grammar_key": "mu-i5-125",
        "skill_ids": [
          "location-patterns"
        ]
      },
      {
        "code": "126",
        "title": "Направление и движение внутрь",
        "grammar_key": "mu-i5-126",
        "skill_ids": [
          "movement-to"
        ]
      },
      {
        "code": "127",
        "title": "Устойчивые сочетания с предлогами",
        "grammar_key": "mu-i5-127",
        "skill_ids": [
          "preposition-expressions"
        ]
      },
      {
        "code": "128",
        "title": "Способ, транспорт и исполнитель",
        "grammar_key": "mu-i5-128",
        "skill_ids": [
          "by-means"
        ]
      },
      {
        "code": "129",
        "title": "Предлог после существительного",
        "grammar_key": "mu-i5-129",
        "skill_ids": [
          "noun-prepositions"
        ]
      },
      {
        "code": "130",
        "title": "Отношение и реакция: предлоги",
        "grammar_key": "mu-i5-130",
        "skill_ids": [
          "adjective-prepositions-1"
        ]
      },
      {
        "code": "131",
        "title": "Способности и заинтересованность",
        "grammar_key": "mu-i5-131",
        "skill_ids": [
          "adjective-prepositions-2"
        ]
      },
      {
        "code": "132",
        "title": "Направление речи и действия",
        "grammar_key": "mu-i5-132",
        "skill_ids": [
          "verb-prepositions-to-at"
        ]
      },
      {
        "code": "133",
        "title": "Просить, искать и заботиться",
        "grammar_key": "mu-i5-133",
        "skill_ids": [
          "verb-prepositions-for-after"
        ]
      },
      {
        "code": "134",
        "title": "Думать, слышать и напоминать",
        "grammar_key": "mu-i5-134",
        "skill_ids": [
          "verb-prepositions-about-of"
        ]
      },
      {
        "code": "135",
        "title": "Зависеть, защищать и обвинять",
        "grammar_key": "mu-i5-135",
        "skill_ids": [
          "verb-prepositions-from-on"
        ]
      },
      {
        "code": "136",
        "title": "Участвовать, верить и справляться",
        "grammar_key": "mu-i5-136",
        "skill_ids": [
          "verb-prepositions-in-with"
        ]
      },
      {
        "code": "137",
        "title": "Как устроен фразовый глагол",
        "grammar_key": "mu-i5-137",
        "skill_ids": [
          "phrasal-intro"
        ]
      },
      {
        "code": "138",
        "title": "Войти, выйти и присоединиться",
        "grammar_key": "mu-i5-138",
        "skill_ids": [
          "phrasal-in-out"
        ]
      },
      {
        "code": "139",
        "title": "Результат действия с out",
        "grammar_key": "mu-i5-139",
        "skill_ids": [
          "phrasal-out"
        ]
      },
      {
        "code": "140",
        "title": "Начало, продолжение и прекращение",
        "grammar_key": "mu-i5-140",
        "skill_ids": [
          "phrasal-on-off"
        ]
      },
      {
        "code": "141",
        "title": "Отправиться, отложить и продвинуться",
        "grammar_key": "mu-i5-141",
        "skill_ids": [
          "phrasal-on-off-2"
        ]
      },
      {
        "code": "142",
        "title": "Увеличить, уменьшить и записать",
        "grammar_key": "mu-i5-142",
        "skill_ids": [
          "phrasal-up-down"
        ]
      },
      {
        "code": "143",
        "title": "Устроить, закончить и вырасти",
        "grammar_key": "mu-i5-143",
        "skill_ids": [
          "phrasal-up"
        ]
      },
      {
        "code": "144",
        "title": "Разобраться, нагнать и выдержать",
        "grammar_key": "mu-i5-144",
        "skill_ids": [
          "phrasal-up-2"
        ]
      },
      {
        "code": "145",
        "title": "Удалиться, вернуть и ответить",
        "grammar_key": "mu-i5-145",
        "skill_ids": [
          "phrasal-away-back"
        ]
      }
    ]
  }
];
module.exports={MURPHY_BOOKS};
