// bank/seed.js — стартовые задания банка от Lessonfold. Все задания авторские: тексты и упражнения
// учебников не копировались, по учебнику взяты только темы юнитов. Ключ (key) не меняйте: по нему
// задание обновляется, а не дублируется.
//   match — «слово - перевод» по строкам; gaps — текст с [ответом|вариантом]; order — предложения по строкам
const lines = (s) => s.trim().split('\n').map((l) => l.trim()).filter(Boolean);
const match = (s) => ({ type: 'match', pairs: lines(s).map((l) => { const [a, b] = l.split(' - '); return { a: a.trim(), b: b.trim() }; }) });
const gaps = (s, mode = 'bank') => ({ type: 'gaps', text: lines(s).join('\n'), mode, distractors: [] });
const order = (s) => ({ type: 'order', sentences: lines(s) });

const S = 'solutions-elem-3';
const P = 'speakout-a1-3';

const SEED = [
  // ---------------- Solutions Elementary ----------------
  { key: 'sol-i-words', book: S, unit: 'I', title: 'Личная информация и инструменты: слова', game: match(`
    surname - фамилия
    first name - имя
    date of birth - дата рождения
    address - адрес
    phone number - номер телефона
    drums - барабаны
    violin - скрипка
    keyboard - синтезатор`) },
  { key: 'sol-i-be-have', book: S, unit: 'I', title: 'be, have got, can', game: gaps(`
    My name [is] Kate and I [am|'m] fourteen.
    We [have got|'ve got] a big dog called Max.
    [Has] your brother got a bike?
    My parents [are] from Kazan.
    I [can] play the guitar, but I [can't|cannot] sing.
    [Can] you swim?
    She [hasn't|has not] got any sisters.`) },
  { key: 'sol-i-articles', book: S, unit: 'I', title: 'a / an / the, this / that / these / those', game: gaps(`
    I've got [a] cat and [an] old hamster.
    [The] cat is black and [the] hamster is brown.
    Look at [those] birds in the sky over there!
    [This] book in my hand is really interesting.
    Are [these] your keys here on the table?
    She wants to be [an] engineer.`) },

  { key: 'sol-1-family', book: S, unit: '1', title: 'Семья: слова', game: match(`
    aunt - тётя
    uncle - дядя
    cousin - двоюродный брат или сестра
    grandparents - бабушка и дедушка
    stepmother - мачеха
    only child - единственный ребёнок
    twins - близнецы
    nephew - племянник`) },
  { key: 'sol-1-ps', book: S, unit: '1', title: 'Present Simple: утверждение, отрицание, вопрос', game: gaps(`
    My cousin [lives] in Omsk.
    She [doesn't|does not] like football.
    [Do] your grandparents live near you?
    My dad [works] in a hospital.
    We [don't|do not] see our uncle very often.
    What time [does] your sister get home?
    He [watches] TV every evening.
    Where [do] you go on Saturdays?`, 'type') },
  { key: 'sol-1-order', book: S, unit: '1', title: 'Собери предложение: о себе и семье', game: order(`
    My brother is older than me.
    We have dinner together every evening.
    Does your aunt live in Moscow?
    I don't have any brothers or sisters.
    My best friend has got long dark hair.`) },

  { key: 'sol-2-routine', book: S, unit: '2', title: 'Распорядок дня: слова', game: match(`
    get up - вставать
    have breakfast - завтракать
    catch the bus - успеть на автобус
    do homework - делать домашнее задание
    go to bed - ложиться спать
    get dressed - одеваться
    have a shower - принимать душ
    go home - идти домой`) },
  { key: 'sol-2-have-to', book: S, unit: '2', title: 'have to, should, наречия частоты', game: gaps(`
    We [have to] wear a uniform at our school.
    She [has to] get up at six on Mondays.
    You [don't have to|do not have to] bring lunch; there is a canteen.
    You look tired. You [should] go to bed early.
    You [shouldn't|should not] use your phone in class.
    I [always] walk to school; I never take the bus.
    [How often] do you have PE?`) },
  { key: 'sol-2-order', book: S, unit: '2', title: 'Собери предложение: школа', game: order(`
    I usually have lunch at school.
    We have to be at school at eight.
    How often do you play sport?
    She never forgets her homework.
    You should ask your teacher for help.`) },

  { key: 'sol-3-clothes', book: S, unit: '3', title: 'Одежда: слова', game: match(`
    hoodie - толстовка с капюшоном
    trainers - кроссовки
    jacket - куртка
    skirt - юбка
    boots - ботинки, сапоги
    scarf - шарф
    tracksuit - спортивный костюм
    cap - кепка`) },
  { key: 'sol-3-pc', book: S, unit: '3', title: 'Present Continuous и Present Simple', game: gaps(`
    Look! Anna [is wearing] her new jacket today.
    I usually [wear] jeans, but today I [am wearing|'m wearing] a suit.
    What [are] you doing now?
    They [aren't|are not] listening to the teacher at the moment.
    My brother [buys] clothes online every month.
    [Is] it raining outside?
    She [doesn't|does not] often wear a skirt.`, 'type') },
  { key: 'sol-3-order', book: S, unit: '3', title: 'Собери предложение: одежда и планы', game: order(`
    I'm wearing my favourite trainers.
    What are you doing on Saturday?
    She usually wears black clothes.
    We're meeting at the cinema at six.
    Are you looking for a new hoodie?`) },

  { key: 'sol-4-food', book: S, unit: '4', title: 'Еда: слова', game: match(`
    bread - хлеб
    cheese - сыр
    beans - фасоль
    rice - рис
    mushrooms - грибы
    yoghurt - йогурт
    biscuits - печенье
    juice - сок`) },
  { key: 'sol-4-some-any', book: S, unit: '4', title: 'there is / are, some / any, much / many', game: gaps(`
    There [is|'s] some milk in the fridge.
    There [are] some eggs on the table.
    Is there [any] juice left?
    We haven't got [any] bread.
    How [much] sugar do you need?
    How [many] apples are there?
    I only drink [a little] coffee.
    There are [a few] biscuits in the box.`) },
  { key: 'sol-4-groups', book: S, unit: '4', title: 'Исчисляемые и неисчисляемые', game: { type: 'groups', groups: [
    { name: 'Countable', items: ['apple', 'egg', 'biscuit', 'tomato', 'sandwich'] },
    { name: 'Uncountable', items: ['milk', 'rice', 'bread', 'cheese', 'water'] },
  ] } },

  { key: 'sol-5-places', book: S, unit: '5', title: 'Места в городе: слова', game: match(`
    bus station - автовокзал
    library - библиотека
    shopping centre - торговый центр
    square - площадь
    post office - почта
    bridge - мост
    museum - музей
    sports centre - спортивный центр`) },
  { key: 'sol-5-comparatives', book: S, unit: '5', title: 'Сравнительная и превосходная степень', game: gaps(`
    Moscow is [bigger] than Kazan.
    This is the [biggest] park in our city.
    The museum is [more interesting] than the cinema.
    It's the [most expensive] café in town.
    My street is [quieter] than yours.
    This is the [best] pizza I know!
    Today is [worse] than yesterday.`, 'type') },
  { key: 'sol-5-directions', book: S, unit: '5', title: 'Как пройти: собери фразу', game: order(`
    Excuse me, where is the library?
    Go straight on and turn left.
    It's opposite the bank.
    Take the second street on the right.
    Is it far from here?`) },

  { key: 'sol-6-animals', book: S, unit: '6', title: 'Животные и природа: слова', game: match(`
    bear - медведь
    wolf - волк
    eagle - орёл
    snake - змея
    whale - кит
    forest - лес
    river - река
    desert - пустыня`) },
  { key: 'sol-6-was-were', book: S, unit: '6', title: 'Поход на природу: was / were', game: gaps(`
    Last summer we [were] in the mountains.
    The weather [was] cold, but it [wasn't|was not] rainy.
    [Were] there any bears in the forest?
    I [was] very tired after the walk.
    My friends [weren't|were not] scared of the wolves.
    Where [were] you yesterday?`) },
  { key: 'sol-6-order', book: S, unit: '6', title: 'Собери предложение: дикая природа', game: order(`
    Eagles can see very well.
    There are a lot of fish in this river.
    We saw a snake in the desert.
    Whales live in the ocean.
    Wolves usually hunt at night.`) },

  { key: 'sol-7-tech', book: S, unit: '7', title: 'Техника и интернет: слова', game: match(`
    laptop - ноутбук
    password - пароль
    download - скачивать
    upload - загружать
    screen - экран
    charger - зарядка
    search engine - поисковик
    keyboard - клавиатура`) },
  { key: 'sol-7-past', book: S, unit: '7', title: 'Past Simple: что ты делал в интернете', game: gaps(`
    Yesterday I [downloaded] a new game.
    She [sent] me a funny video.
    We [didn't|did not] watch the film online.
    [Did] you upload the photos?
    He [forgot] his password again.
    I [bought] a new charger last week.
    What [did] you search for?`, 'type') },
  { key: 'sol-7-order', book: S, unit: '7', title: 'Собери предложение: гаджеты', game: order(`
    My laptop battery is dead.
    Can I borrow your charger?
    I never share my password.
    Did you get my message?
    She spends two hours online every day.`) },

  { key: 'sol-8-sport', book: S, unit: '8', title: 'Спорт: слова', game: match(`
    swimming - плавание
    cycling - езда на велосипеде
    skiing - катание на лыжах
    climbing - скалолазание
    volleyball - волейбол
    gymnastics - гимнастика
    karate - карате
    running - бег`) },
  { key: 'sol-8-go-play-do', book: S, unit: '8', title: 'go, play или do', game: { type: 'groups', groups: [
    { name: 'go', items: ['swimming', 'cycling', 'skiing', 'running'] },
    { name: 'play', items: ['football', 'volleyball', 'tennis', 'chess'] },
    { name: 'do', items: ['karate', 'gymnastics', 'yoga', 'judo'] },
  ] } },
  { key: 'sol-8-gaps', book: S, unit: '8', title: 'Спорт и планы: going to', game: gaps(`
    I'm [going to] start running in the mornings.
    We [are|'re] going to play volleyball on Sunday.
    [Is] she going to join the swimming club?
    They [aren't|are not] going to watch the match.
    What [are] you going to do this weekend?`) },

  { key: 'sol-9-home', book: S, unit: '9', title: 'Дом и мебель: слова', game: match(`
    bedroom - спальня
    kitchen - кухня
    bathroom - ванная
    wardrobe - шкаф для одежды
    armchair - кресло
    shelf - полка
    carpet - ковёр
    garden - сад`) },
  { key: 'sol-9-prepositions', book: S, unit: '9', title: 'Где что стоит: предлоги места', game: gaps(`
    The lamp is [on] the desk.
    My shoes are [under] the bed.
    The sofa is [between] the two windows.
    There is a picture [above] the armchair.
    The fridge is [next to] the cooker.
    The cat is sleeping [in front of] the fire.`) },
  { key: 'sol-9-order', book: S, unit: '9', title: 'Собери предложение: мой дом', game: order(`
    There are three bedrooms in our flat.
    My room is small but cosy.
    We have dinner in the kitchen.
    Is there a garden behind the house?
    I'd like a bigger wardrobe.`) },

  // ---------------- Speakout A1 ----------------
  { key: 'spk-1-countries', book: P, unit: '1', title: 'Страны, национальности, профессии', game: match(`
    Spain - Испания
    Spanish - испанский, испанец
    Germany - Германия
    German - немецкий, немец
    teacher - учитель
    doctor - врач
    engineer - инженер
    student - студент`) },
  { key: 'spk-1-be', book: P, unit: '1', title: 'be: am / is / are, a / an', game: gaps(`
    I [am|'m] from Russia.
    [Are] you a student?
    She [is|'s] a doctor.
    He [isn't|is not] from Italy, he's from Spain.
    It's [an] apple.
    My friend is [a] taxi driver.
    Where [is] he from?`) },
  { key: 'spk-1-order', book: P, unit: '1', title: 'Знакомство: собери фразу', game: order(`
    Hello, my name is Anna.
    Nice to meet you.
    Where are you from?
    I'm a student from Moscow.
    What's your job?`) },

  { key: 'spk-2-people', book: P, unit: '2', title: 'Люди и семья: слова', game: match(`
    husband - муж
    wife - жена
    son - сын
    daughter - дочь
    friend - друг
    neighbour - сосед
    boss - начальник
    colleague - коллега`) },
  { key: 'spk-2-possessives', book: P, unit: '2', title: 'my / your / his / her / our / their', game: gaps(`
    This is my sister. [Her] name is Olga.
    That's my brother. [His] car is red.
    We love [our] new flat.
    They are my neighbours. [Their] dog is very friendly.
    What's [your] phone number?
    I live with [my] parents.`) },
  { key: 'spk-2-questions', book: P, unit: '2', title: 'Вопросы с be', game: gaps(`
    [What] is your name?
    [Where] are your parents from?
    [How old] is your son?
    [Who] is that man? He's my boss.
    [Are] they your colleagues?
    [Is] your wife a teacher?`) },

  { key: 'spk-3-things', book: P, unit: '3', title: 'Предметы: слова', game: match(`
    keys - ключи
    wallet - кошелёк
    umbrella - зонт
    glasses - очки
    watch - часы (наручные)
    bag - сумка
    headphones - наушники
    passport - паспорт`) },
  { key: 'spk-3-have', book: P, unit: '3', title: "have / has и 's", game: gaps(`
    I [have] two brothers.
    My sister [has] a new phone.
    This is Tom['s] bag.
    [Do] you have an umbrella?
    We [don't|do not] have a car.
    How much [is] this watch?
    How much [are] these headphones?`) },
  { key: 'spk-3-order', book: P, unit: '3', title: 'В магазине: собери фразу', game: order(`
    How much is this bag?
    It's twenty euros.
    Do you have it in black?
    I'll take it, thank you.
    Can I pay by card?`) },

  { key: 'spk-4-food', book: P, unit: '4', title: 'Еда, напитки, распорядок: слова', game: match(`
    breakfast - завтрак
    lunch - обед
    dinner - ужин
    tea - чай
    sandwich - бутерброд
    soup - суп
    start work - начинать работу
    finish work - заканчивать работу`) },
  { key: 'spk-4-ps', book: P, unit: '4', title: 'Present Simple: мой день', game: gaps(`
    I [get] up at seven.
    She [has] breakfast at home.
    We [don't|do not] eat meat.
    [Does] he drink coffee?
    They [start] work at nine.
    My brother [finishes] work at six.
    What time [do] you have lunch?`, 'type') },
  { key: 'spk-4-cafe', book: P, unit: '4', title: 'В кафе: собери фразу', game: order(`
    Can I have a cup of tea, please?
    Anything else?
    A cheese sandwich, please.
    That's six pounds fifty.
    Here you are.`) },

  { key: 'spk-5-verbs', book: P, unit: '5', title: 'Глаголы действия и месяцы', game: match(`
    swim - плавать
    drive - водить машину
    cook - готовить
    dance - танцевать
    ride a bike - кататься на велосипеде
    January - январь
    May - май
    October - октябрь`) },
  { key: 'spk-5-can', book: P, unit: '5', title: 'can / can’t, просьбы', game: gaps(`
    I [can] swim, but I [can't|cannot] dive.
    [Can] you drive?
    She [can] speak three languages.
    [Can] I open the window, please?
    [Could] you help me, please?
    My grandmother [can't|cannot] use a computer.`) },
  { key: 'spk-5-dates', book: P, unit: '5', title: 'Даты: собери фразу', game: order(`
    My birthday is on the third of May.
    When is your birthday?
    The party is on the first of June.
    Today is the twelfth of October.
    Can you come on Saturday?`) },

  { key: 'spk-6-rooms', book: P, unit: '6', title: 'Комнаты и места в городе: слова', game: match(`
    living room - гостиная
    bed - кровать
    table - стол
    chair - стул
    bank - банк
    pharmacy - аптека
    supermarket - супермаркет
    station - вокзал, станция`) },
  { key: 'spk-6-there-is', book: P, unit: '6', title: 'there is / there are, предлоги', game: gaps(`
    [There is|There's] a sofa in the living room.
    [There are] two chairs in the kitchen.
    Is [there] a bank near here?
    [Are] there any shops in your street?
    The pharmacy is [next to] the station.
    My bag is [on] the chair.
    The cat is [under] the table.`) },
  { key: 'spk-6-where', book: P, unit: '6', title: 'Где это? Собери фразу', game: order(`
    Excuse me, is there a pharmacy near here?
    Yes, it's next to the bank.
    Where is the station?
    It's on the left.
    There are two supermarkets in my street.`) },
  { key: 'spk-7-body', book: P, unit: '7', title: 'Части тела и самочувствие: слова', game: match(`
    head - голова
    back - спина
    stomach - живот
    throat - горло
    leg - нога
    arm - рука
    headache - головная боль
    a cold - простуда`) },
  { key: 'spk-7-questions', book: P, unit: '7', title: 'Вопросы с wh- и was / were', game: gaps(`
    [What] time do you get up?
    [Where] does your sister work?
    How often [do] you go to the gym?
    My grandfather [was] a doctor.
    We [were] at home yesterday evening.
    [Was] the film good?
    They [weren't|were not] tired after the match.`) },
  { key: 'spk-7-doctor', book: P, unit: '7', title: 'У врача: собери фразу', game: order(`
    I don't feel very well.
    What's the matter?
    I've got a bad headache.
    Drink lots of water and rest.
    Don't go to work tomorrow.`) },

  { key: 'spk-8-transport', book: P, unit: '8', title: 'Транспорт и досуг: слова', game: match(`
    train - поезд
    plane - самолёт
    ticket office - билетная касса
    return ticket - билет туда и обратно
    single ticket - билет в одну сторону
    platform - платформа
    go to a concert - сходить на концерт
    stay at home - остаться дома`) },
  { key: 'spk-8-past', book: P, unit: '8', title: 'Past Simple: что было на выходных', game: gaps(`
    Last Saturday we [visited] our friends in Kazan.
    I [watched] a film on Friday evening.
    She [went] to the theatre with her mum.
    We [had] lunch in a small café.
    [Did] you see the museum?
    No, I [didn't|did not] have time.
    They [bought] tickets for the train.`) },
  { key: 'spk-8-ticket', book: P, unit: '8', title: 'На вокзале: собери фразу', game: order(`
    I'd like a return ticket to Moscow, please.
    What time does the next train leave?
    Which platform is it?
    How much is a single ticket?
    I want to go to the concert on Sunday.`) },
];

// Плюс упражнения на все слова юнитов (собираются из словаря)
const { vocabTasks } = require('./vocab-tasks');
SEED.push(...vocabTasks());
// Грамматика: учебники Round-Up и дополнительные упражнения к юнитам Solutions и Speakout
SEED.push(...require('./grammar-roundup'), ...require('./grammar-units'));

module.exports = { SEED };
